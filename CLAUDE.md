# on-vault — Claude Context

## What this project is

A Next.js + Fumadocs app that lets anyone clone the repo, point it at their Obsidian vault, and get a published documentation/notes site. Notes live in Google Drive (never in GitHub). The site is rebuilt from Drive content on every deploy.

Target users: the repo owner (Thom) and any other dev who clones it and configures their own vault.

---

## Architecture

```
Obsidian Vault (local)
      ↕  npm run sync          (scripts/sync.ts — one-way: vault → Drive)
Google Drive folder
      ↓  npm run fetch         (scripts/fetch-content.ts — Drive → .vault-cache/)
fumadocs-obsidian fromVault()  (.vault-cache/ → content/{base_path}/ + public/vault/)
      ↓  fumadocs-mdx          (generates .source/ type collections)
      ↓  next build
Published site (Vercel / any host)
```

**Why this shape:**
- Notes never in git → `content/*/` and `public/vault/` are gitignored
- `on-vault.yaml` is also gitignored (user copies from `.example`)
- `fromVault()` handles wikilinks, callouts, image embeds, .md→.mdx conversion
- The internal Next.js route is always `/docs/[[...slug]]`; if `base_path ≠ docs`, `next.config.mjs` adds a transparent rewrite `/{base_path}/* → /docs/*`

---

## Config system

**`on-vault.yaml`** (gitignored, user creates from `on-vault.yaml.example`):
```yaml
site:
  title: My Knowledge Base
  base_path: docs          # controls URL prefix AND content folder name

vault:
  path: ~/Documents/MyVault   # local Obsidian vault path

google_drive:
  folder_id: XXXXXXXXXXXXXXX  # Drive folder ID (not a secret)
```

**`.env`** (gitignored, user creates from `.env.example`):
```
GOOGLE_SERVICE_ACCOUNT_JSON={"type":"service_account",...}
```

**How `base_path` propagates:**
- `source.config.ts` reads `on-vault.yaml` synchronously via `js-yaml` → sets `dir: content/{base_path}`
- `next.config.mjs` reads `on-vault.yaml` → sets `env.NEXT_PUBLIC_BASE_PATH` and adds rewrite if needed
- `src/lib/source.ts` uses `process.env.NEXT_PUBLIC_BASE_PATH ?? 'docs'` for `baseUrl`
- Scripts (`sync.ts`, `fetch-content.ts`) use `scripts/config.ts` → `loadConfig()`

---

## Key files

```
scripts/
  config.ts          — loadConfig() / getBasePath(), reads on-vault.yaml with js-yaml
  drive.ts           — shared Google Drive utilities (auth, list, upload, download)
  sync.ts            — vault → Drive sync (diff by mtime, preserves folder hierarchy)
  fetch-content.ts   — Drive → .vault-cache/ → fromVault() → content/{base_path}/

source.config.ts     — fumadocs-mdx collection config; dir is dynamic from on-vault.yaml;
                       adds remark-math + rehype-katex for LaTeX

src/lib/source.ts    — Fumadocs loader; baseUrl from NEXT_PUBLIC_BASE_PATH
src/mdx-components.tsx — adds ObsidianCallout components from fumadocs-obsidian/ui
src/app/docs/layout.tsx — imports katex/dist/katex.min.css for math rendering
next.config.mjs      — reads on-vault.yaml; sets NEXT_PUBLIC_BASE_PATH env;
                       adds rewrite if base_path ≠ 'docs'
```

---

## Build pipeline (in order)

```bash
# 1. Fetch vault content from Drive
tsx scripts/fetch-content.ts
#    → downloads all files to .vault-cache/
#    → runs fromVault() → content/{base_path}/ + public/vault/
#    → generates default index.mdx if vault has no index.md
#    → deletes .vault-cache/

# 2. Generate Fumadocs type collections
fumadocs-mdx

# 3. Next.js build
next build
```

All three steps are wired into `npm run build`. For local dev, run `npm run fetch` first, then `npm run dev`.

---

## npm scripts

