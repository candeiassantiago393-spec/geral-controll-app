# Candeias on Render — password + sync

One private password. Same data on PC and phone. Like **medias-escolares**, but for the full Candeias app.

## What you get

| Feature | How |
|---------|-----|
| **Hosting** | Render Web Service (Python) |
| **Password** | Only you — set on Render, never in GitHub |
| **Sync** | JSON file on Render disk — auto every 30s |
| **Public URL** | Anyone can open the link, but **without password they see nothing** |

---

## 1. Deploy on Render

1. Push this repo to GitHub (repo can stay **private**).
2. [render.com](https://render.com) → **New → Blueprint** (or Web Service).
3. Connect the repo — Render reads `render.yaml` automatically.
4. Wait until status is **Live**.

You get a URL like: `https://candeias-app.onrender.com`

---

## 2. Set passwords (Render dashboard → Environment)

Add **two** secret variables (never commit these):

| Variable | Example | Purpose |
|----------|---------|---------|
| `APP_PASSWORD` | your secret password | What you type to enter the app |
| `CLOUD_SYNC_TOKEN` | long random string | Internal API token (any random text) |

`CLOUD_IS_SOURCE=true` is already set in `render.yaml`.

After saving env vars, Render redeploys automatically.

---

## 3. Use the app

### Phone

1. Safari → your Render URL
2. Enter **APP_PASSWORD**
3. **Share → Add to Home Screen** (PWA)

### PC

1. Browser → same Render URL
2. Same password
3. Data syncs automatically

### Daily flow

- Edit on phone during the day → saved to Render cloud
- Open on PC at home → login → **same tasks appear**
- Sync runs every **30 seconds** while the app is open

---

## 4. Security notes

- The GitHub repo can be public — **password is only on Render**, not in code.
- Followers who find the URL still need your password.
- Do **not** put `APP_PASSWORD` in README, commits, or screenshots.
- Use a strong password (not `1807`).

---

## 5. Local development

```bash
pip install -r requirements.txt
set APP_PASSWORD=test123
set CLOUD_SYNC_TOKEN=dev-token-local
uvicorn server.main:app --reload --port 8765
```

Open http://localhost:8765 — login with `test123`.

Without the server (`python -m http.server`), the app uses local-only login (no sync).

---

## 6. Firebase (optional)

If you deploy on **GitHub Pages** or static hosting without the Python server, you can still use **Firebase** sync (Settings → Cloud sync). On **Render with this server**, Firebase is not needed.

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| 503 on login | Set `APP_PASSWORD` and `CLOUD_SYNC_TOKEN` on Render |
| Slow first load | Free plan sleeps — wait ~30s |
| Data missing | Sign in with same password; tap **Sync now** in Settings |
| Old GitHub Pages URL | Use the Render URL instead |
