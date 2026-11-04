import { sample } from "@kennanhunter/data-structure-beats";
import { compileFixture } from "./fixtures";
import { formatFrame } from "./format";

export function dump(name: string): string {
  const { op, tl, reg } = compileFixture(name);
  const out: string[] = [];
  out.push(`fixture: ${reg.name}`);
  out.push(`  ${reg.description}`);
  out.push(`steps: ${tl.steps.length}  step_ms: ${tl.step_ms}`);
  out.push("");
  for (let i = 0; i < tl.steps.length; i++) {
    const scene = tl.scenes[i];
    const kinds = new Map<string, string>();
    for (const el of scene.elements.values()) kinds.set(el.id, el.kind);
    const event = op.steps[i].event.t;
    const duration = tl.durations[i];
    out.push(
      formatFrame(`step ${i} [${event}]  duration=${duration}ms`, sample(tl, i, 1), kinds),
    );
    out.push("");
  }
  return out.join("\n");
}
