import { describe, expect, it } from "vitest";
import { createRoot } from "solid-js";
import { createPlayerSignal, type Clock } from "./player-signal";
import { compile, operation, type Adapter, type Beat, type Pose, type Recorder, type Scene } from "@kennanhunter/data-structure-beats";

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

describe("createPlayerSignal", () => {
  it("initializes at step 0 t 0", () =>
    createRoot((dispose) => {
      const tl = makeTimeline();
      const p = createPlayerSignal(tl, { clock: fakeClock() });
      expect(p.step()).toBe(0);
      expect(p.t()).toBe(0);
      dispose();
    }));

  it("seek updates signals and frame", () =>
    createRoot((dispose) => {
      const tl = makeTimeline();
      const p = createPlayerSignal(tl, { clock: fakeClock() });
      p.seek(1, 0.5);
      expect(p.step()).toBe(1);
      expect(p.t()).toBe(0.5);
      expect(Number.isFinite(p.frame().pose.boxes.get("a")!.x)).toBe(true);
      dispose();
    }));

  it("advances step when t crosses 1", () =>
    createRoot((dispose) => {
      const tl = makeTimeline();
      const clock = fakeClock();
      const p = createPlayerSignal(tl, { clock });
      p.play();
      clock.tickBy(100);
      clock.fireAll();
      clock.tickBy(50);
      clock.fireAll();
      expect(p.step()).toBe(1);
      p.pause();
      dispose();
    }));

  it("fires onEnd when finished", () =>
    createRoot((dispose) => {
      const tl = makeTimeline();
      const clock = fakeClock();
      let ended = false;
      const p = createPlayerSignal(tl, {
        clock,
        onEnd: () => {
          ended = true;
        },
      });
      p.play();
      for (let i = 0; i < 10 && p.playing(); i++) {
        clock.tickBy(100);
        clock.fireAll();
      }
      expect(ended).toBe(true);
      expect(p.playing()).toBe(false);
      dispose();
    }));

  it("renderAt is a pure lookup, independent of cursor", () =>
    createRoot((dispose) => {
      const tl = makeTimeline();
      const p = createPlayerSignal(tl, { clock: fakeClock() });
      const f = p.renderAt(1, 0.3);
      expect(f.pose.boxes.size).toBeGreaterThan(0);
      expect(p.step()).toBe(0);
      dispose();
    }));
});