| Command | What it does |
|---|---|
| `npm run sync` | Upload local vault → Google Drive (one-way, diff by mtime) |
| `npm run fetch` | Download Drive → content/ (via fromVault) |
| `npm run build` | fetch + fumadocs-mdx + next build (full deploy pipeline) |
| `npm run dev` | Next.js dev server (run `fetch` first to populate content/) |

---

## Google Drive auth (Service Account)

1. Google Cloud Console → IAM & Admin → Service Accounts → create
2. Create JSON key → paste as `GOOGLE_SERVICE_ACCOUNT_JSON` in `.env`
3. Share the Drive folder with the service account email
4. Put the folder ID in `on-vault.yaml` under `google_drive.folder_id`

**Why Service Account (not OAuth2):** works headlessly in CI/CD with no interactive login; straightforward for other devs to replicate.

---

## fumadocs-obsidian integration

**Package:** `fumadocs-obsidian@0.1.0` (experimental, may have breaking changes)

**What `fromVault()` handles:**
- `[[wikilinks]]` → proper links
- `> [!note]` callouts → `ObsidianCallout` JSX components
- `![[image.png]]` embeds → copies to `public/vault/`, rewrites to `![](/vault/image.png)`
- `.md` → `.mdx` conversion (`enforceMdx: true` default)
- Filename slugification (`outputPath: 'simple'` default, e.g. `My Note.md` → `my-note.mdx`)

**Key API:**
```typescript
await fromVault({
  dir: '.vault-cache',
  out: {
    contentDir: 'content/docs',   // matches source.config.ts dir
    publicDir: 'public/vault',    // gitignored; assets served at /vault/*
  },
  convert: {
    url: (outputPath) => `/vault/${outputPath}`,
  },
});
```

**Critical gotcha — ESM-only package:**
`fumadocs-obsidian` ships ESM only (`"main": null`, exports only `"import"` condition).
`tsx` runs `.ts` scripts as CJS (no `"type": "module"` in package.json).
Static `import { fromVault }` fails at runtime with `ERR_PACKAGE_PATH_NOT_EXPORTED`.
**Fix:** use dynamic `import()` inside the async function — Node.js CJS can call `import()` which uses the ESM loader:
```typescript
const { fromVault } = await import('fumadocs-obsidian');
```
Do NOT change this back to a static import unless you add `"type": "module"` to `package.json`.

**UI components** (`fumadocs-obsidian/ui`) are imported statically in `src/mdx-components.tsx` — that's fine because Next.js's bundler handles ESM correctly.

---

## Math (LaTeX) support

- **Packages:** `remark-math` + `rehype-katex` + `katex` (all in dependencies)
- **Wired in `source.config.ts`:**
  ```typescript
  remarkPlugins: [remarkMath],
  rehypePlugins: (v) => [rehypeKatex, ...v],
  ```
- **CSS:** `import 'katex/dist/katex.min.css'` in `src/app/docs/layout.tsx`
- Use `$...$` for inline math, `$$...$$` for block math in Obsidian notes

---

## Gitignored (generated at build/runtime)

```
content/*/        — vault notes (any base_path)
public/vault/     — vault assets (images etc) from fumadocs-obsidian
.vault-cache/     — temp download dir during fetch-content
.env              — credentials
on-vault.yaml     — user config
```

---

## Phase status

| Phase | Status | Summary |
|---|---|---|
| 1 — Foundation & Config | ✅ | on-vault.yaml, .env, gitignore, dynamic base_path, math plugins |
| 2 — CLI Sync | ✅ | scripts/sync.ts: vault → Drive, diff by mtime, preserves folders |
| 3 — Pre-build fetch | ✅ | scripts/fetch-content.ts: Drive → .vault-cache → fromVault → content/ |
| 4 — fumadocs-obsidian | ✅ | fromVault integration, ObsidianCallout, katex CSS |
| 5 — DX & README | 🔲 | README with setup guide, YAML example, GitHub Actions example |

---

## Remaining work (Phase 5)

- README.md: end-to-end setup guide (Google Cloud setup, clone → configure → sync → deploy)
- GitHub Actions example for automated deploy on push
- Consider: auth layer (the owner mentioned wanting simple auth in the future — planned but not in current scope)
