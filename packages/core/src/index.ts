import pkg from "../package.json" with { type: "json" };
export const VERSION: string = pkg.version;

export type {
  ID,
  Box,
  Derived,
  Element,
  Scene,
  Pose,
  Refs,
  Override,
  Ease,
  Beat,
  Camera,
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
export {
  applyDerived,
  derivedBounds,
  hierarchyFromScene,
  resolve,
} from "./resolve";

export { lerp, lerpLog, lerpPose, lerpCamera } from "./lerp";

export type { Adapter, BeatCtx, CameraMode, CompileOpts } from "./compile";
export { compile, sample } from "./compile";
