# data-structure-beats

Framework-free animation library for data structure visualizations.

Status: pre-alpha. API is unstable. See `animation-library-plan.md` in the parent repo for the design.

## Packages

- `@kennanhunter/data-structure-beats` — core (operation recorder, resolve, lerp, compile, sample, player).
- `@kennanhunter/data-structure-beats-solid` — Solid.js binding.
- `@kennanhunter/data-structure-beats-kit` — shared visual building blocks (pointers, cells, cursors, layouts).

## Development

```
pnpm install
pnpm test
```

Examples live under `examples/`. The `linked-list` example is the first validator for the API.
