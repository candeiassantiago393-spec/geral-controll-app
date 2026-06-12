"""Candeias web server: static app + password gate + JSON cloud sync (Render)."""

from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from pathlib import Path

from fastapi import FastAPI, Header, HTTPException
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel

ROOT = Path(__file__).resolve().parent.parent
CLOUD_PATH = ROOT / "data" / "cloud" / "state.json"

BLOCKED_PREFIXES = (
    ".git",
    "server",
    "backups",
    "data/cloud",
    "docs",
    "node_modules",
    ".env",
)

STATIC_ROOT_FILES = {
    "index.html",
    "404.html",
    "manifest.json",
    "sw.js",
    "version.json",
    "render.yaml",
    "requirements.txt",
}


def _now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def _app_password() -> str:
    return os.getenv("APP_PASSWORD", "").strip()


def _sync_token() -> str:
    return os.getenv("CLOUD_SYNC_TOKEN", "").strip()


def _validate_token(token: str | None) -> bool:
    expected = _sync_token()
    if not expected:
        return False
    return token == expected


def _load_cloud() -> dict:
    if not CLOUD_PATH.exists():
        return {}
    try:
        return json.loads(CLOUD_PATH.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return {}


def _save_cloud(payload: dict) -> None:
    CLOUD_PATH.parent.mkdir(parents=True, exist_ok=True)
    CLOUD_PATH.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


class LoginIn(BaseModel):
    password: str


class CloudStateIn(BaseModel):
    state: dict
    updatedAt: str | None = None
    version: str | None = None


class SyncNowIn(BaseModel):
    state: dict
    updatedAt: str | None = None
    version: str | None = None


app = FastAPI(title="Candeias", docs_url=None, redoc_url=None)


@app.get("/api/health")
def health():
    return {
        "ok": True,
        "backend": "render",
        "passwordConfigured": bool(_app_password()),
        "hasCloudData": CLOUD_PATH.exists(),
    }


@app.post("/api/auth/login")
def login(body: LoginIn):
    password = _app_password()
    if not password:
        raise HTTPException(503, "APP_PASSWORD not set on server.")
    token = _sync_token()
    if not token:
        raise HTTPException(503, "CLOUD_SYNC_TOKEN not set on server.")
    if body.password != password:
        raise HTTPException(401, "Invalid password.")
    return {"ok": True, "token": token}


@app.get("/api/cloud/state")
def cloud_get(x_sync_token: str | None = Header(default=None)):
    if not _validate_token(x_sync_token):
        raise HTTPException(401, "Unauthorized.")
    payload = _load_cloud()
    if not payload:
        return {"state": None, "updatedAt": "", "version": ""}
    return payload


@app.put("/api/cloud/state")
def cloud_put(body: CloudStateIn, x_sync_token: str | None = Header(default=None)):
    if not _validate_token(x_sync_token):
        raise HTTPException(401, "Unauthorized.")
    updated_at = body.updatedAt or _now_iso()
    payload = {
        "state": body.state,
        "updatedAt": updated_at,
        "version": body.version or "",
    }
    _save_cloud(payload)
    return {"ok": True, "updatedAt": updated_at}


@app.post("/api/sync/now")
def sync_now(body: SyncNowIn, x_sync_token: str | None = Header(default=None)):
    if not _validate_token(x_sync_token):
        raise HTTPException(401, "Unauthorized.")
    remote = _load_cloud()
    local_at = (body.updatedAt or "").strip()
    remote_at = str(remote.get("updatedAt") or "").strip()

    if not remote or not remote.get("state"):
        updated_at = local_at or _now_iso()
        payload = {"state": body.state, "updatedAt": updated_at, "version": body.version or ""}
        _save_cloud(payload)
        return {"ok": True, "changed": True, "direction": "push", "updatedAt": updated_at, "state": body.state}

    if not local_at or remote_at > local_at:
        return {
            "ok": True,
            "changed": True,
            "direction": "pull",
            "updatedAt": remote_at,
            "state": remote.get("state"),
        }

    if local_at > remote_at:
        payload = {"state": body.state, "updatedAt": local_at, "version": body.version or ""}
        _save_cloud(payload)
        return {"ok": True, "changed": True, "direction": "push", "updatedAt": local_at, "state": body.state}

    return {
        "ok": True,
        "changed": False,
        "direction": "none",
        "updatedAt": remote_at,
        "state": remote.get("state"),
    }


def _safe_path(rel: str) -> Path | None:
    rel = rel.replace("\\", "/").lstrip("/")
    if not rel:
        return ROOT / "index.html"
    for blocked in BLOCKED_PREFIXES:
        if rel == blocked or rel.startswith(f"{blocked}/"):
            return None
    target = (ROOT / rel).resolve()
    try:
        target.relative_to(ROOT.resolve())
    except ValueError:
        return None
    return target


@app.get("/")
def index():
    return FileResponse(ROOT / "index.html")


@app.get("/{full_path:path}")
def static_or_spa(full_path: str):
    if full_path.startswith("api/"):
        raise HTTPException(404)
    target = _safe_path(full_path)
    if target is None:
        raise HTTPException(404)
    if target.is_file():
        return FileResponse(target)
    if full_path in STATIC_ROOT_FILES:
        candidate = ROOT / full_path
        if candidate.is_file():
            return FileResponse(candidate)
    return FileResponse(ROOT / "index.html")
