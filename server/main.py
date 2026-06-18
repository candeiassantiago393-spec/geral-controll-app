"""Candeias web server: static app + password gate + JSON cloud sync (Render)."""

from __future__ import annotations

import json
import os
import shutil
from datetime import datetime, timezone
from pathlib import Path

from fastapi import FastAPI, Header, HTTPException
from fastapi.responses import FileResponse, HTMLResponse
from pydantic import BaseModel

ROOT = Path(__file__).resolve().parent.parent
CLOUD_PATH = ROOT / "data" / "cloud" / "state.json"
CLOUD_BACKUP_DIR = ROOT / "data" / "cloud" / "backups"
MAX_CLOUD_BACKUPS = 10

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

VERSION_PLACEHOLDER = "__CANDEIAS_V__"


def _app_version() -> str:
    try:
        data = json.loads((ROOT / "version.json").read_text(encoding="utf-8"))
        return str(data.get("version") or "0.0.0")
    except (OSError, json.JSONDecodeError, TypeError, ValueError):
        return "0.0.0"


def _inject_app_version(text: str) -> str:
    return text.replace(VERSION_PLACEHOLDER, _app_version())


def _cache_control_for(path: Path) -> str:
    name = path.name.lower()
    suffix = path.suffix.lower()
    if name in ("index.html", "sw.js", "version.json", "manifest.json") or suffix in (".js", ".css", ".html"):
        return "no-store, no-cache, must-revalidate"
    if suffix in (".svg", ".png", ".ico", ".webp", ".jpg", ".jpeg", ".woff", ".woff2"):
        return "public, max-age=604800"
    return "no-cache"


def _file_response(path: Path) -> FileResponse:
    return FileResponse(path, headers={"Cache-Control": _cache_control_for(path)})


def _html_response(path: Path) -> HTMLResponse:
    text = _inject_app_version(path.read_text(encoding="utf-8"))
    return HTMLResponse(text, headers={"Cache-Control": "no-store, no-cache, must-revalidate"})


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


def _data_score(state: dict | None) -> int:
    if not state or not isinstance(state, dict):
        return 0
    return (
        len(state.get("items") or [])
        + len(state.get("projects") or [])
        + len(state.get("clients") or [])
        + len(state.get("vaultEntries") or [])
        + len(state.get("grades") or [])
        + len(state.get("subscriptions") or [])
    )


