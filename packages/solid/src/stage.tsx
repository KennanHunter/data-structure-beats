import { For, type JSX } from "solid-js";
import type { Box, Element } from "@kennanhunter/data-structure-beats";
import type { PlayerSignal } from "./player-signal";

export type RenderElement = (props: {
  element: Element;
  box: Box;
}) => JSX.Element;

export type StageProps = {
  player: PlayerSignal;
  renderers: Record<string, RenderElement>;
  width?: number;
  height?: number;
  background?: string;
};

export function Stage(props: StageProps): JSX.Element {
  const viewBox = () => {
    const f = props.player.frame();
    return `0 0 ${f.size.width} ${f.size.height}`;
  };

  const groupTransform = () => {
    const f = props.player.frame();
    const padX = (f.size.width - (f.pose.boxes.size > 0 ? 0 : 0)) / 2;
    void padX;
    const padding = 48;
    // Translate so min_x becomes `padding`, then scale by zoom.
    let min_x = Infinity;
    let min_y = Infinity;
    for (const b of f.pose.boxes.values()) {
      if (b.opacity === 0) continue;
      if (b.x < min_x) min_x = b.x;
      if (b.y < min_y) min_y = b.y;
    }
    if (!Number.isFinite(min_x)) {
      min_x = 0;
      min_y = 0;
    }
    return `translate(${padding - min_x * f.camera.zoom} ${padding - min_y * f.camera.zoom}) scale(${f.camera.zoom})`;
  };

  return (
    <svg
      viewBox={viewBox()}
      width={props.width}
      height={props.height}
      style={{ background: props.background ?? "transparent", display: "block" }}
    >
      <g transform={groupTransform()}>
        <For each={Array.from(props.player.frame().pose.boxes.entries())}>
          {([id, box]) => {
            const el = props.player.scene().elements.get(id);
            if (!el) return null;
            const r = props.renderers[el.kind];
            if (!r) return null;
            return r({ element: el, box }) as unknown as JSX.Element;
          }}
        </For>
      </g>
    </svg>
  );
}
