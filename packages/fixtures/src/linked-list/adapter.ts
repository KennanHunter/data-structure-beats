import type {
  Adapter,
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

export const nodeElId = (id: NodeId): string => `node-${id}`;
export const ptrElId = (fromId: NodeId): string => `ptr-${fromId}`;
export const HEAD_PTR_ID = "head-ptr";

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
        });
      }
    }
    if (snap.head !== null) {
      elements.set(HEAD_PTR_ID, {
        id: HEAD_PTR_ID,
        kind: "head-pointer",
        data: { toId: snap.head },
      });
    }
    return { elements } as Scene;
  },

  layout(scene) {
    const boxes = new Map();
    // Determine index for each live node by walking scene order of node kinds.
    // Scene doesn't preserve traversal order per se — but we inserted in head→tail
    // order above, and Map iteration preserves insertion order.
    let idx = 0;
    const nodeIndex = new Map<NodeId, number>();
    for (const el of scene.elements.values()) {
      if (el.kind !== "node") continue;
      const nodeId = (el.data as { nodeId: NodeId }).nodeId;
      nodeIndex.set(nodeId, idx);
      const x = HEAD_W + GAP + idx * (NODE_W + GAP);
      boxes.set(el.id, { x, y: 0, w: NODE_W, h: NODE_H, opacity: 1 });
      idx++;
    }
    // Head pointer: sits in the left margin pointing at the head node.
    for (const el of scene.elements.values()) {
      if (el.kind !== "head-pointer") continue;
      boxes.set(el.id, {
        x: 0,
        y: (NODE_H - PTR_H) / 2,
        w: HEAD_W + GAP,
        h: PTR_H,
        opacity: 1,
      });
    }
    // Pointers: span from right edge of fromNode to left edge of toNode.
    for (const el of scene.elements.values()) {
      if (el.kind !== "pointer") continue;
      const { fromId, toId } = el.data as { fromId: NodeId; toId: NodeId };
      const fi = nodeIndex.get(fromId);
      const ti = nodeIndex.get(toId);
      if (fi === undefined || ti === undefined) continue;
      const fromX = HEAD_W + GAP + fi * (NODE_W + GAP) + NODE_W;
      const toX = HEAD_W + GAP + ti * (NODE_W + GAP);
      boxes.set(el.id, {
        x: fromX,
        y: (NODE_H - PTR_H) / 2,
        w: toX - fromX,
        h: PTR_H,
        opacity: 1,
      });
    }
    return { boxes } as Pose;
  },

  beats(ctx) {
    const event = ctx.step.event;
    switch (event.t) {
      case "visit": {
        // Minimal "highlight" placeholder — pulses the visited node by
        // nudging its opacity. Proper halo lands with the kit package later.
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
        const enterAnchor =
          event.after === null ? HEAD_PTR_ID : nodeElId(event.after);
        const overrides: Override[] = [
          { id: nodeElId(event.node_id), enter_from: enterAnchor },
        ];
        return [{ overrides, weight: 1 }];
      }
      case "rewire_next": {
        const ptrId =
          event.from_id === "head" ? HEAD_PTR_ID : ptrElId(event.from_id);
        return [
          {
            overrides: [{ id: ptrId, tween_size: true }],
            weight: 1,
          },
        ];
      }
      case "remove_node": {
        const exitAnchor =
          event.prev === "head" ? HEAD_PTR_ID : nodeElId(event.prev);
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
