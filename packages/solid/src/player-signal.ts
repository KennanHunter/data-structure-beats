import { createSignal, onCleanup } from "solid-js";
import {
  createPlayer,
  sample,
  type Clock,
  type Frame,
  type Player,
  type Scene,
  type Timeline,
} from "@kennanhunter/data-structure-beats";

export type PlayerSignal = {
  player: Player;
  frame: () => Frame;
  scene: () => Scene;
  step: () => number;
  t: () => number;
  playing: () => boolean;
  play: () => void;
  pause: () => void;
  seek: (step: number, t: number) => void;
};

export function createPlayerSignal(
  timeline: Timeline,
  opts: { clock?: Clock; loop?: boolean } = {},
): PlayerSignal {
  const player = createPlayer(timeline, opts);
  const initial = player.cursor();
  const [step, setStep] = createSignal(initial.step);
  const [t, setT] = createSignal(initial.t);
  const [playing, setPlaying] = createSignal(player.isPlaying());

  const unsubTick = player.on("tick", () => {
    const c = player.cursor();
    setStep(c.step);
    setT(c.t);
  });
  const unsubEnd = player.on("end", () => setPlaying(false));

  onCleanup(() => {
    unsubTick();
    unsubEnd();
    player.dispose();
  });

  return {
    player,
    frame: () => sample(timeline, step(), t()),
    scene: () => timeline.scenes[step()],
    step,
    t,
    playing,
    play: () => {
      player.play();
      setPlaying(true);
    },
    pause: () => {
      player.pause();
      setPlaying(false);
    },
    seek: (s, u) => {
      player.seek(s, u);
      setStep(s);
      setT(u);
    },
  };
}
