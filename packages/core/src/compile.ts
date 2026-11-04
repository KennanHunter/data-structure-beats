import type { BaseEvent, Operation, Step } from "./operation";
import type {
  Beat,
  Camera,
  CameraMode,
  Frame,
  Keyframe,
  Pose,
  Refs,
  Scene,
  Size,
  Timeline,
} from "./types";
import { linear } from "./types";
import { derivedBounds, hierarchyFromScene, resolve } from "./resolve";
import { lerpCamera, lerpPose } from "./lerp";

export type BeatCtx<E extends BaseEvent, S> = {
  op: Operation<E, S>;
  index: number;
  step: Step<E, S>;
  refs: Refs;
};

export interface Adapter<E extends BaseEvent, S> {
  scene(snapshot: S): Scene;
  layout(scene: Scene): Pose;
  beats(ctx: BeatCtx<E, S>): Beat[];
}

export type CompileOpts = {
  step_ms?: number;
  viewport?: Size;
  camera?: CameraMode;
  padding?: number;
};

const DEFAULT_STEP_MS = 300;
const DEFAULT_VIEWPORT: Size = { width: 1280, height: 720 };
const DEFAULT_PADDING = 48;

function fitCamera(pose: Pose, viewport: Size, padding: number): Camera {
  const b = derivedBounds(pose);
  const w = Math.max(1, b.max_x - b.min_x);
  const h = Math.max(1, b.max_y - b.min_y);
  const availW = Math.max(1, viewport.width - 2 * padding);
  const availH = Math.max(1, viewport.height - 2 * padding);
  const zoom = Math.min(availW / w, availH / h, 1);
  return {
    cx: (b.min_x + b.max_x) / 2,
    cy: (b.min_y + b.max_y) / 2,
    zoom,
  };
}

function poseSize(pose: Pose, zoom: number, padding: number): Size {
  const b = derivedBounds(pose);
  return {
    width: (b.max_x - b.min_x) * zoom + 2 * padding,
    height: (b.max_y - b.min_y) * zoom + 2 * padding,
  };
}

export function compile<E extends BaseEvent, S>(
  adapter: Adapter<E, S>,
  op: Operation<E, S>,
  opts: CompileOpts = {},
): Timeline {
  const step_ms = opts.step_ms ?? DEFAULT_STEP_MS;
  const viewport = opts.viewport ?? DEFAULT_VIEWPORT;
  const padding = opts.padding ?? DEFAULT_PADDING;

  const stepsOut: Keyframe[][] = [];
  const scenesOut: Scene[] = [];
  const durations: number[] = [];

  // Seed prev with the operation's initial state so step 0 sees the "before"
  // pose for its first beat. Without this, step 0's lerp starts from its own
  // post-emit layout — fine for read-only first events (visit) but wrong for
  // mutating first events (prepend into an empty list would slide instead of
  // pop in).
  const initialScene = adapter.scene(op.initial);
  let prevPose: Pose | undefined = adapter.layout(initialScene);

  for (let i = 0; i < op.steps.length; i++) {
    const step = op.steps[i];
    const scene = adapter.scene(step.snapshot);
    const base = adapter.layout(scene);
    const hierarchy = hierarchyFromScene(scene);
    const refs: Refs = { base, prev: prevPose ?? base };

    const beats = adapter.beats({ op, index: i, step, refs });

    // Starting pose for this step is the previous step's final pose (or
    // layout for the first step).
    const startPose: Pose = prevPose ?? base;
    const startCamera = fitCamera(startPose, viewport, padding);
    const startSize = poseSize(startPose, startCamera.zoom, padding);

    const stepFrames: Keyframe[] = [
      {
        pose: startPose,
        camera: startCamera,
        size: startSize,
        weight: 0,
        ease: linear,
      },
    ];

    let runningPose: Pose = startPose;
    let totalWeight = 0;
    for (const beat of beats) {
      const overridesPose = resolve(base, refs, beat.overrides, hierarchy);
      // Fold: the beat produces a new pose by taking the base layout and
      // applying overrides. Carry across beats by using the previous beat's
      // pose as the starting point for the next resolve's "base".
      // For Phase 1 we take the simple approach: each beat's resolve is
      // against (base, refs), and the resulting pose is what we lerp to.
      void runningPose;
      const camera = fitCamera(overridesPose, viewport, padding);
      const size = poseSize(overridesPose, camera.zoom, padding);
      stepFrames.push({
        pose: overridesPose,
        camera,
        size,
        weight: beat.weight,
        ease: beat.ease ?? linear,
      });
      runningPose = overridesPose;
      totalWeight += beat.weight;
    }

    if (beats.length === 0) {
      // No beats: this step is a no-op pose = base. Give it weight 1 so the
      // timeline doesn't have zero-duration steps.
      stepFrames.push({
        pose: base,
        camera: fitCamera(base, viewport, padding),
        size: poseSize(base, fitCamera(base, viewport, padding).zoom, padding),
        weight: 1,
        ease: linear,
      });
      totalWeight = 1;
      runningPose = base;
    }

    stepsOut.push(stepFrames);
    scenesOut.push(scene);
    durations.push(step_ms * totalWeight);
    prevPose = runningPose;
  }

  return { steps: stepsOut, scenes: scenesOut, durations, step_ms };
}

export function sample(tl: Timeline, step: number, t: number): Frame {
  const clampedStep = Math.max(0, Math.min(tl.steps.length - 1, step));
  const frames = tl.steps[clampedStep];
  // frames[0] is the start keyframe (weight 0); frames[1..] are beats.
  if (frames.length === 1) {
    const kf = frames[0];
    return { pose: kf.pose, camera: kf.camera, size: kf.size };
  }
  const total = frames.slice(1).reduce((a, f) => a + f.weight, 0);
  if (total <= 0) {
    const kf = frames[frames.length - 1];
    return { pose: kf.pose, camera: kf.camera, size: kf.size };
  }
  const clampedT = Math.max(0, Math.min(1, t));
  const target = clampedT * total;
  let acc = 0;
  for (let i = 1; i < frames.length; i++) {
    const beat = frames[i];
    const nextAcc = acc + beat.weight;
    if (target <= nextAcc || i === frames.length - 1) {
      const local = beat.weight === 0 ? 1 : (target - acc) / beat.weight;
      const eased = beat.ease(Math.max(0, Math.min(1, local)));
      const prev = frames[i - 1];
      return {
        pose: lerpPose(prev.pose, beat.pose, eased),
        camera: lerpCamera(prev.camera, beat.camera, eased),
        size: {
          width: prev.size.width + (beat.size.width - prev.size.width) * eased,
          height:
            prev.size.height + (beat.size.height - prev.size.height) * eased,
        },
      };
    }
    acc = nextAcc;
  }
  const last = frames[frames.length - 1];
  return { pose: last.pose, camera: last.camera, size: last.size };
}
