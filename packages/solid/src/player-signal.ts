import { createSignal, onCleanup } from "solid-js";
import {
  sample,
  type Frame,
  type Scene,
  type Timeline,
} from "@kennanhunter/data-structure-beats";

export type Clock = {
  now(): number;
  request(cb: (t: number) => void): number;
  cancel(id: number): void;
};

export const defaultClock: Clock = {
  now: () => performance.now(),
  request: (cb) => requestAnimationFrame(cb),
  cancel: (id) => cancelAnimationFrame(id),
};

export type PlayerSignal = {
  frame: () => Frame;
  scene: () => Scene;
  step: () => number;
  t: () => number;
  playing: () => boolean;
  play: () => void;
  pause: () => void;
  seek: (step: number, t: number) => void;
  renderAt: (step: number, t: number) => Frame;
};

export type PlayerOpts = {
  clock?: Clock;
  loop?: boolean;
  onEnd?: () => void;
};

export function createPlayerSignal(
  timeline: Timeline,
  opts: PlayerOpts = {},
): PlayerSignal {
  const clock = opts.clock ?? defaultClock;
  const loop = opts.loop ?? false;

  const [step, setStep] = createSignal(0);
  const [t, setT] = createSignal(0);
  const [playing, setPlaying] = createSignal(false);

  let rafId: number | undefined;
  let stepStartTime = 0;

  const tick = () => {
    if (!playing()) return;
    const now = clock.now();
    const duration = timeline.durations[step()] ?? 0;
    const nextT = duration <= 0 ? 1 : Math.min(1, (now - stepStartTime) / duration);
    setT(nextT);
    if (nextT >= 1) {
      if (step() < timeline.steps.length - 1) {
        setStep(step() + 1);
        setT(0);
        stepStartTime = now;
      } else if (loop) {
        setStep(0);
        setT(0);
        stepStartTime = now;
      } else {
        setPlaying(false);
        opts.onEnd?.();
        return;
      }
    }
    rafId = clock.request(tick);
  };

  const play = () => {
    if (playing()) return;
    setPlaying(true);
    stepStartTime = clock.now() - t() * (timeline.durations[step()] ?? 0);
    rafId = clock.request(tick);
  };

  const pause = () => {
    setPlaying(false);
    if (rafId !== undefined) clock.cancel(rafId);
  };

  const seek = (s: number, u: number) => {
    const clampedS = Math.max(0, Math.min(timeline.steps.length - 1, s));
    const clampedU = Math.max(0, Math.min(1, u));
    setStep(clampedS);
    setT(clampedU);
    stepStartTime = clock.now() - clampedU * (timeline.durations[clampedS] ?? 0);
  };

  onCleanup(() => {
    setPlaying(false);
    if (rafId !== undefined) clock.cancel(rafId);
  });

  return {
    frame: () => sample(timeline, step(), t()),
    scene: () => timeline.scenes[step()],
    step,
    t,
    playing,
    play,
    pause,
    seek,
    renderAt: (s, u) => sample(timeline, s, u),
  };
}
