import { sample } from "@kennanhunter/data-structure-beats";
import { compileFixture } from "./fixtures";
import { formatFrame } from "./format";

export function trace(name: string, step: number): string {
  const { op, tl, reg } = compileFixture(name);
  if (step < 0 || step >= tl.steps.length) {
    throw new Error(`step ${step} out of range (0..${tl.steps.length - 1})`);
  }
  const scene = tl.scenes[step];
  const kinds = new Map<string, string>();
  for (const el of scene.elements.values()) kinds.set(el.id, el.kind);
  const event = op.steps[step].event.t;
  const out: string[] = [];
  out.push(`fixture: ${reg.name}`);
  out.push(`step ${step}  event=${event}  keyframes=${tl.steps[step].length}`);
  out.push("");
  const samples = [0, 0.25, 0.5, 0.75, 1];
  for (const t of samples) {
    out.push(formatFrame(`t=${t.toFixed(2)}`, sample(tl, step, t), kinds));
    out.push("");
  }
  return out.join("\n");
}
