import pkg from "../package.json" with { type: "json" };
export const VERSION: string = pkg.version;

export { createPlayerSignal, type PlayerSignal } from "./player-signal";
export { Stage, type StageProps, type RenderElement } from "./stage";
