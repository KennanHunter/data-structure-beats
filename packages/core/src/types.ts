export type ID = string;

export type Box = {
  x: number;
  y: number;
  w: number;
  h: number;
  opacity: number;
  tween_size?: boolean;
  enter_from?: ID;
  exit_to?: ID;
};

export type Element = {
  id: ID;
  kind: string;
  parent?: ID;
  data?: unknown;
};

export type Scene = {
  elements: Map<ID, Element>;
};

export type Pose = {
  boxes: Map<ID, Box>;
};

export type Refs = {
  base: Pose;
  prev: Pose;
  [name: string]: Pose;
};

export type Override =
  | { id: ID; set: Partial<Box> }
  | { id: ID; like: { pose: string; id?: ID }; carry?: "self" | "subtree" }
  | { id: ID; offset: { dx: number; dy: number }; carry?: "self" | "subtree" }
  | { id: ID; hide: true }
  | { id: ID; enter_from: ID }
  | { id: ID; exit_to: ID }
  | { id: ID; tween_size: true };

export type Ease = (t: number) => number;

export type Beat = {
  overrides: Override[];
  weight: number;
  ease?: Ease;
  focus?: ID[];
};

export type Camera = {
  cx: number;
  cy: number;
  zoom: number;
};

export type CameraMode = "fit" | "follow" | "overview";

export type Size = {
  width: number;
  height: number;
};

export type Bounds = {
  min_x: number;
  min_y: number;
  max_x: number;
  max_y: number;
};

export type Keyframe = {
  pose: Pose;
  camera: Camera;
  size: Size;
  weight: number;
  ease: Ease;
};

export type Timeline = {
  steps: Keyframe[][];
  scenes: Scene[];
  durations: number[];
  step_ms: number;
};

export type Frame = {
  pose: Pose;
  camera: Camera;
  size: Size;
};

export const linear: Ease = (t) => t;
export const easeOutCubic: Ease = (t) => 1 - Math.pow(1 - t, 3);
