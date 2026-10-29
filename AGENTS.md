# AGENTS.md

Conventions for agents working in this repository.

These are the patterns the library **shipped with in `v0.1.0`**. That tag is the baseline: when a rule here is ambiguous, read the code at `v0.1.0` rather than inventing a new shape. Recently agent-written code drifted from it — most of this file exists to prevent that.

## Repository shape

pnpm workspace:

- `app/` — the published library (`@ibnlanre/socket`) and its unit tests
- `docs/` — VitePress documentation site
- `tests/` — Playwright browser end-to-end suite

## `app/src` layout

Four layers, each with one job:

| Folder | Holds | Shape |
| --- | --- | --- |
| `class/` | one class per folder | `class/<kebab-name>/index.ts`, tests colocated |
| `functions/` | one function or hook per folder | `functions/<kebab-name>/index.ts`, tests colocated |
| `constants/` | exported constants | `constants/<kebab-name>.ts` |
| `types/` | types, grouped by domain | `types/<domain>/<kebab-name>.ts`; flat `types/*.ts` for cross-cutting types |

`app/src/index.ts` is the **only** public barrel. `@/` resolves to `app/src`.

## Where does new code go?

| You are adding | It belongs in |
| --- | --- |
| A class | its own folder under `class/` — never inside another class's module |
| A constant used by a class | `constants/<name>.ts` — never a `const` at the top of a `class/` module |
| A function used by a class but meaningful on its own | `functions/<name>/` |
| An exported option/constructor type (`XOptions`, `XConstructor`) | `types/<domain>/…`, re-exported from `index.ts` when public |
| A type shared by two modules | `types/…`, even when it stays internal |
| A small type used by a single module | **inline in that module** — this is intentional, see `SocketCacheConstructor`, `Entry`/`Action`/`NotifyEvent`, `Waiting`/`Lane` |
| A test | beside the module it covers, as `<name>.test.ts(x)` |

Multiple related types in one `types/` file is normal (`time-unit.ts`, `data-handling-options.ts`).

`class/socket/index.ts` is the one class file with module-level state and functions (`snapshots`, `storeSocketSnapshot`, `readSocketSnapshot`). That shape shipped in `v0.1.0`; don't extend it or copy it into new classes.

`app/src/runtime.test.ts` is the single integration test with no module of its own — it exercises public behaviour across modules in a Node environment. Don't create folders that exist only to hold a test.

## Code style

- `#private` fields; `#camelCase` private methods; public commands as arrow-function properties (`open = () => { ... }`).
- **Named exports only** — no `export default`.
- **Ordering is enforced** by `eslint-plugin-perfectionist` (`recommended-natural`, scoped to `app/src`): imports and exports, interface and object-type members, union types, class members, and object literals without a spread. Never hand-order any of it — run `pnpm exec eslint app/src --fix`. Imports sort type-first, then external named values, then internal `@/…` values, matching `~/Desktop/workspace/scouting`. An object literal containing a spread is left untouched, so spread-then-override objects keep their semantics.
- One concern per module. Anything public is reachable from `index.ts`; everything else stays internal.
- Comments explain *why*, not *what*; match the existing doc-comment tone.
- Keep each file's existing line endings. Do not reformat files wholesale — unrelated reflow obscures review.

## Anti-patterns seen in this repo

These were all introduced by agents and had to be undone:

- a `const` added to a `class/` module (`SocketReadyState`, `NATIVE_UNSUPPORTED_INIT`, `CacheEncodingHeader`)
- a second class defined inside `class/socket-cache/index.ts` (`MemoryCache`)
- an `export interface` declared in `class/` (`SocketGateOptions`)
- a folder (`app/src/runtime/`) containing only a test
- rewriting line endings across ~17 unrelated files

## Verification

Run these before reporting work as done:

```bash
app/node_modules/.bin/tsc --noEmit -p app/tsconfig.json
cd app && npx vitest --run
pnpm exec eslint app/src --fix
npx playwright test tests/socket-library.spec.ts
pnpm --filter @ibnlanre/socket-docs build
```

Notes:

- Use the compiler binary directly; `pnpm exec tsc` can print pnpm wrapper output and finish without typechecking.
- The **root** `pnpm typecheck` is pre-existing broken (unconfigured `tsc --init` tsconfig). The gate is the app-scoped one above.
- Playwright reuses an existing server on port **4173**. Never run the docs preview there during e2e.
- For a runtime regression test, prove it fails first: `git stash push -- <source file>`, run, `git stash pop`.

## Git and review

- The user stages changes routinely to review diffs. Staged files are not a signal to commit.
- **Do not commit, tag, or push unless explicitly asked.**
- Stage selectively per logical change; keep formatter-only changes out of feature changes.
- Before committing, check `git status --short` for pre-staged files and use `git diff --ignore-cr-at-eol` to separate real changes from line-ending noise.

## Publishing

`app/package.json` is the published manifest. `prepublishOnly` builds the bundle, so `dist/` is never stale. Publish cwd-independently:

```bash
npm publish /absolute/path/to/app --access public
```

The scoped publish requires an authenticated session and browser 2FA. A `202 Accepted` is **not** proof the version is live — confirm against the registry (`curl -s https://registry.npmjs.org/@ibnlanre/socket`) before announcing a release.
