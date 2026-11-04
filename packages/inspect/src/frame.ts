import { sample } from "@kennanhunter/data-structure-beats";
import { compileFixture } from "./fixtures";

export function frame(name: string, step: number, t: number): string {
  const { tl } = compileFixture(name);
  const f = sample(tl, step, t);
  const scene = tl.scenes[step];
  const kinds = Object.fromEntries(
    [...scene.elements.values()].map((el) => [el.id, el.kind]),
  );
  return JSON.stringify(
    {
      step,
      t,
      camera: f.camera,
      size: f.size,
      kinds,
      pose: Object.fromEntries(
        [...f.pose.boxes.entries()].map(([id, box]) => [id, box]),
      ),
    },
    null,
    2,
  );
}
