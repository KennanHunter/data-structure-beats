import { describe, expect, it } from "vitest";
import { operation, type Recorder } from "./operation";

type TestEvent =
  | { t: "start" }
  | { t: "step"; n: number }
  | { t: "end" };

type TestSnapshot = { v: number };

function build(body: (rec: Recorder<TestEvent>) => void) {
  const state = { v: 0 };
  return operation<TestEvent, TestSnapshot>(
    {
      kind: "test",
      snapshot: () => ({ v: state.v }),
    },
    (rec) => {
      // Wrap mutate so the test body can bump state.v and the recorder picks
      // it up on next emit.
      const wrapped: Recorder<TestEvent> = {
        emit: rec.emit.bind(rec),
        scope: rec.scope.bind(rec),
        mutate: (fn) =>
          rec.mutate(() => {
            const r = fn();
            return r;
          }),
      };
      void state;
      body(wrapped);
    },
  );
}

describe("operation", () => {
  it("records events with current snapshot", () => {
    const state = { v: 0 };
    const op = operation<TestEvent, TestSnapshot>(
      { kind: "t", snapshot: () => ({ v: state.v }) },
      (rec) => {
        rec.emit("start", {});
        rec.mutate(() => {
          state.v = 1;
        });
        rec.emit("step", { n: 1 });
      },
    );
    expect(op.steps).toHaveLength(2);
    expect(op.steps[0].event.t).toBe("start");
    expect(op.steps[0].snapshot.v).toBe(0);
    expect(op.steps[1].event.t).toBe("step");
    expect(op.steps[1].snapshot.v).toBe(1);
  });

  it("scope with callback form closes on normal exit", () => {
    const op = build((rec) => {
      rec.scope("outer", undefined, () => {
        rec.emit("start", {});
      });
      rec.emit("end", {});
    });
    expect(op.scopes).toHaveLength(1);
    expect(op.scopes[0].first).toBe(0);
    expect(op.scopes[0].last).toBe(0);
  });

  it("scope with callback form closes on throw", () => {
    const state = { v: 0 };
    expect(() =>
      operation<TestEvent, TestSnapshot>(
        { kind: "t", snapshot: () => ({ v: state.v }) },
        (rec) => {
          rec.scope("outer", undefined, () => {
            rec.emit("start", {});
            throw new Error("boom");
          });
        },
      ),
    ).toThrow("boom");
  });

  it("nested scopes assign parent correctly", () => {
    const op = build((rec) => {
      rec.scope("outer", undefined, () => {
        rec.emit("start", {});
        rec.scope("inner", undefined, () => {
          rec.emit("step", { n: 1 });
        });
        rec.emit("end", {});
      });
    });
    const outer = op.scopes.find((s) => s.kind === "outer");
    const inner = op.scopes.find((s) => s.kind === "inner");
    expect(outer).toBeDefined();
    expect(inner).toBeDefined();
    expect(inner!.parent).toBe(outer!.id);
  });

  it("empty scopes are dropped", () => {
    const op = build((rec) => {
      rec.scope("outer", undefined, () => {
        // no emits inside
      });
      rec.emit("start", {});
    });
    expect(op.scopes).toHaveLength(0);
  });

  it("step carries the current scope stack", () => {
    const op = build((rec) => {
      rec.scope("a", undefined, () => {
        rec.scope("b", undefined, () => {
          rec.emit("start", {});
        });
      });
    });
    expect(op.steps[0].scopes.map((s) => s.kind)).toEqual(["a", "b"]);
  });

  it("using-form Disposable also works", () => {
    const op = build((rec) => {
      {
        using _s = rec.scope("outer");
        rec.emit("start", {});
      }
      rec.emit("end", {});
    });
    expect(op.scopes).toHaveLength(1);
    expect(op.scopes[0].kind).toBe("outer");
    expect(op.scopes[0].last).toBe(0);
  });
});
