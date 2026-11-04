import { linkedList } from "@beats/fixtures";
import {
  compile,
  type Adapter,
  type BaseEvent,
  type Operation,
  type Timeline,
} from "@kennanhunter/data-structure-beats";

type Registered = {
  name: string;
  description: string;
  adapter: Adapter<BaseEvent, unknown>;
  build(): Operation<BaseEvent, unknown>;
};

export function listFixtures(): { name: string; description: string }[] {
  return linkedList.fixtures.map((f) => ({
    name: f.name,
    description: f.description,
  }));
}

export function getFixture(name: string): Registered {
  const f = linkedList.fixtures.find((x) => x.name === name);
  if (!f) {
    const names = linkedList.fixtures.map((x) => x.name).join(", ");
    throw new Error(`unknown fixture "${name}". known: ${names}`);
  }
  return {
    name: f.name,
    description: f.description,
    adapter: linkedList.linkedListAdapter as Adapter<BaseEvent, unknown>,
    build: () => f.build() as Operation<BaseEvent, unknown>,
  };
}

export function compileFixture(name: string): {
  op: Operation<BaseEvent, unknown>;
  tl: Timeline;
  reg: Registered;
} {
  const reg = getFixture(name);
  const op = reg.build();
  const tl = compile(reg.adapter, op);
  return { op, tl, reg };
}
