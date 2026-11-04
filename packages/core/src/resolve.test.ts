import { describe, expect, it } from "vitest";
import { resolve, hierarchyFromScene } from "./resolve";
import type { Box, Override, Pose, Scene } from "./types";

function box(x: number, y: number, w = 10, h = 10, opacity = 1): Box {
  return { x, y, w, h, opacity };
}

function makeScene(parents: Record<string, string | undefined>): Scene {
  const elements = new Map();
  for (const [id, parent] of Object.entries(parents)) {
    elements.set(id, { id, kind: "x", parent });
  }
  return { elements };
}

function makePose(boxes: Record<string, Box>): Pose {
  const m = new Map<string, Box>();
  for (const [k, v] of Object.entries(boxes)) m.set(k, v);
  return { boxes: m };
}

describe("resolve", () => {
  const base = makePose({ a: box(0, 0), b: box(10, 0), c: box(20, 0) });
  const prev = makePose({ a: box(0, 0), b: box(10, 0), c: box(20, 0) });
  const scene = makeScene({ a: undefined, b: "a", c: "b" });
  const h = hierarchyFromScene(scene);

  it("applies set override", () => {
    const out = resolve(
      base,
      { base, prev },
      [{ id: "a", set: { x: 100 } }],
      h,
    );
    expect(out.boxes.get("a")!.x).toBe(100);
    expect(out.boxes.get("a")!.y).toBe(0);
  });

  it("applies offset override (self)", () => {
    const out = resolve(
      base,
      { base, prev },
      [{ id: "b", offset: { dx: 5, dy: 3 }, carry: "self" }],
      h,
    );
    expect(out.boxes.get("b")!.x).toBe(15);
    expect(out.boxes.get("b")!.y).toBe(3);
    expect(out.boxes.get("c")!.x).toBe(20);
  });

  it("applies offset override (subtree)", () => {
    const out = resolve(
      base,
      { base, prev },
      [{ id: "a", offset: { dx: 5, dy: 0 }, carry: "subtree" }],
      h,
    );
    expect(out.boxes.get("a")!.x).toBe(5);
    expect(out.boxes.get("b")!.x).toBe(15);
    expect(out.boxes.get("c")!.x).toBe(25);
  });

  it("applies like override from another pose", () => {
    const alt = makePose({ a: box(42, 7) });
    const out = resolve(
      base,
      { base, prev, alt },
      [{ id: "a", like: { pose: "alt" } }],
      h,
    );
    expect(out.boxes.get("a")!.x).toBe(42);
    expect(out.boxes.get("a")!.y).toBe(7);
  });

  it("like override with carry: subtree moves descendants by delta", () => {
    const alt = makePose({ a: box(10, 0) });
    const out = resolve(
      base,
      { base, prev, alt },
      [{ id: "a", like: { pose: "alt" }, carry: "subtree" }],
      h,
    );
    expect(out.boxes.get("b")!.x).toBe(20);
    expect(out.boxes.get("c")!.x).toBe(30);
  });

  it("hide sets opacity 0", () => {
    const out = resolve(base, { base, prev }, [{ id: "a", hide: true }], h);
    expect(out.boxes.get("a")!.opacity).toBe(0);
  });

  it("enter_from stores hint for lerp", () => {
    const out = resolve(
      base,
      { base, prev },
      [{ id: "a", enter_from: "b" }],
      h,
    );
    expect(out.boxes.get("a")!.enter_from).toBe("b");
  });

  it("tween_size flag is set", () => {
    const out = resolve(
      base,
      { base, prev },
      [{ id: "a", tween_size: true }],
      h,
    );
    expect(out.boxes.get("a")!.tween_size).toBe(true);
  });

  it("later overrides win", () => {
    const overrides: Override[] = [
      { id: "a", set: { x: 100 } },
      { id: "a", set: { x: 200 } },
    ];
    const out = resolve(base, { base, prev }, overrides, h);
    expect(out.boxes.get("a")!.x).toBe(200);
  });

  it("missing ref throws", () => {
    expect(() =>
      resolve(
        base,
        { base, prev },
        [{ id: "a", like: { pose: "nope" } }],
        h,
      ),
    ).toThrow(/unknown pose/);
  });
});
