export type NodeId = number;

export type LLNode = {
  id: NodeId;
  value: number;
  next: NodeId | null;
};

export type LinkedList = {
  nodes: LLNode[];
  head: NodeId | null;
};

export function emptyList(): LinkedList {
  return { nodes: [], head: null };
}

export function fromValues(values: number[]): LinkedList {
  const list: LinkedList = { nodes: [], head: null };
  for (let i = values.length - 1; i >= 0; i--) {
    const id = list.nodes.length;
    list.nodes.push({ id, value: values[i], next: list.head });
    list.head = id;
  }
  return list;
}

export function snapshot(list: LinkedList): LinkedList {
  return {
    nodes: list.nodes.map((n) => ({ ...n })),
    head: list.head,
  };
}

export function liveIds(list: LinkedList): NodeId[] {
  const out: NodeId[] = [];
  let cur = list.head;
  while (cur !== null) {
    out.push(cur);
    cur = list.nodes[cur].next;
  }
  return out;
}
