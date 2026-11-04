import type { BaseEvent, Operation, Step } from "./operation";
import type {
  Beat,
  Bounds,
  Camera,
  Frame,
  Keyframe,
  Pose,
  Refs,
  Scene,
  Size,
  Timeline,
} from "./types";
import { linear } from "./types";
import {
  applyDerived,
  derivedBounds,
  hierarchyFromScene,
  resolve,
} from "./resolve";
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

export type CameraMode = "fit" | "fit-per-step";

export type CompileOpts = {
  step_ms?: number;
  viewport?: Size;
  camera_mode?: CameraMode;
  padding?: number;
};

const DEFAULT_STEP_MS = 300;
const DEFAULT_VIEWPORT: Size = { width: 1280, height: 720 };
const DEFAULT_PADDING = 48;

function cameraFromBounds(b: Bounds, viewport: Size, padding: number): Camera {
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

function sizeFromBounds(b: Bounds, zoom: number, padding: number): Size {
  return {
    width: (b.max_x - b.min_x) * zoom + 2 * padding,
    height: (b.max_y - b.min_y) * zoom + 2 * padding,
  };
}

function unionBounds(a: Bounds, b: Bounds): Bounds {
  return {
    min_x: Math.min(a.min_x, b.min_x),
    min_y: Math.min(a.min_y, b.min_y),
    max_x: Math.max(a.max_x, b.max_x),
    max_y: Math.max(a.max_y, b.max_y),
  };
}

type RawStep = {
  scene: Scene;
  frames: { pose: Pose; weight: number; ease: Beat["ease"] | undefined }[];
  totalWeight: number;
};

export function compile<E extends BaseEvent, S>(
  adapter: Adapter<E, S>,
  op: Operation<E, S>,
  opts: CompileOpts = {},
): Timeline {
  const step_ms = opts.step_ms ?? DEFAULT_STEP_MS;
  const viewport = opts.viewport ?? DEFAULT_VIEWPORT;
  const padding = opts.padding ?? DEFAULT_PADDING;
  const cameraMode: CameraMode = opts.camera_mode ?? "fit";

  // Pass 1: resolve poses for every step + beat, no camera yet. Track the
  // union of derivedBounds across every keyframe — that's the op-max
  // envelope the default `fit` camera uses.
  const initialScene = adapter.scene(op.initial);
  let prevPose: Pose = applyDerived(adapter.layout(initialScene), initialScene);

  const raw: RawStep[] = [];
  let envelope: Bounds | undefined;

  const accBounds = (p: Pose) => {
    const b = derivedBounds(p);
    envelope = envelope ? unionBounds(envelope, b) : b;
  };
  accBounds(prevPose);

  for (let i = 0; i < op.steps.length; i++) {
    const step = op.steps[i];
    const scene = adapter.scene(step.snapshot);
    const base = adapter.layout(scene);
    const hierarchy = hierarchyFromScene(scene);
    const refs: Refs = { base, prev: prevPose };

    const beats = adapter.beats({ op, index: i, step, refs });

    const startPose = prevPose;
    const frames: RawStep["frames"] = [
      { pose: startPose, weight: 0, ease: linear },
    ];
    accBounds(startPose);

    let totalWeight = 0;
    let runningPose: Pose = startPose;
    for (const beat of beats) {
      const pose = resolve(base, refs, beat.overrides, hierarchy, scene);
      frames.push({ pose, weight: beat.weight, ease: beat.ease });
      accBounds(pose);
      runningPose = pose;
      totalWeight += beat.weight;
    }

    if (beats.length === 0) {
      frames.push({ pose: base, weight: 1, ease: linear });
      accBounds(base);
      runningPose = base;
      totalWeight = 1;
    }

    raw.push({ scene, frames, totalWeight });
    prevPose = runningPose;
  }

  // Pass 2: emit Keyframes. Camera is op-max for "fit", per-pose for
  // "fit-per-step". Size tracks whichever camera was chosen so the SVG
  // viewport grows or stays fixed accordingly.
  const envBounds = envelope ?? {
    min_x: 0,
    min_y: 0,
    max_x: 0,
    max_y: 0,
  };
  const envCamera = cameraFromBounds(envBounds, viewport, padding);
  const envSize = sizeFromBounds(envBounds, envCamera.zoom, padding);

  const stepsOut: Keyframe[][] = [];
  const durations: number[] = [];
  const scenesOut: Scene[] = raw.map((r) => r.scene);

  for (const r of raw) {
    const emitted: Keyframe[] = r.frames.map((f) => {
      if (cameraMode === "fit") {
        return {
          pose: f.pose,
          camera: envCamera,
          size: envSize,
          weight: f.weight,
          ease: f.ease ?? linear,
        };
      }
      const b = derivedBounds(f.pose);
      const cam = cameraFromBounds(b, viewport, padding);
      return {
        pose: f.pose,
        camera: cam,
        size: sizeFromBounds(b, cam.zoom, padding),
        weight: f.weight,
        ease: f.ease ?? linear,
      };
    });
    stepsOut.push(emitted);
    durations.push(step_ms * r.totalWeight);
  }

  return { steps: stepsOut, scenes: scenesOut, durations, step_ms };
}

export function sample(tl: Timeline, step: number, t: number): Frame {
  const clampedStep = Math.max(0, Math.min(tl.steps.length - 1, step));
  const frames = tl.steps[clampedStep];
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
