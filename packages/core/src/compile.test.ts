import { describe, expect, it } from "vitest";
import { compile, sample, type Adapter } from "./compile";
import { operation, type Recorder } from "./operation";
import type { Beat, Pose, Scene } from "./types";

type E = { t: "a" } | { t: "b" };
type S = { labels: string[] };

function makeAdapter(): Adapter<E, S> {
  return {
    scene(snap) {
      const elements = new Map();
      for (const id of snap.labels) {
        elements.set(id, { id, kind: "x" });
      }
      return { elements } as Scene;
    },
    layout(scene) {
      const boxes = new Map();
      let x = 0;
      for (const id of scene.elements.keys()) {
        boxes.set(id, { x, y: 0, w: 10, h: 10, opacity: 1 });
        x += 20;
      }
      return { boxes } as Pose;
    },
    beats(ctx) {
      const b: Beat[] = [
        {
          overrides: [{ id: ctx.step.event.t, offset: { dx: 0, dy: 10 } }],
          weight: 1,
        },
      ];
      return b;
    },
  };
}

function buildOp() {
  const state = { labels: ["a", "b"] };
  return operation<E, S>(
    { kind: "test", snapshot: () => ({ labels: [...state.labels] }) },
    (rec: Recorder<E>) => {
      rec.emit("a", {});
      rec.emit("b", {});
    },
  );
}

describe("compile + sample", () => {
  it("compiles one keyframe set per step", () => {
    const op = buildOp();
    const tl = compile(makeAdapter(), op, { step_ms: 100 });
    expect(tl.steps).toHaveLength(2);
    expect(tl.durations).toEqual([100, 100]);
  });

  it("sample(s, 0) equals frame at start of step s", () => {
    const op = buildOp();
    const tl = compile(makeAdapter(), op, { step_ms: 100 });
    const f = sample(tl, 1, 0);
    // At the start of step 1, the pose is the end of step 0 — 'a' moved down.
    expect(f.pose.boxes.get("a")!.y).toBe(10);
  });

  it("continuity: sample(s, 1) ≈ sample(s+1, 0)", () => {
    const op = buildOp();
    const tl = compile(makeAdapter(), op, { step_ms: 100 });
    const end = sample(tl, 0, 1);
    const start = sample(tl, 1, 0);
    for (const id of ["a", "b"] as const) {
      const a = end.pose.boxes.get(id);
      const b = start.pose.boxes.get(id);
      expect(a).toBeDefined();
      expect(b).toBeDefined();
      expect(a!.x).toBeCloseTo(b!.x, 5);
      expect(a!.y).toBeCloseTo(b!.y, 5);
    }
  });

  it("no NaN or Infinity in sampled frames", () => {
    const op = buildOp();
    const tl = compile(makeAdapter(), op, { step_ms: 100 });
    for (let s = 0; s < tl.steps.length; s++) {
      for (let t = 0; t <= 1; t += 0.1) {
        const f = sample(tl, s, t);
        for (const b of f.pose.boxes.values()) {
          expect(Number.isFinite(b.x)).toBe(true);
          expect(Number.isFinite(b.y)).toBe(true);
        }
        expect(Number.isFinite(f.camera.zoom)).toBe(true);
      }
    }
  });
});
