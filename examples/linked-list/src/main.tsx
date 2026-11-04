import { render } from "solid-js/web";
import { VERSION } from "@kennanhunter/data-structure-beats";

function App() {
  return (
    <main style={{ "font-family": "sans-serif", padding: "2rem" }}>
      <h1>linked-list demo</h1>
      <p>beats core version: {VERSION}</p>
      <p>Phase 1 will replace this with a live animated linked list.</p>
    </main>
  );
}

render(() => <App />, document.getElementById("root")!);
