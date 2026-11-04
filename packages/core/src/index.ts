export const VERSION = "0.0.0";

export type {
  ID,
  Box,
  Element,
  Scene,
  Pose,
  Refs,
  Override,
  Ease,
  Beat,
  Camera,
  CameraMode,
  Size,
  Bounds,
  Keyframe,
  Timeline,
  Frame,
} from "./types";
export { linear, easeOutCubic } from "./types";

export type {
  BaseEvent,
  ScopeFrame,
  Step,
  ScopeRecord,
  Operation,
  OperationInput,
  Recorder,
} from "./operation";
export { operation } from "./operation";

export type { Hierarchy } from "./resolve";
export { resolve, hierarchyFromScene, derivedBounds } from "./resolve";

export { lerp, lerpLog, lerpPose, lerpCamera } from "./lerp";

export type { Adapter, BeatCtx, CompileOpts } from "./compile";
export { compile, sample } from "./compile";

export type { Clock, Cursor, Player } from "./player";
export { createPlayer, defaultClock } from "./player";
