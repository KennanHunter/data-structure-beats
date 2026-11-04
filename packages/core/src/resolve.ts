import type { Box, ID, Override, Pose, Refs, Scene } from "./types";

export type Hierarchy = {
  children: Map<ID, ID[]>;
};

export function hierarchyFromScene(scene: Scene): Hierarchy {
  const children = new Map<ID, ID[]>();
  for (const el of scene.elements.values()) {
    if (el.parent === undefined) continue;
    const arr = children.get(el.parent);
    if (arr) arr.push(el.id);
    else children.set(el.parent, [el.id]);
  }
  return { children };
}

function descendants(hierarchy: Hierarchy, root: ID): ID[] {
  const out: ID[] = [];
  const stack: ID[] = [root];
  while (stack.length > 0) {
    const id = stack.pop() as ID;
    const kids = hierarchy.children.get(id);
    if (!kids) continue;
    for (const k of kids) {
      out.push(k);
      stack.push(k);
    }
  }
  return out;
}

function cloneBox(b: Box): Box {
  return { ...b };
}

function ensureBox(pose: Pose, id: ID): Box {
  let b = pose.boxes.get(id);
  if (!b) {
    b = { x: 0, y: 0, w: 0, h: 0, opacity: 1 };
    pose.boxes.set(id, b);
  }
  return b;
}

export function resolve(
  base: Pose,
  refs: Refs,
  overrides: readonly Override[],
  hierarchy: Hierarchy,
): Pose {
  const out: Pose = { boxes: new Map() };
  for (const [id, b] of base.boxes) out.boxes.set(id, cloneBox(b));

  for (const ov of overrides) {
    if ("set" in ov) {
      const b = ensureBox(out, ov.id);
      Object.assign(b, ov.set);
      continue;
    }
    if ("like" in ov) {
      const srcPose = refs[ov.like.pose];
      if (!srcPose) {
        throw new Error(`override 'like' references unknown pose '${ov.like.pose}'`);
      }
      const srcId = ov.like.id ?? ov.id;
      const srcBox = srcPose.boxes.get(srcId);
      if (!srcBox) {
        throw new Error(
          `override 'like' references unknown box '${srcId}' in pose '${ov.like.pose}'`,
        );
      }
      const prev = out.boxes.get(ov.id);
      const dx = prev ? srcBox.x - prev.x : 0;
      const dy = prev ? srcBox.y - prev.y : 0;
      out.boxes.set(ov.id, cloneBox(srcBox));
      if (ov.carry === "subtree" && prev) {
        for (const d of descendants(hierarchy, ov.id)) {
          const db = out.boxes.get(d);
          if (!db) continue;
          db.x += dx;
          db.y += dy;
        }
      }
      continue;
    }
    if ("offset" in ov) {
      const b = ensureBox(out, ov.id);
      b.x += ov.offset.dx;
      b.y += ov.offset.dy;
      if (ov.carry === "subtree") {
        for (const d of descendants(hierarchy, ov.id)) {
          const db = out.boxes.get(d);
          if (!db) continue;
          db.x += ov.offset.dx;
          db.y += ov.offset.dy;
        }
      }
      continue;
    }
    if ("hide" in ov) {
      const b = ensureBox(out, ov.id);
      b.opacity = 0;
      continue;
    }
    if ("enter_from" in ov) {
      const b = ensureBox(out, ov.id);
      b.enter_from = ov.enter_from;
      continue;
    }
    if ("exit_to" in ov) {
      const b = ensureBox(out, ov.id);
      b.exit_to = ov.exit_to;
      continue;
    }
    if ("tween_size" in ov) {
      const b = ensureBox(out, ov.id);
      b.tween_size = true;
      continue;
    }
  }

  return out;
}

export function derivedBounds(pose: Pose): {
  min_x: number;
  min_y: number;
  max_x: number;
  max_y: number;
} {
  let min_x = Infinity;
  let min_y = Infinity;
  let max_x = -Infinity;
  let max_y = -Infinity;
  for (const b of pose.boxes.values()) {
    if (b.opacity === 0) continue;
    if (b.x < min_x) min_x = b.x;
    if (b.y < min_y) min_y = b.y;
    if (b.x + b.w > max_x) max_x = b.x + b.w;
    if (b.y + b.h > max_y) max_y = b.y + b.h;
  }
  if (!Number.isFinite(min_x)) {
    return { min_x: 0, min_y: 0, max_x: 0, max_y: 0 };
  }
  return { min_x, min_y, max_x, max_y };
}
