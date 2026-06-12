# Candeias Control App

Personal productivity app — tasks, projects, vault, calendar, clients (candeias.dev).

**Live:** https://candeiassantiago393-spec.github.io/geral-controll-app/

## Login (private)

On **first open** on each device/browser, you create your own username and password.  
Credentials are stored **only in that device's localStorage** — nothing is published in this repo.

Optional: **Face ID / Touch ID** after first password login (HTTPS required).

## Local development

```bash
python -m http.server 8080
```

Open http://localhost:8080

## Devices

| Device | Width | Layout |
|--------|-------|--------|
| **Windows desktop** | ≥1025px | Full sidebar, multi-column grids |
| **iPad** | 768–1024px | Narrow sidebar, 2–3 columns |
| **iPhone 12 Pro** | 390px | Drawer menu ☰, single column |

## Deploy (GitHub Pages)

1. Push to `main` on [geral-controll-app](https://github.com/candeiassantiago393-spec/geral-controll-app)
2. **Settings → Pages →** branch `main`, folder `/ (root)`

## Security

- Login is a **client-side gate** — not server-protected. Do not treat it like bank-level security.
- Never put passwords in README or source code.
- Vault data uses a separate master password with local encryption.

## Stack

Vanilla HTML/CSS/JS · localStorage · PWA · WebAuthn biometrics
