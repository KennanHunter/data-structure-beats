import type { RenderElement } from "@kennanhunter/data-structure-beats-solid";

const PRIMARY = "#1f6feb";
const MUTED = "#6e7781";
const NODE_FILL = "#e6f0ff";
const NODE_STROKE = "#1f6feb";
const TEXT = "#0b1a33";

export const node: RenderElement = ({ element, box }) => {
  const value = (element.data as { value: number }).value;
  return (
    <g style={{ opacity: box.opacity }}>
      <rect
        x={box.x}
        y={box.y}
        width={box.w}
        height={box.h}
        rx={4}
        fill={NODE_FILL}
        stroke={NODE_STROKE}
        stroke-width={2}
      />
      <text
        x={box.x + box.w / 2}
        y={box.y + box.h / 2}
        text-anchor="middle"
        dominant-baseline="central"
        font-family="ui-monospace, monospace"
        font-size={16}
        fill={TEXT}
      >
        {value}
      </text>
    </g>
  );
};

export const pointer: RenderElement = ({ box }) => {
  const midY = box.y + box.h / 2;
  const endX = box.x + box.w;
  return (
    <g style={{ opacity: box.opacity }}>
      <line
        x1={box.x}
        y1={midY}
        x2={endX - 6}
        y2={midY}
        stroke={PRIMARY}
        stroke-width={2}
      />
      <polygon
        points={`${endX},${midY} ${endX - 8},${midY - 5} ${endX - 8},${midY + 5}`}
        fill={PRIMARY}
      />
    </g>
  );
};

export const headPointer: RenderElement = ({ box }) => {
  const midY = box.y + box.h / 2;
  const endX = box.x + box.w;
  return (
    <g style={{ opacity: box.opacity }}>
      <text
        x={box.x}
        y={midY}
        text-anchor="start"
        dominant-baseline="central"
        font-family="ui-sans-serif, sans-serif"
        font-size={11}
        fill={MUTED}
      >
        head
      </text>
      <line
        x1={box.x + 32}
        y1={midY}
        x2={endX - 6}
        y2={midY}
        stroke={MUTED}
        stroke-width={2}
      />
      <polygon
        points={`${endX},${midY} ${endX - 8},${midY - 5} ${endX - 8},${midY + 5}`}
        fill={MUTED}
      />
    </g>
  );
};

export const renderers = {
  node,
  pointer,
  "head-pointer": headPointer,
};
