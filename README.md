# on-vault

Publish your [Obsidian](https://obsidian.md) vault as a documentation site. Notes sync to Google Drive and are fetched at build time — they never live in your GitHub repository.

## How it works

```
Obsidian Vault (local)
      ↕  npm run sync
Google Drive folder
      ↓  npm run build (at deploy time)
fumadocs-obsidian
      ↓
Published site
```

1. **Sync** — push your vault to Google Drive with `npm run sync`
2. **Build** — at deploy time, notes are downloaded from Drive, processed by `fumadocs-obsidian` (wikilinks, callouts, embeds, LaTeX) and built with Fumadocs/Next.js
3. **Never in git** — `content/` is gitignored; only your app code is in the repository

## Supported Obsidian features

| Feature | Support |
|---|---|
| `[[Wikilinks]]` | Resolved to proper links |
| `> [!note]` callouts | Rendered as styled callout blocks |
| `![[image.png]]` embeds | Copied to `public/vault/`, URL rewritten |
| `$...$` / `$$...$$` LaTeX | Rendered with KaTeX |
| Nested folder structure | Preserved as URL hierarchy |
| Frontmatter | Passed through; `title` used for page heading |

---

## Setup

### 1. Clone and install

```bash
git clone https://github.com/your-username/on-vault.git
cd on-vault
npm install
```

### 2. Configure Google Drive

You need a **Service Account** — it lets the build script authenticate with Drive without any interactive login, which works both locally and in CI/CD.

1. Go to [Google Cloud Console](https://console.cloud.google.com/) → create a project (or use an existing one)
2. Enable the **Google Drive API**: APIs & Services → Enable APIs → search "Google Drive API"
3. Create a Service Account: IAM & Admin → Service Accounts → Create Service Account
4. Create a JSON key: click the service account → Keys → Add Key → JSON → download the file
5. In Google Drive, create a folder for your vault and **share it** with the service account email (e.g. `your-sa@your-project.iam.gserviceaccount.com`) with Editor access
6. Copy the folder ID from the URL: `drive.google.com/drive/folders/<FOLDER_ID>`

### 3. Create your config files

**`on-vault.yaml`** (copy from `on-vault.yaml.example`):

```yaml
site:
  title: My Knowledge Base
  base_path: docs         # URL: /docs/*, content folder: content/docs/

vault:
  path: ~/Documents/MyVault

google_drive:
  folder_id: YOUR_FOLDER_ID_HERE
```

**`.env`** (copy from `.env.example`):

```
GOOGLE_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"...","private_key":"...","client_email":"..."}
```

Paste the entire JSON key file contents as a single line.

### 4. Sync your vault to Drive

```bash
npm run sync
```

Output:
```
Syncing ~/Documents/MyVault → Google Drive
Local: 142 files
Fetching Drive file list...
Drive: 0 files

  + notes/2024-01-01.md
  + research/quantum.md
  ...

Done: 142 uploaded, 0 updated, 0 deleted, 0 unchanged
```

Re-run this command whenever you want to push local changes to Drive. Only new or modified files are uploaded.

### 5. Run locally

```bash
npm run fetch   # download notes from Drive → content/
npm run dev     # start Next.js dev server
```

Open [http://localhost:3000](http://localhost:3000).

---

## Configuration reference

All options live in `on-vault.yaml`:

| Key | Description | Default |
|---|---|---|
| `site.title` | Site title shown in the header | — |
| `site.base_path` | URL prefix and content folder name | `docs` |
| `vault.path` | Absolute or `~`-relative path to your local Obsidian vault | — |
| `google_drive.folder_id` | ID of the shared Drive folder | — |

### Changing `base_path`

Setting `base_path: notes` means your notes are served at `/notes/*`. The Next.js app internally keeps its route at `/docs/` and a transparent rewrite handles the mapping — no code changes needed.

---

## Deploying

### Vercel (recommended)

1. Push your repo to GitHub
2. Import the project in [Vercel](https://vercel.com)
3. Add the environment variable:
   - `GOOGLE_SERVICE_ACCOUNT_JSON` → your service account JSON (single line)
4. Add build configuration in Vercel project settings:
   - **Build Command:** `npm run build`
   - **Output Directory:** `.next`
5. Deploy — Vercel will run `fetch` + `fumadocs-mdx` + `next build` automatically

Every time you push code, Vercel redeploys. To rebuild with updated notes, trigger a manual redeploy or set up a webhook.

### Other platforms

See `.github/workflows/deploy.yml` for a generic GitHub Actions example that builds the site and uploads the artifact. Adapt the final deploy step to your platform (Netlify, GitHub Pages, self-hosted, etc.).

---

## GitHub Actions

A workflow that rebuilds and deploys on every push to `main`:

```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [main]
  workflow_dispatch:   # allow manual trigger to rebuild with new notes

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      - run: npm ci

      - name: Build
        env:
          GOOGLE_SERVICE_ACCOUNT_JSON: ${{ secrets.GOOGLE_SERVICE_ACCOUNT_JSON }}
        run: npm run build

      # Replace this step with your platform's deploy action
      - name: Deploy to Vercel
        uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          vercel-args: --prod
```

Add `GOOGLE_SERVICE_ACCOUNT_JSON` as a repository secret in GitHub → Settings → Secrets and variables → Actions.

---

## Local development workflow

```bash
# First time
cp on-vault.yaml.example on-vault.yaml   # fill in your config
cp .env.example .env                      # paste your service account JSON
npm install
npm run sync                              # push vault to Drive

# Day-to-day (after editing notes in Obsidian)
npm run sync                              # push changes to Drive
npm run fetch && npm run dev              # preview locally

# To deploy
git push origin main                      # triggers Vercel redeploy
# or: trigger a manual redeploy in Vercel dashboard
```

---

## Tech stack

| | |
|---|---|
| Framework | [Next.js 16](https://nextjs.org) |
| Docs UI | [Fumadocs](https://fumadocs.dev) |
| Obsidian processing | [fumadocs-obsidian](https://fumadocs.dev/docs/integrations/obsidian) |
| Math rendering | [KaTeX](https://katex.org) via remark-math + rehype-katex |
| Storage | Google Drive (Service Account auth) |
| Config | YAML (`on-vault.yaml`) + `.env` |
| Scripts | TypeScript via [tsx](https://github.com/privatenumber/tsx) |
