# on-vault

Publish your [Obsidian](https://obsidian.md) vault as a documentation site. Notes sync to Google Drive and are fetched at build time — they never live in your GitHub repository.

## How it works

```
Obsidian Vault (local)
      ↕  npm run sync          push vault → Google Drive
Google Drive folder
      ↓  npm run build         fetch from Drive → build site
fumadocs-obsidian
      ↓
Published site (Vercel)
```

1. **Sync** — push your vault to Google Drive with `npm run sync`
2. **Build** — at deploy time, notes are downloaded from Drive, processed by `fumadocs-obsidian` and built with Fumadocs/Next.js
3. **Never in git** — `content/` is gitignored; only your app code lives in the repository

## Supported Obsidian features

| Feature | Support |
|---|---|
| `[[Wikilinks]]` | Resolved to proper links |
| `> [!note]` callouts | Rendered as styled callout blocks |
| `![[image.png]]` embeds | Copied to `public/vault/`, URL rewritten |
| `$...$` / `$$...$$` LaTeX | Rendered with KaTeX |
| Nested folder structure | Preserved as URL hierarchy |
| Frontmatter | Passed through; `title` used for page heading |
| Excalidraw drawings | Not rendered — add `"**/*.excalidraw.md"` to `vault.exclude` |

---

## Setup

### 1. Clone and install

```bash
git clone https://github.com/your-username/on-vault.git
cd on-vault
npm install
```

### 2. Create a Google Drive folder

Create a folder in your Google Drive where your vault will be synced. Copy the folder ID from the URL:

```
drive.google.com/drive/folders/<FOLDER_ID>
```

### 3. Set up Google authentication

**Option A: OAuth2 — personal Google accounts (recommended)**

1. Go to [Google Cloud Console](https://console.cloud.google.com/) → APIs & Services → Credentials
2. Enable the **Google Drive API**: APIs & Services → Library → search "Google Drive API"
3. Create credentials → **OAuth 2.0 Client ID** → Application type: **Desktop app**
4. Copy the client ID and client secret
5. Add them to `.env` (copy from `.env.example` first):
   ```
   GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=your-client-secret
   ```
6. Run the auth command — opens a browser, you log in once, refresh token is saved automatically:
   ```bash
   npm run auth
   ```

**Option B: Service Account — Google Workspace Shared Drives only**

Service accounts cannot write to personal Google Drive (no storage quota). Use this only if you have a Google Workspace Shared Drive.

1. IAM & Admin → Service Accounts → Create Service Account
2. Create a JSON key → download the file
3. Share the Drive folder with the service account email (Editor access)
4. Paste the JSON contents as a single line in `.env`:
   ```
   GOOGLE_SERVICE_ACCOUNT_JSON={"type":"service_account",...}
   ```

### 4. Create your config files

**`on-vault.yaml`** (copy from `on-vault.yaml.example`):

```yaml
site:
  title: My Knowledge Base
  base_path: docs           # URL prefix (/docs/*) and content folder name

vault:
  path: ~/Documents/MyVault
  # sync_config: true       # also sync .obsidian/ folder (plugins, themes, hotkeys)

google_drive:
  folder_id: YOUR_FOLDER_ID_HERE
```

**`.env`** (copy from `.env.example`):

```
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REFRESH_TOKEN=       # filled automatically by: npm run auth

DRIVE_FOLDER_ID=YOUR_FOLDER_ID_HERE
NEXT_PUBLIC_BASE_PATH=docs
NEXT_PUBLIC_SITE_TITLE=My Knowledge Base
```

### 5. Sync your vault to Drive

```bash
npm run sync
```

Only new or modified files are uploaded. Add `--force` to re-upload everything regardless of modification time.

### 6. Run locally

```bash
npm run fetch   # download notes from Drive → content/
npm run dev     # start Next.js dev server
```

Open [http://localhost:3000](http://localhost:3000).

---

## Configuration reference

**`on-vault.yaml`**

| Key | Description |
|---|---|
| `site.title` | Site title shown in the header |
| `site.base_path` | URL prefix and content folder name (default: `docs`) |
| `vault.path` | Absolute or `~`-relative path to your local Obsidian vault |
| `vault.sync_config` | Also sync `.obsidian/` settings — plugins, themes, hotkeys (default: `false`) |
| `vault.exclude` | Glob patterns for files to exclude from publishing (still synced to storage) |
| `storage.provider` | Storage backend: `google_drive` (default) or `s3` |
| `storage.sync_enabled` | Set `false` to disable vault→storage uploads; fetch still works (default: `true`) |
| `google_drive.folder_id` | ID of the Google Drive folder |
| `s3.bucket` | S3 bucket name |
| `s3.prefix` | Optional key prefix inside the bucket (e.g. `vault/`) |
| `s3.region` | AWS region (falls back to `AWS_REGION` env var) |

**`.env` / environment variables**

| Variable | Description |
|---|---|
| `GOOGLE_CLIENT_ID` | OAuth2 client ID |
| `GOOGLE_CLIENT_SECRET` | OAuth2 client secret |
| `GOOGLE_REFRESH_TOKEN` | OAuth2 refresh token (set by `npm run auth`) |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Service account JSON (alternative to OAuth2) |
| `DRIVE_FOLDER_ID` | Drive folder ID — used when `on-vault.yaml` is absent (e.g. CI) |
| `S3_BUCKET` | S3 bucket name — used when `on-vault.yaml` is absent |
| `S3_PREFIX` | Optional S3 key prefix — used when `on-vault.yaml` is absent |
| `AWS_REGION` | AWS region |
| `AWS_ACCESS_KEY_ID` | AWS access key |
| `AWS_SECRET_ACCESS_KEY` | AWS secret key |
| `STORAGE_PROVIDER` | `google_drive` or `s3` — used when `on-vault.yaml` is absent |
| `STORAGE_SYNC_ENABLED` | Set `false` to disable uploads — used when `on-vault.yaml` is absent |
| `NEXT_PUBLIC_BASE_PATH` | URL prefix — must match `site.base_path` in `on-vault.yaml` |
| `NEXT_PUBLIC_SITE_TITLE` | Site title — must match `site.title` in `on-vault.yaml` |

---

## Deploying to Vercel

### 1. Set environment variables in Vercel

Vercel Dashboard → Project → Settings → Environment Variables:

| Variable | Value |
|---|---|
| `GOOGLE_CLIENT_ID` | your OAuth2 client ID |
| `GOOGLE_CLIENT_SECRET` | your OAuth2 client secret |
| `GOOGLE_REFRESH_TOKEN` | your refresh token |
| `DRIVE_FOLDER_ID` | your Drive folder ID |
| `NEXT_PUBLIC_BASE_PATH` | e.g. `docs` or `notes` |
| `NEXT_PUBLIC_SITE_TITLE` | e.g. `My Knowledge Base` |

### 2. Add GitHub secrets

GitHub repo → Settings → Secrets and variables → Actions:

| Secret | Where to get it |
|---|---|
| `VERCEL_TOKEN` | Vercel Dashboard → Account Settings → Tokens |
| `VERCEL_ORG_ID` | `.vercel/project.json` → `orgId` (after `npx vercel link`) |
| `VERCEL_PROJECT_ID` | `.vercel/project.json` → `projectId` |
| `GOOGLE_CLIENT_ID` | same as Vercel env vars above |
| `GOOGLE_CLIENT_SECRET` | same as Vercel env vars above |
| `GOOGLE_REFRESH_TOKEN` | same as Vercel env vars above |
| `DRIVE_FOLDER_ID` | same as Vercel env vars above |
| `NEXT_PUBLIC_BASE_PATH` | same as Vercel env vars above |
| `NEXT_PUBLIC_SITE_TITLE` | same as Vercel env vars above |

### 3. Link the project to Vercel

```bash
npx vercel link
```

Creates `.vercel/project.json` with `orgId` and `projectId`. Then disable Vercel's automatic GitHub deployments to avoid double builds — the GitHub Actions workflow handles all deploys:

Vercel Dashboard → Project → Settings → Git → Ignored Build Step: `exit 0`

### 4. Push and deploy

```bash
git push origin main
```

The GitHub Actions workflow runs automatically on every push to `main`.

---

## Rebuilding with new notes

When you sync notes with `npm run sync`, the published site does not update automatically (notes are not in git). To trigger a rebuild:

**Manual:** GitHub → Actions → Deploy → Run workflow

**Automated (optional):**

```bash
alias vault-publish='npm run sync && gh workflow run deploy.yml'
```

---

## npm scripts

| Command | What it does |
|---|---|
| `npm run sync` | Upload local vault → Google Drive (diff by mtime) |
| `npm run sync -- --force` | Re-upload all files regardless of modification time |
| `npm run fetch` | Download Drive → `content/` (via fumadocs-obsidian) |
| `npm run build` | fetch + fumadocs-mdx + next build (full deploy pipeline) |
| `npm run dev` | Next.js dev server (run `fetch` first) |
| `npm run auth` | One-time OAuth2 browser login, saves refresh token to `.env` |

---

## Tech stack

| | |
|---|---|
| Framework | [Next.js](https://nextjs.org) |
| Docs UI | [Fumadocs](https://fumadocs.dev) |
| Obsidian processing | [fumadocs-obsidian](https://fumadocs.dev/docs/integrations/obsidian) |
| Math rendering | [KaTeX](https://katex.org) via remark-math + rehype-katex |
| Storage | Google Drive (OAuth2 or Service Account) |
| Config | `on-vault.yaml` + `.env` |
| Scripts | TypeScript via [tsx](https://github.com/privatenumber/tsx) |
