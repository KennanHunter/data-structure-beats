import { describe, expect, it } from "vitest";
import { compile, sample } from "@kennanhunter/data-structure-beats";
import {
  linkedListAdapter,
  nodeElId,
  ptrElId,
  HEAD_PTR_ID,
  NODE_W,
  HEAD_W,
  GAP,
} from "./adapter";
import { fixtures, insertMid, prepend5, removeMiddle } from "./fixtures";

describe("linked-list fixtures", () => {
  it("exports three fixtures with unique names", () => {
    const names = new Set(fixtures.map((f) => f.name));
    expect(names.size).toBe(3);
  });

  describe("prepend-5", () => {
    const op = prepend5.build();
    const tl = compile(linkedListAdapter, op);

    it("emits expected events", () => {
      // prepend emits (insert_node, rewire_next) per value → 2 events × 5 = 10 steps.
      expect(op.steps).toHaveLength(10);
      expect(op.steps[0].event.t).toBe("insert_node");
      expect(op.steps[1].event.t).toBe("rewire_next");
    });

    it("compiles to the same number of step groups", () => {
      expect(tl.steps).toHaveLength(10);
    });

    it("final snapshot has head pointing at the last-prepended node", () => {
      expect(op.final.head).not.toBeNull();
      // Values prepended were 1,2,3,4,5 → head.value should be 5.
      expect(op.final.nodes[op.final.head as number].value).toBe(5);
    });

    it("final frame has 5 node boxes at expected x positions", () => {
      const frame = sample(tl, tl.steps.length - 1, 1);
      // Walk the head chain in the final snapshot and check layout matches.
      let idx = 0;
      let cur = op.final.head;
      while (cur !== null) {
        const box = frame.pose.boxes.get(nodeElId(cur));
        expect(box, `node-${cur} missing from final pose`).toBeDefined();
        expect(box!.x).toBe(HEAD_W + GAP + idx * (NODE_W + GAP));
        expect(box!.y).toBe(0);
        cur = op.final.nodes[cur].next;
        idx++;
      }
      expect(idx).toBe(5);
    });

    it("head pointer is present in the final pose", () => {
      const frame = sample(tl, tl.steps.length - 1, 1);
      const headBox = frame.pose.boxes.get(HEAD_PTR_ID);
      expect(headBox).toBeDefined();
      expect(headBox!.x).toBe(0);
    });
  });

  describe("remove-middle", () => {
    const op = removeMiddle.build();
    const tl = compile(linkedListAdapter, op);

    it("walks until the predecessor then rewires + removes", () => {
      // Expected events: visit(head), visit(next), rewire_next, remove_node.
      // index=2 means walk prev to index 1 → 2 visits, then rewire+remove.
      const types = op.steps.map((s) => s.event.t);
      expect(types).toEqual([
        "visit",
        "visit",
        "rewire_next",
        "remove_node",
      ]);
    });

    it("final snapshot has 4 live nodes", () => {
      let count = 0;
      let cur = op.final.head;
      while (cur !== null) {
        count++;
        cur = op.final.nodes[cur].next;
      }
      expect(count).toBe(4);
    });

    it("removed node has opacity 0 in final frame (via exit_to)", () => {
      const frame = sample(tl, tl.steps.length - 1, 1);
      // Walk all boxes; exactly one should have opacity 0 (the removed node).
      const faded = [...frame.pose.boxes.values()].filter(
        (b) => b.opacity === 0,
      );
      expect(faded.length).toBe(1);
    });
  });

  describe("insert-mid", () => {
    const op = insertMid.build();
    const tl = compile(linkedListAdapter, op);

    it("walks + inserts + rewires", () => {
      const types = op.steps.map((s) => s.event.t);
      // index=1: walk prev to index 0 → 1 visit, then insert+rewire.
      expect(types).toEqual(["visit", "insert_node", "rewire_next"]);
    });

    it("final snapshot has 4 live nodes with 99 at index 1", () => {
      const values: number[] = [];
      let cur = op.final.head;
      while (cur !== null) {
        values.push(op.final.nodes[cur].value);
        cur = op.final.nodes[cur].next;
      }
      expect(values).toEqual([1, 99, 2, 3]);
    });

    it("pointer from the head's next position exists and spans the GAP", () => {
      const frame = sample(tl, tl.steps.length - 1, 1);
      // fromValues reverses: initial list [1,2,3] → id 0 has value 3, id 1
      // has value 2, id 2 has value 1 and is head. Insert 99 at index 1
      // adds id 3 after id 2, so head (id 2) now points at id 3.
      const ptr = frame.pose.boxes.get(ptrElId(op.final.head as number));
      expect(ptr).toBeDefined();
      expect(ptr!.w).toBeGreaterThan(0);
    });
  });

  it("sample continuity across step boundaries", () => {
    const tl = compile(linkedListAdapter, prepend5.build());
    for (let s = 0; s < tl.steps.length - 1; s++) {
      const end = sample(tl, s, 1);
      const start = sample(tl, s + 1, 0);
      for (const [id, boxA] of end.pose.boxes) {
        const boxB = start.pose.boxes.get(id);
        if (!boxB) continue;
        expect(boxA.x, `${id} x at (${s},1) vs (${s + 1},0)`).toBeCloseTo(
          boxB.x,
          5,
        );
      }
    }
  });
});
