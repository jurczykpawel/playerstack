# Contributing to Playerstack

Thanks for considering a contribution. Playerstack is a young OSS project — bug reports, design feedback, and pull requests are all welcome.

## Quick start

```sh
git clone https://github.com/jurczykpawel/playerstack.git
cd playerstack
bun install
bun run --cwd apps/playground dev   # http://localhost:5180
bun run test                        # all packages
```

## Project layout

- `packages/core` — engine wrapper, `<player-stack>` custom element, plugin runtime
- `packages/plugin-*` — first-party plugins (sources, controls-policy, autopreview, branded-thumb, cta-end, sellf-adapter)
- `packages/embed` — standalone UMD/ESM/CJS bundle (`playerstack` on npm)
- `apps/playground` — local Vite dev demo
- `apps/docs` — Astro site for [playerstack.sellf.app](https://playerstack.sellf.app)
- `tests/e2e` — Playwright suite

## Strict TDD

This project uses **strict TDD** for everything in `packages/*/src/`. Workflow:

1. Write a failing test (`*.test.ts` next to the source)
2. Run `bun test --cwd packages/<pkg>` — confirm it fails for the right reason
3. Write the minimal implementation to pass
4. Re-run, confirm green
5. Refactor only when green

**Exempt from strict TDD:** build configs (esbuild, vite, astro), Astro pages, READMEs.

See `AGENTS.md` for the full project rules.

## Pull requests

1. **Open an issue first** for non-trivial changes — saves you time if the direction isn't a fit
2. **Branch from `main`**, name it `feat/...`, `fix/...`, `docs/...`
3. **Commits**: short imperative subject (`feat(plugin-cta-end): support custom CSS class`), wrap body at 72 chars
4. **Tests**: every new public function or plugin needs tests. CI must be green
5. **Type check & lint** must pass: `bun run typecheck && bun run lint`
6. **Update the CHANGELOG** under "Unreleased" if your change is user-visible
7. **Squash before merge** — one commit per PR

## Plugin design rules

- **Pure where possible**: extract pure logic (URL parsing, CSS generation, config validation) into a separate file with its own tests. The plugin shape is a thin wrapper.
- **Per-context state via WeakMap**: never use module-level mutable state. See `packages/plugin-controls-policy/src/index.ts` for the canonical pattern.
- **No DOM mutation outside `init`/`destroy`**: plugins should not poke at `mediaPlayer` from event handlers — wire up listeners inside `init` and remove them inside `destroy`.
- **Document every config field**: every `*Config` interface must be reflected in the plugin's README and `/docs/plugins/<name>.md` page.

## Testing

- Unit tests: Vitest + happy-dom, run via `bun run test`
- E2E: Playwright via `bun run test:e2e`
- Add a Playwright case in `tests/e2e/embed.spec.ts` for any plugin that produces visible DOM

## Style

- TypeScript strict, ES2020 target — see `tsconfig.json`
- Prettier formats `bun run format`
- No emoji in code
- Comments only when WHY is non-obvious

## License

By contributing you agree your code ships under MIT (the project's license).

## Code of conduct

Be kind. Disagree on ideas, not people. The maintainer reserves the right to remove abusive comments and ban repeat offenders.

## Questions

Open a [GitHub Discussion](https://github.com/jurczykpawel/playerstack/discussions) for design questions, or an issue for bugs.
