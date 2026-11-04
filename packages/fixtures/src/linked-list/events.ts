import type { NodeId } from "./domain";

export type LLEvent =
  | { t: "visit"; node_id: NodeId }
  | { t: "insert_node"; node_id: NodeId; after: NodeId | null }
  | { t: "rewire_next"; from_id: NodeId | "head"; new_next: NodeId | null }
  | { t: "remove_node"; node_id: NodeId; prev: NodeId | "head" };
