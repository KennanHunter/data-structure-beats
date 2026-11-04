import { operation, type Operation } from "@kennanhunter/data-structure-beats";
import { emptyList, fromValues, snapshot, type LinkedList } from "./domain";
import type { LLEvent } from "./events";
import { insert_at, prepend, remove } from "./ops";

export type LLFixture = {
  name: string;
  description: string;
  build(): Operation<LLEvent, LinkedList>;
};

export const prepend5: LLFixture = {
  name: "linked-list-prepend-5",
  description: "Prepend 1, 2, 3, 4, 5 to an empty list.",
  build() {
    const list = emptyList();
    return operation<LLEvent, LinkedList>(
      { kind: "prepend-5", snapshot: () => snapshot(list) },
      (rec) => {
        for (const v of [1, 2, 3, 4, 5]) prepend(list, v, rec);
      },
    );
  },
};

export const removeMiddle: LLFixture = {
  name: "linked-list-remove-middle",
  description: "Start with [1,2,3,4,5]; remove the node at index 2.",
  build() {
    const list = fromValues([1, 2, 3, 4, 5]);
    return operation<LLEvent, LinkedList>(
      { kind: "remove-middle", snapshot: () => snapshot(list) },
      (rec) => {
        remove(list, 2, rec);
      },
    );
  },
};

export const insertMid: LLFixture = {
  name: "linked-list-insert-mid",
  description: "Start with [1,2,3]; insert 99 at index 1.",
  build() {
    const list = fromValues([1, 2, 3]);
    return operation<LLEvent, LinkedList>(
      { kind: "insert-mid", snapshot: () => snapshot(list) },
      (rec) => {
        insert_at(list, 1, 99, rec);
      },
    );
  },
};

export const fixtures: LLFixture[] = [prepend5, removeMiddle, insertMid];
