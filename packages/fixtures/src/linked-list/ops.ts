import type { Recorder } from "@kennanhunter/data-structure-beats";
import type { LinkedList, NodeId } from "./domain";
import type { LLEvent } from "./events";

export function prepend(
  list: LinkedList,
  value: number,
  rec: Recorder<LLEvent>,
): void {
  const newId = list.nodes.length;
  const oldHead = list.head;
  rec.mutate(() => {
    list.nodes.push({ id: newId, value, next: oldHead });
    list.head = newId;
  });
  rec.emit("insert_node", { node_id: newId, after: null });
  rec.emit("rewire_next", { from_id: "head", new_next: newId });
}

export function append(
  list: LinkedList,
  value: number,
  rec: Recorder<LLEvent>,
): void {
  if (list.head === null) {
    prepend(list, value, rec);
    return;
  }
  let prev = list.head;
  while (list.nodes[prev].next !== null) {
    rec.emit("visit", { node_id: prev });
    prev = list.nodes[prev].next as NodeId;
  }
  rec.emit("visit", { node_id: prev });
  const newId = list.nodes.length;
  rec.mutate(() => {
    list.nodes.push({ id: newId, value, next: null });
    list.nodes[prev].next = newId;
  });
  rec.emit("insert_node", { node_id: newId, after: prev });
  rec.emit("rewire_next", { from_id: prev, new_next: newId });
}

export function insert_at(
  list: LinkedList,
  index: number,
  value: number,
  rec: Recorder<LLEvent>,
): void {
  if (index === 0 || list.head === null) {
    prepend(list, value, rec);
    return;
  }
  let prev = list.head;
  for (let i = 0; i < index - 1; i++) {
    rec.emit("visit", { node_id: prev });
    const n = list.nodes[prev].next;
    if (n === null) break;
    prev = n;
  }
  rec.emit("visit", { node_id: prev });
  const newId = list.nodes.length;
  const after = list.nodes[prev].next;
  rec.mutate(() => {
    list.nodes.push({ id: newId, value, next: after });
    list.nodes[prev].next = newId;
  });
  rec.emit("insert_node", { node_id: newId, after: prev });
  rec.emit("rewire_next", { from_id: prev, new_next: newId });
}

export function remove(
  list: LinkedList,
  index: number,
  rec: Recorder<LLEvent>,
): void {
  if (list.head === null) return;
  if (index === 0) {
    const target = list.head;
    const next = list.nodes[target].next;
    rec.emit("visit", { node_id: target });
    rec.mutate(() => {
      list.head = next;
    });
    rec.emit("rewire_next", { from_id: "head", new_next: next });
    rec.emit("remove_node", { node_id: target, prev: "head" });
    return;
  }
  let prev = list.head;
  for (let i = 0; i < index - 1; i++) {
    rec.emit("visit", { node_id: prev });
    const n = list.nodes[prev].next;
    if (n === null) return;
    prev = n;
  }
  rec.emit("visit", { node_id: prev });
  const target = list.nodes[prev].next;
  if (target === null) return;
  const next = list.nodes[target].next;
  rec.mutate(() => {
    list.nodes[prev].next = next;
  });
  rec.emit("rewire_next", { from_id: prev, new_next: next });
  rec.emit("remove_node", { node_id: target, prev });
}
