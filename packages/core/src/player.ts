import type { Timeline, Frame } from "./types";
import { sample } from "./compile";

declare const performance: { now(): number };
declare function requestAnimationFrame(cb: (t: number) => void): number;
declare function cancelAnimationFrame(id: number): void;

export type Clock = {
  now(): number;
  request(cb: (t: number) => void): number;
  cancel(id: number): void;
};

export type Cursor = { step: number; t: number };

export type Player = {
  cursor(): Cursor;
  frame(): Frame;
  play(): void;
  pause(): void;
  seek(step: number, t: number): void;
  isPlaying(): boolean;
  on(event: "tick" | "end", cb: () => void): () => void;
  dispose(): void;
};

export const defaultClock: Clock = {
  now: () => performance.now(),
  request: (cb) => requestAnimationFrame(cb),
  cancel: (id) => cancelAnimationFrame(id),
};

export function createPlayer(
  timeline: Timeline,
  opts: { clock?: Clock; loop?: boolean } = {},
): Player {
  const clock = opts.clock ?? defaultClock;
  const loop = opts.loop ?? false;

  let step = 0;
  let t = 0;
  let playing = false;
  let rafId: number | undefined;
  let stepStartTime = 0;
  let listeners: { tick: Set<() => void>; end: Set<() => void> } = {
    tick: new Set(),
    end: new Set(),
  };

  const emit = (name: "tick" | "end") => {
    for (const cb of listeners[name]) cb();
  };

  const tick = () => {
    if (!playing) return;
    const now = clock.now();
    const stepDuration = timeline.durations[step] ?? 0;
    if (stepDuration <= 0) {
      t = 1;
    } else {
      t = Math.min(1, (now - stepStartTime) / stepDuration);
    }
    emit("tick");
    if (t >= 1) {
      if (step < timeline.steps.length - 1) {
        step++;
        t = 0;
        stepStartTime = now;
      } else if (loop) {
        step = 0;
        t = 0;
        stepStartTime = now;
      } else {
        playing = false;
        emit("end");
        return;
      }
    }
    rafId = clock.request(tick);
  };

  return {
    cursor: () => ({ step, t }),
    frame: () => sample(timeline, step, t),
    play: () => {
      if (playing) return;
      playing = true;
      stepStartTime = clock.now() - t * (timeline.durations[step] ?? 0);
      rafId = clock.request(tick);
    },
    pause: () => {
      playing = false;
      if (rafId !== undefined) clock.cancel(rafId);
    },
    seek: (s, u) => {
      step = Math.max(0, Math.min(timeline.steps.length - 1, s));
      t = Math.max(0, Math.min(1, u));
      stepStartTime = clock.now() - t * (timeline.durations[step] ?? 0);
      emit("tick");
    },
    isPlaying: () => playing,
    on: (event, cb) => {
      listeners[event].add(cb);
      return () => {
        listeners[event].delete(cb);
      };
    },
    dispose: () => {
      playing = false;
      if (rafId !== undefined) clock.cancel(rafId);
      listeners = { tick: new Set(), end: new Set() };
    },
  };
}
