import { describe, expect, it } from "vitest";
import { createPlayer, type Clock } from "./player";
import { compile, type Adapter } from "./compile";
import { operation, type Recorder } from "./operation";
import type { Beat, Pose, Scene } from "./types";

type E = { t: "step" };
type S = { labels: string[] };

function adapter(): Adapter<E, S> {
  return {
    scene(snap) {
      const elements = new Map();
      for (const id of snap.labels) elements.set(id, { id, kind: "x" });
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
    beats() {
      const b: Beat[] = [
        { overrides: [{ id: "a", offset: { dx: 10, dy: 0 } }], weight: 1 },
      ];
      return b;
    },
  };
}

function fakeClock(): Clock & { tickBy(ms: number): void; fireAll(): void } {
  let t = 0;
  let nextId = 1;
  const pending = new Map<number, (t: number) => void>();
  return {
    now: () => t,
    request(cb) {
      const id = nextId++;
      pending.set(id, cb);
      return id;
    },
    cancel(id) {
      pending.delete(id);
    },
    tickBy(ms: number) {
      t += ms;
    },
    fireAll() {
      const cbs = [...pending.values()];
      pending.clear();
      for (const cb of cbs) cb(t);
    },
  };
}

function makeTimeline() {
  const state = { labels: ["a", "b"] };
  const op = operation<E, S>(
    { kind: "t", snapshot: () => ({ labels: [...state.labels] }) },
    (rec: Recorder<E>) => {
      rec.emit("step", {});
      rec.emit("step", {});
    },
  );
  return compile(adapter(), op, { step_ms: 100 });
}

describe("player", () => {
  it("initializes at step 0 t 0", () => {
    const tl = makeTimeline();
    const clock = fakeClock();
    const p = createPlayer(tl, { clock });
    expect(p.cursor()).toEqual({ step: 0, t: 0 });
  });

  it("seek-equals-play: playing to time X lands on the same frame as seek", () => {
    const tl = makeTimeline();
    const clock = fakeClock();
    const p = createPlayer(tl, { clock });
    p.play();
    clock.tickBy(50);
    clock.fireAll();
    const playedCursor = p.cursor();
    p.pause();

    const p2 = createPlayer(tl, { clock: fakeClock() });
    p2.seek(playedCursor.step, playedCursor.t);
    const seekedCursor = p2.cursor();

    expect(seekedCursor.step).toBe(playedCursor.step);
    expect(seekedCursor.t).toBeCloseTo(playedCursor.t, 5);
    // And sampled frames match
    const f1 = p.frame();
    const f2 = p2.frame();
    for (const id of ["a", "b"] as const) {
      expect(f1.pose.boxes.get(id)!.x).toBeCloseTo(
        f2.pose.boxes.get(id)!.x,
        5,
      );
    }
  });

  it("advances to next step when t crosses 1", () => {
    const tl = makeTimeline();
    const clock = fakeClock();
    const p = createPlayer(tl, { clock });
    p.play();
    clock.tickBy(100);
    clock.fireAll();
    // After first full step duration, tick should have advanced to step 1
    clock.tickBy(50);
    clock.fireAll();
    expect(p.cursor().step).toBe(1);
  });

  it("emits 'end' when finished and loop is off", () => {
    const tl = makeTimeline();
    const clock = fakeClock();
    const p = createPlayer(tl, { clock });
    let ended = false;
    p.on("end", () => {
      ended = true;
    });
    p.play();
    for (let i = 0; i < 10 && p.isPlaying(); i++) {
      clock.tickBy(100);
      clock.fireAll();
    }
    expect(ended).toBe(true);
    expect(p.isPlaying()).toBe(false);
  });
});
