# Deploying instructionalbiology.com

## 1. Create the repo (github.com/bmarkosian)
1. github.com/new
2. Repository name: `instructionalbiology` (any name works, this one's clean)
3. Public
4. **Do not** initialize with a README, .gitignore, or license — you're pushing existing files.
5. Create repository.

## 2. Push these files
From the folder containing `index.html`, `assets/`, `CNAME`:
```
git init
git add .
git commit -m "Initial site"
git branch -M main
git remote add origin https://github.com/bmarkosian/instructionalbiology.git
git push -u origin main
```

## 3. Turn on GitHub Pages
1. Repo → **Settings** → **Pages**
2. Source: **Deploy from a branch**
3. Branch: **main**, folder: **/ (root)**
4. Save. Wait ~1 minute, then the repo's default URL (bmarkosian.github.io/instructionalbiology) should load.
5. Still on the Pages settings screen, under **Custom domain**, type `www.instructionalbiology.com` and Save. GitHub will re-commit the CNAME file (already in the repo) — that's expected.
6. **Leave "Enforce HTTPS" unchecked for now** — it can't be turned on until DNS (step 4) has propagated and GitHub issues a certificate. You'll come back to this.

## 4. DNS at GoDaddy
Log into GoDaddy → **My Products** → DNS next to instructionalbiology.com → **DNS Records**.

Add these records (don't touch anything else — your MX/email records stay exactly as they are):

| Type | Name | Value | TTL |
|---|---|---|---|
| CNAME | www | bmarkosian.github.io | 1 hour |
| A | @ | 185.199.108.153 | 1 hour |
| A | @ | 185.199.109.153 | 1 hour |
| A | @ | 185.199.110.153 | 1 hour |
| A | @ | 185.199.111.153 | 1 hour |

If GoDaddy already has an A record or "Parked" record on `@`, delete it before adding the four above — GitHub's docs explicitly warn against a default/parked record colliding with these.

The four A records on the apex (`@`) mean `instructionalbiology.com` (no www) also resolves and GitHub will redirect it to `www.instructionalbiology.com` automatically once Pages is configured with `www` as the primary custom domain.

## 5. Wait, then verify
- DNS can take anywhere from a few minutes to 24 hours to propagate.
- Check with: `dig www.instructionalbiology.com` (should return `bmarkosian.github.io`) and `dig instructionalbiology.com` (should return the four IPs above).
- Once it resolves, go back to Settings → Pages and check **Enforce HTTPS**. It may take a few more minutes to become available while GitHub issues the certificate — if the checkbox is greyed out, wait and refresh.

## 6. Done
`https://www.instructionalbiology.com` is live. Repeat step 2 (`git add . && git commit && git push`) any time you want to update the site — Pages redeploys automatically on every push to `main`.

---

**What's built so far (Phase 1):** home page + design system (`assets/css/styles.css`, `assets/js/main.js`). Nav links to `/asap`, `/asap/sckg`, `/about`, `/about/founder`, `/technologies`, `/insights` don't have pages behind them yet — they'll 404 until later phases. The investor vault section is intentionally a dead-end (mailto only), per your instruction not to build anything behind it yet.