def _load_cloud() -> dict:
    if not CLOUD_PATH.exists():
        return {}
    try:
        return json.loads(CLOUD_PATH.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return {}


def _backup_cloud_if_needed() -> None:
    if not CLOUD_PATH.exists():
        return
    try:
        CLOUD_BACKUP_DIR.mkdir(parents=True, exist_ok=True)
        ts = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
        dest = CLOUD_BACKUP_DIR / f"state_{ts}.json"
        shutil.copy2(CLOUD_PATH, dest)
        backups = sorted(CLOUD_BACKUP_DIR.glob("state_*.json"), key=lambda p: p.stat().st_mtime)
        for old in backups[:-MAX_CLOUD_BACKUPS]:
            old.unlink(missing_ok=True)
    except OSError:
        pass


def _save_cloud(payload: dict) -> None:
    new_state = payload.get("state")
    new_score = _data_score(new_state if isinstance(new_state, dict) else None)
    existing = _load_cloud()
    old_score = _data_score(existing.get("state") if isinstance(existing.get("state"), dict) else None)

    if old_score > 0 and new_score == 0:
        raise HTTPException(409, "Blocked: cannot replace cloud data with empty state.")

    if old_score > 0 and new_score > 0:
        _backup_cloud_if_needed()

    CLOUD_PATH.parent.mkdir(parents=True, exist_ok=True)
    CLOUD_PATH.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def _latest_cloud_backup() -> dict:
    if not CLOUD_BACKUP_DIR.exists():
        return {}
    backups = sorted(CLOUD_BACKUP_DIR.glob("state_*.json"), key=lambda p: p.stat().st_mtime)
    for path in reversed(backups):
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
            if _data_score(data.get("state") if isinstance(data.get("state"), dict) else None) > 0:
                return data
        except (json.JSONDecodeError, OSError):
            continue
    return {}


def _merge_entity_lists(local_list: list | None, remote_list: list | None) -> list:
    merged: dict = {}
    for entry in (remote_list or []) + (local_list or []):
        if not isinstance(entry, dict) or not entry.get("id"):
            continue
        entry_id = entry["id"]
        prev = merged.get(entry_id)
        if not prev:
            merged[entry_id] = entry
            continue
        prev_at = str(prev.get("updatedAt") or prev.get("createdAt") or "")
        next_at = str(entry.get("updatedAt") or entry.get("createdAt") or "")
        merged[entry_id] = entry if next_at >= prev_at else prev
    return list(merged.values())


def _merge_states(local_state: dict, remote_state: dict) -> dict:
    if not remote_state:
        return local_state
    if not local_state:
        return remote_state
    return {
        **local_state,
        "projects": _merge_entity_lists(local_state.get("projects"), remote_state.get("projects")),
        "items": _merge_entity_lists(local_state.get("items"), remote_state.get("items")),
        "clients": _merge_entity_lists(local_state.get("clients"), remote_state.get("clients")),
        "vaultEntries": _merge_entity_lists(local_state.get("vaultEntries"), remote_state.get("vaultEntries")),
        "subscriptions": _merge_entity_lists(local_state.get("subscriptions"), remote_state.get("subscriptions")),
        "grades": _merge_entity_lists(local_state.get("grades"), remote_state.get("grades")),
        "areas": local_state.get("areas") or remote_state.get("areas") or [],
        "settings": {**(remote_state.get("settings") or {}), **(local_state.get("settings") or {})},
        "version": local_state.get("version") or remote_state.get("version") or 3,
    }


def _decide_sync(local_state: dict, local_at: str, remote: dict) -> dict:
    remote_state = remote.get("state") if isinstance(remote.get("state"), dict) else None
    remote_at = str(remote.get("updatedAt") or "").strip()
    local_score = _data_score(local_state)
    remote_score = _data_score(remote_state)
    now = _now_iso()

    if remote_score == 0 and local_score == 0:
        return {
            "changed": False,
            "direction": "none",
            "message": "No data on device or cloud.",
            "updatedAt": remote_at,
            "state": remote_state,
        }

    if remote_score > 0 and local_score == 0:
        return {
            "changed": True,
            "direction": "pull",
            "message": f"Downloaded from cloud ({remote_score} records).",
            "updatedAt": remote_at or now,
            "state": remote_state,
        }

    if local_score > 0 and remote_score == 0:
        updated_at = local_at or now
        payload = {"state": local_state, "updatedAt": updated_at, "version": ""}
        _save_cloud(payload)
        return {
            "changed": True,
            "direction": "push",
            "message": f"Uploaded to cloud ({local_score} records).",
            "updatedAt": updated_at,
            "state": local_state,
        }

    # More records wins — avoid overwriting richer data with a newer but smaller cloud copy.
    if local_score > remote_score:
        updated_at = local_at or now
        payload = {"state": local_state, "updatedAt": updated_at, "version": ""}
        _save_cloud(payload)
        return {
            "changed": True,
            "direction": "push",
            "message": f"This device has more data ({local_score} vs {remote_score}) — uploaded.",
            "updatedAt": updated_at,
            "state": local_state,
        }

    if remote_score > local_score:
        return {
            "changed": True,
            "direction": "pull",
            "message": f"Cloud has more data ({remote_score} vs {local_score}) — downloaded.",
            "updatedAt": remote_at or now,
            "state": remote_state,
        }

    if local_score == remote_score and local_score > 0:
        merged = _merge_states(local_state, remote_state)
        updated_at = now
        payload = {"state": merged, "updatedAt": updated_at, "version": ""}
        _save_cloud(payload)
        return {
            "changed": True,
            "direction": "push",
            "message": "Merged both copies — uploaded.",
            "updatedAt": updated_at,
            "state": merged,
        }

    if not local_at or (remote_at and remote_at > local_at):
        return {
            "changed": True,
            "direction": "pull",
            "message": "Cloud copy is newer — downloaded.",
            "updatedAt": remote_at,
            "state": remote_state,
        }

    if local_at and (not remote_at or local_at > remote_at):
        payload = {"state": local_state, "updatedAt": local_at, "version": ""}
        _save_cloud(payload)
        return {
            "changed": True,
            "direction": "push",
            "message": "This device is newer — uploaded.",
            "updatedAt": local_at,
            "state": local_state,
        }

    return {
        "changed": False,
        "direction": "none",
        "message": "Already in sync.",
        "updatedAt": remote_at,
        "state": remote_state,
    }


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
    cloud = _load_cloud()
    score = _data_score(cloud.get("state") if isinstance(cloud.get("state"), dict) else None)
    return {
        "ok": True,
        "backend": "render",
        "passwordConfigured": bool(_app_password()),
        "hasCloudData": score > 0,
        "cloudScore": score,
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
    if not payload or not payload.get("state"):
        return {"state": None, "updatedAt": "", "version": ""}
    return payload


@app.get("/api/cloud/backups/latest")
def cloud_backup_latest(x_sync_token: str | None = Header(default=None)):
    if not _validate_token(x_sync_token):
        raise HTTPException(401, "Unauthorized.")
    backup = _latest_cloud_backup()
    if not backup or not backup.get("state"):
        raise HTTPException(404, "No cloud backup available.")
    return backup


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
    result = _decide_sync(body.state, local_at, remote)
    if result["direction"] == "push" and result["changed"]:
        state = result.get("state") or body.state
        payload = {
            "state": state,
            "updatedAt": result["updatedAt"],
            "version": body.version or "",
        }
        if not result.get("state"):
            _save_cloud(payload)
        result["state"] = state
    return {"ok": True, **result}


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
    return _html_response(ROOT / "index.html")


@app.get("/{full_path:path}")
def static_or_spa(full_path: str):
    if full_path.startswith("api/"):
        raise HTTPException(404)
    target = _safe_path(full_path)
    if target is None:
        raise HTTPException(404)
    if target.is_file():
        if target.name == "index.html":
            return _html_response(target)
        return _file_response(target)
    if full_path in STATIC_ROOT_FILES:
        candidate = ROOT / full_path
        if candidate.is_file():
            if candidate.name == "index.html":
                return _html_response(candidate)
            return _file_response(candidate)
    return _html_response(ROOT / "index.html")
