import { createMemo, createSignal, For, Show } from "solid-js";
import { compile } from "@kennanhunter/data-structure-beats";
import {
  createPlayerSignal,
  Stage,
} from "@kennanhunter/data-structure-beats-solid";
import { linkedList } from "@beats/fixtures";
import { renderers } from "./renderers";

const { fixtures, linkedListAdapter } = linkedList;

const VIEW_W = 800;
const VIEW_H = 200;
const STEP_MS = 500;

export function App() {
  const [fixtureName, setFixtureName] = createSignal(fixtures[0].name);
  const current = createMemo(
    () => fixtures.find((f) => f.name === fixtureName()) ?? fixtures[0],
  );

  return (
    <main
      style={{
        "font-family": "ui-sans-serif, sans-serif",
        padding: "2rem",
        "max-width": "960px",
        margin: "0 auto",
      }}
    >
      <h1 style={{ "font-size": "1.4rem", margin: "0 0 0.25rem" }}>
        linked-list demo
      </h1>
      <p style={{ color: "#6e7781", margin: "0 0 1rem" }}>
        First fixture validating the beats pipeline end to end.
      </p>

      <div style={{ display: "flex", gap: "0.75rem", "margin-bottom": "1rem" }}>
        <For each={fixtures}>
          {(f) => (
            <label
              style={{
                display: "flex",
                "align-items": "center",
                gap: "0.25rem",
                cursor: "pointer",
              }}
            >
              <input
                type="radio"
                name="fixture"
                checked={fixtureName() === f.name}
                onChange={() => setFixtureName(f.name)}
              />
              <span>{f.name}</span>
            </label>
          )}
        </For>
      </div>

      <p style={{ color: "#6e7781", margin: "0 0 0.5rem" }}>
        {current().description}
      </p>

      <Show when={current()} keyed>
        {(fixture) => <Player fixture={fixture} />}
      </Show>
    </main>
  );
}

function Player(props: { fixture: linkedList.LLFixture }) {
  const op = props.fixture.build();
  const timeline = compile(linkedListAdapter, op, {
    step_ms: STEP_MS,
    viewport: { width: VIEW_W, height: VIEW_H },
  });
  const player = createPlayerSignal(timeline);
  const stepCount = timeline.steps.length;

  const scrubValue = () => player.step() + player.t();
  const onScrub = (e: Event) => {
    const v = parseFloat((e.currentTarget as HTMLInputElement).value);
    const step = Math.min(stepCount - 1, Math.floor(v));
    const t = Math.min(1, v - step);
    if (player.playing()) player.pause();
    player.seek(step, t);
  };

  const currentEvent = () => op.steps[player.step()]?.event.t ?? "—";

  return (
    <div>
      <div
        style={{
          border: "1px solid #d0d7de",
          "border-radius": "6px",
          padding: "12px",
          background: "#fbfcfe",
        }}
      >
        <Stage
          player={player}
          renderers={renderers}
          width={VIEW_W}
          height={VIEW_H}
        />
      </div>

      <div
        style={{
          display: "flex",
          "align-items": "center",
          gap: "0.75rem",
          "margin-top": "0.75rem",
        }}
      >
        <button
          type="button"
          onClick={() => (player.playing() ? player.pause() : player.play())}
          style={{ padding: "0.35rem 0.9rem" }}
        >
          {player.playing() ? "pause" : "play"}
        </button>
        <input
          type="range"
          min={0}
          max={stepCount - 1}
          step={0.01}
          value={scrubValue()}
          onInput={onScrub}
          style={{ flex: "1" }}
        />
        <span
          style={{ "font-family": "ui-monospace, monospace", "min-width": "6ch" }}
        >
          {player.step()}/{stepCount - 1}
        </span>
      </div>
      <p
        style={{
          "font-family": "ui-monospace, monospace",
          color: "#6e7781",
          margin: "0.5rem 0 0",
        }}
      >
        event: {currentEvent()}
      </p>
    </div>
  );
}
