import type {
  Adapter,
  Box,
  Override,
  Pose,
  Scene,
} from "@kennanhunter/data-structure-beats";
import type { LinkedList, NodeId } from "./domain";
import { liveIds } from "./domain";
import type { LLEvent } from "./events";

export const NODE_W = 60;
export const NODE_H = 40;
export const GAP = 32;
export const HEAD_W = 24;
export const PTR_H = 4;
// Two-row layout:
//   row 0 — staging area where incoming nodes appear before dropping down.
//   row 1 — the list itself (and the head pointer).
// ROW_H is the vertical stride between row centers; ROW_Y gives the y
// coordinate of a given row's top edge.
export const ROW_H = NODE_H + 28;
const ROW_Y = (row: number): number => row * ROW_H;
const LIST_ROW = 1;
const STAGING_ROW = 0;
const ABOVE_DY = ROW_Y(STAGING_ROW) - ROW_Y(LIST_ROW);
const SLIDE_DX = NODE_W + GAP;

export const nodeElId = (id: NodeId): string => `node-${id}`;
export const ptrElId = (fromId: NodeId): string => `ptr-${fromId}`;
export const HEAD_PTR_ID = "head-ptr";
const HEAD_ANCHOR_ID = "head-anchor";

// Pointer geometry comes from its endpoints. Both regular pointers and the
// head pointer use the same compute: x spans from the left anchor's right
// edge to the right anchor's left edge. If the endpoints overlap or cross
// (mid-animation during a slide-apart) the pointer fades out so it doesn't
// render as a backwards arrow.
const spanBetween = (own: Box, deps: Box[]): Partial<Box> => {
  const [from, to] = deps;
  const fromRight = from.x + from.w;
  const span = to.x - fromRight;
  // Also: a pointer inherits the lower opacity of its endpoints, so a
  // pop-in node drags its outgoing arrow in at the same rate.
  const endpointOpacity = Math.min(from.opacity, to.opacity);
  const geometryOpacity = span > 0 ? 1 : 0;
  return {
    x: fromRight,
    w: Math.max(0, span),
    y: own.y,
    h: own.h,
    opacity: own.opacity * endpointOpacity * geometryOpacity,
  };
};

export const linkedListAdapter: Adapter<LLEvent, LinkedList> = {
  scene(snap) {
    const elements = new Map();
    const ids = liveIds(snap);
    for (const id of ids) {
      elements.set(nodeElId(id), {
        id: nodeElId(id),
        kind: "node",
        data: { value: snap.nodes[id].value, nodeId: id },
      });
      const next = snap.nodes[id].next;
      if (next !== null) {
        elements.set(ptrElId(id), {
          id: ptrElId(id),
          kind: "pointer",
          data: { fromId: id, toId: next },
          derived: {
            deps: [nodeElId(id), nodeElId(next)],
            compute: spanBetween,
          },
        });
      }
    }
    if (snap.head !== null) {
      // A zero-width anchor at x=0 gives the head pointer a "from" element
      // so it uses the same derived span as regular pointers.
      elements.set(HEAD_ANCHOR_ID, {
        id: HEAD_ANCHOR_ID,
        kind: "head-anchor",
      });
      elements.set(HEAD_PTR_ID, {
        id: HEAD_PTR_ID,
        kind: "head-pointer",
        data: { toId: snap.head },
        derived: {
          deps: [HEAD_ANCHOR_ID, nodeElId(snap.head)],
          compute: spanBetween,
        },
      });
    }
    return { elements } as Scene;
  },

  layout(scene) {
    const boxes = new Map();
    const listY = ROW_Y(LIST_ROW);
    const ptrY = listY + (NODE_H - PTR_H) / 2;
    let idx = 0;
    for (const el of scene.elements.values()) {
      if (el.kind !== "node") continue;
      const x = HEAD_W + GAP + idx * (NODE_W + GAP);
      boxes.set(el.id, { x, y: listY, w: NODE_W, h: NODE_H, opacity: 1 });
      idx++;
    }
    // Head anchor: zero-width point at x=0, aligned with the list row.
    if (scene.elements.has(HEAD_ANCHOR_ID)) {
      boxes.set(HEAD_ANCHOR_ID, {
        x: 0,
        y: ptrY,
        w: 0,
        h: PTR_H,
        opacity: 0,
      });
    }
    // Pointers and head pointer: layout seeds y/h/tween_size; derived
    // recomputes x/w.
    for (const el of scene.elements.values()) {
      if (el.kind !== "pointer" && el.kind !== "head-pointer") continue;
      boxes.set(el.id, {
        x: 0,
        y: ptrY,
        w: 0,
        h: PTR_H,
        opacity: 1,
        tween_size: true,
      });
    }
    return { boxes } as Pose;
  },

  beats(ctx) {
    const event = ctx.step.event;
    switch (event.t) {
      case "visit": {
        const overrides: Override[] = [
          { id: nodeElId(event.node_id), set: { opacity: 0.6 } },
        ];
        return [
          { overrides, weight: 0.5 },
          {
            overrides: [{ id: nodeElId(event.node_id), set: { opacity: 1 } }],
            weight: 0.5,
          },
        ];
      }
      case "insert_node": {
        // Siblings right of the slot slide left back to their pre-insertion
        // positions (beat 1). New node appears above its final slot. Then
        // everything settles to base (beat 2) — siblings slide right, new
        // node drops in. Pointers auto-track their endpoints via derived
        // compute: no hide/show gymnastics needed.
        const snap = ctx.step.snapshot;
        const order: NodeId[] = [];
        let cur = snap.head;
        while (cur !== null) {
          order.push(cur);
          cur = snap.nodes[cur].next;
        }
        const insertIdx = order.indexOf(event.node_id);
        if (insertIdx < 0) return [{ overrides: [], weight: 1 }];

        const beat1: Override[] = [
          { id: nodeElId(event.node_id), offset: { dx: 0, dy: ABOVE_DY } },
        ];
        for (let i = insertIdx + 1; i < order.length; i++) {
          beat1.push({
            id: nodeElId(order[i]),
            offset: { dx: -SLIDE_DX, dy: 0 },
          });
        }

        return [
          { overrides: beat1, weight: 1 },
          { overrides: [], weight: 1 },
        ];
      }
      case "rewire_next": {
        // Pointers already auto-track their endpoints; this event is a step
        // of its own only to give the viewer a beat to register that the
        // link changed. No override needed.
        return [{ overrides: [], weight: 1 }];
      }
      case "remove_node": {
        const exitAnchor =
          event.prev === "head" ? HEAD_ANCHOR_ID : nodeElId(event.prev);
        return [
          {
            overrides: [{ id: nodeElId(event.node_id), exit_to: exitAnchor }],
            weight: 1,
          },
        ];
      }
    }
  },
};
