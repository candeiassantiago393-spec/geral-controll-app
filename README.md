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

## Deploy (GitHub Pages) — obrigatório para o site funcionar

O 404 aparece porque o **GitHub Pages ainda não está ativo**. Faz isto **uma vez**:

### Opção A — GitHub Actions (recomendado)

1. Abre https://github.com/candeiassantiago393-spec/geral-controll-app/settings/pages
2. Em **Build and deployment → Source**, escolhe **GitHub Actions**
3. Guarda. O workflow `.github/workflows/pages.yml` faz deploy a cada push em `main`
4. Vai a **Actions** e confirma que o job "Deploy GitHub Pages" ficou verde ✅

### Opção B — Branch manual

1. Mesmo menu **Settings → Pages**
2. **Source:** Deploy from a branch
3. Branch: **main** · Folder: **/ (root)** → Save

### URL correta

https://candeiassantiago393-spec.github.io/geral-controll-app/

(Não uses só `github.io` — tens de incluir `/geral-controll-app/`)

Demora 1–3 minutos após ativar.

## Security

- Login is a **client-side gate** — not server-protected. Do not treat it like bank-level security.
- Never put passwords in README or source code.
- Vault data uses a separate master password with local encryption.

## Stack

Vanilla HTML/CSS/JS · localStorage · PWA · WebAuthn biometrics
