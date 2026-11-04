export type BaseEvent = { t: string };

export type ScopeFrame = {
  id: number;
  kind: string;
  data?: unknown;
};

export type Step<E extends BaseEvent, S> = {
  event: E;
  snapshot: S;
  scopes: readonly ScopeFrame[];
};

export type ScopeRecord = {
  id: number;
  kind: string;
  parent?: number;
  first: number;
  last: number;
};

export type Operation<E extends BaseEvent, S> = {
  kind: string;
  request: unknown;
  steps: Step<E, S>[];
  scopes: ScopeRecord[];
  initial: S;
  final: S;
};

export type OperationInput<S> = {
  kind: string;
  request?: unknown;
  snapshot: () => S;
};

export interface Recorder<E extends BaseEvent> {
  emit<T extends E["t"]>(
    t: T,
    payload: Omit<Extract<E, { t: T }>, "t">,
  ): void;
  scope(kind: string, data?: unknown): Disposable;
  scope<R>(kind: string, data: unknown, body: () => R): R;
  mutate<R>(fn: () => R): R;
}

type MutableScope = {
  id: number;
  kind: string;
  data?: unknown;
  parent?: number;
  first: number;
  last: number;
  open: boolean;
};

export function operation<E extends BaseEvent, S>(
  input: OperationInput<S>,
  body: (rec: Recorder<E>) => void,
): Operation<E, S> {
  const steps: Step<E, S>[] = [];
  const scopes: MutableScope[] = [];
  const stack: MutableScope[] = [];
  let scopeIdSeq = 0;
  const initialSnapshot: S = input.snapshot();
  let cachedSnapshot: S | undefined = initialSnapshot;
  let dirty = false;

  const getSnapshot = (): S => {
    if (dirty) {
      cachedSnapshot = input.snapshot();
      dirty = false;
    }
    return cachedSnapshot as S;
  };

  const openScope = (kind: string, data?: unknown): MutableScope => {
    const parent = stack[stack.length - 1];
    const sc: MutableScope = {
      id: scopeIdSeq++,
      kind,
      data,
      parent: parent?.id,
      first: steps.length,
      last: steps.length - 1,
      open: true,
    };
    scopes.push(sc);
    stack.push(sc);
    return sc;
  };

  const closeScope = (sc: MutableScope): void => {
    if (!sc.open) {
      throw new Error(`scope ${sc.kind}#${sc.id} already closed`);
    }
    const top = stack[stack.length - 1];
    if (top !== sc) {
      throw new Error(
        `scope close out of order: closing ${sc.kind}#${sc.id} but top is ${top?.kind}#${top?.id}`,
      );
    }
    sc.open = false;
    stack.pop();
  };

  const rec: Recorder<E> = {
    emit(t, payload) {
      const event = { t, ...payload } as unknown as E;
      const snapshot = getSnapshot();
      const scopeFrames: ScopeFrame[] = stack.map((s) => ({
        id: s.id,
        kind: s.kind,
        data: s.data,
      }));
      const stepIndex = steps.length;
      steps.push({ event, snapshot, scopes: scopeFrames });
      for (const s of stack) s.last = stepIndex;
    },
    scope: ((kind: string, data?: unknown, bodyFn?: () => unknown) => {
      const sc = openScope(kind, data);
      if (bodyFn) {
        try {
          return bodyFn();
        } finally {
          closeScope(sc);
        }
      }
      return {
        [Symbol.dispose]: () => closeScope(sc),
      } as Disposable;
    }) as Recorder<E>["scope"],
    mutate(fn) {
      const result = fn();
      dirty = true;
      return result;
    },
  };

  body(rec);

  if (stack.length > 0) {
    const open = stack.map((s) => `${s.kind}#${s.id}`).join(", ");
    throw new Error(`operation ended with open scopes: ${open}`);
  }

  // Drop empty scopes (first > last).
  const kept = scopes.filter((s) => s.first <= s.last);
  const scopeRecords: ScopeRecord[] = kept.map((s) => ({
    id: s.id,
    kind: s.kind,
    parent: s.parent,
    first: s.first,
    last: s.last,
  }));

  return {
    kind: input.kind,
    request: input.request,
    steps,
    scopes: scopeRecords,
    initial: initialSnapshot,
    final: getSnapshot(),
  };
}
