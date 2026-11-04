import type { Box, Camera, ID, Pose } from "./types";

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function lerpLog(a: number, b: number, t: number): number {
  if (a <= 0 || b <= 0) return lerp(a, b, t);
  return Math.exp(lerp(Math.log(a), Math.log(b), t));
}

function resolveEntryBox(_id: ID, box: Box, counterpart: Pose): Box {
  // Element exists in only one side. Look up enter_from / exit_to on the box
  // and use that element's position as the virtual counterpart; fall back to
  // the box's own position (pop in place) if no hint is set.
  const hint = box.enter_from ?? box.exit_to;
  if (hint !== undefined) {
    const src = counterpart.boxes.get(hint);
    if (src) {
      return {
        x: src.x + src.w / 2 - box.w / 2,
        y: src.y + src.h / 2 - box.h / 2,
        w: box.w,
        h: box.h,
        opacity: 0,
      };
    }
  }
  return { ...box, opacity: 0 };
}

function lerpBox(from: Box, to: Box, t: number): Box {
  const tween = from.tween_size === true || to.tween_size === true;
  return {
    x: lerp(from.x, to.x, t),
    y: lerp(from.y, to.y, t),
    w: tween ? lerp(from.w, to.w, t) : to.w,
    h: tween ? lerp(from.h, to.h, t) : to.h,
    opacity: lerp(from.opacity, to.opacity, t),
    tween_size: tween || undefined,
  };
}

export function lerpPose(from: Pose, to: Pose, t: number): Pose {
  const out: Pose = { boxes: new Map() };
  const seen = new Set<ID>();

  for (const [id, toBox] of to.boxes) {
    seen.add(id);
    const fromBox = from.boxes.get(id);
    if (fromBox) {
      out.boxes.set(id, lerpBox(fromBox, toBox, t));
    } else {
      // Pop-in: synthesize a from-box using enter_from hint.
      const synthetic = resolveEntryBox(id, toBox, from);
      out.boxes.set(id, lerpBox(synthetic, toBox, t));
    }
  }
  for (const [id, fromBox] of from.boxes) {
    if (seen.has(id)) continue;
    // Pop-out: synthesize a to-box using exit_to hint.
    const synthetic = resolveEntryBox(id, fromBox, to);
    out.boxes.set(id, lerpBox(fromBox, synthetic, t));
  }
  return out;
}

export function lerpCamera(from: Camera, to: Camera, t: number): Camera {
  return {
    cx: lerp(from.cx, to.cx, t),
    cy: lerp(from.cy, to.cy, t),
    zoom: lerpLog(from.zoom, to.zoom, t),
  };
}
