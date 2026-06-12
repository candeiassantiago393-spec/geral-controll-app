# Candeias Control App

Personal productivity app — tasks, projects, vault, calendar, clients (candeias.dev).

**Live demo (GitHub Pages):**  
https://candeiassantiago393-spec.github.io/geral-controll-app/

## Login

| Field | Value |
|-------|-------|
| User | `santiago` |
| Password | `1807` |

After first password login you can enable **Face ID / Touch ID** on supported phones (requires HTTPS — works on GitHub Pages).

## Local development

```bash
python -m http.server 8080
```

Open http://localhost:8080

## Deploy (GitHub Pages)

1. Push code to `main` on [geral-controll-app](https://github.com/candeiassantiago393-spec/geral-controll-app)
2. GitHub → **Settings → Pages**
3. **Build and deployment → Source:** Deploy from a branch
4. Branch: `main` · Folder: `/ (root)` → **Save**

Site URL: https://candeiassantiago393-spec.github.io/geral-controll-app/

## Security note

This is a **client-side** login gate for a public static app. Credentials are not server-protected — do not store highly sensitive data without understanding this limitation. The Vault uses local encryption with your master password.

## Stack

Vanilla HTML/CSS/JS · localStorage · PWA manifest · WebAuthn biometrics
