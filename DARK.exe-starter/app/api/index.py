
import hmac
import os
import time
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from threading import Lock

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from starlette.middleware.sessions import SessionMiddleware


BASE_DIR = Path(__file__).resolve().parent.parent
STATIC_DIR = BASE_DIR / "static"

ADMIN_USERNAME = os.getenv("ADMIN_USERNAME", "")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "")
SESSION_SECRET = os.getenv("SESSION_SECRET", "")

MAX_RECORDS = 200
MAX_ATTEMPTS = 5
LOCKOUT_SECONDS = 15 * 60

app = FastAPI(
    title="DARK.exe",
    version="2.1.0",
)

app.add_middleware(
    SessionMiddleware,
    secret_key=SESSION_SECRET or "development-only-change-me",
    session_cookie="dark_admin_session",
    max_age=3600,
    same_site="lax",
    https_only=os.getenv("COOKIE_SECURE", "true").lower() == "true",
)

lock = Lock()

modules = {
    "ghost_mode": False,
    "auto_reply": False,
    "specter": False,
    "archive": False,
}

events = []
visits = []
login_attempts = defaultdict(list)


class LoginData(BaseModel):
    username: str = Field(min_length=1, max_length=128)
    password: str = Field(min_length=1, max_length=256)


def timestamp():
    return datetime.now(timezone.utc).isoformat()


def client_ip(request: Request):
    # Vercel supplies this header on its requests.
    # Do not trust forwarded IP headers from arbitrary clients
    # if deploying this app outside a trusted proxy.
    forwarded = request.headers.get("x-vercel-forwarded-for", "")
    if forwarded:
        return forwarded.split(",")[0].strip()[:100]

    real_ip = request.headers.get("x-real-ip", "")
    if real_ip:
        return real_ip.strip()[:100]

    if request.client:
        return request.client.host[:100]

    return "unknown"


def add_event(kind: str, message: str):
    record = {
        "type": str(kind)[:80],
        "message": str(message)[:1000],
        "time": timestamp(),
    }

    with lock:
        events.insert(0, record)
        del events[MAX_RECORDS:]

    return record


def record_visit(request: Request):
    record = {
        "time": timestamp(),
        "ip": client_ip(request),
        "path": request.url.path[:500],
        "user_agent": request.headers.get("user-agent", "unknown")[:500],
    }

    with lock:
        visits.insert(0, record)
        del visits[MAX_RECORDS:]

    return record


def admin_is_configured():
    return bool(ADMIN_USERNAME and ADMIN_PASSWORD and SESSION_SECRET)


def require_admin(request: Request):
    if not admin_is_configured():
        raise HTTPException(
            status_code=503,
            detail="Admin credentials are not configured",
        )

    if not request.session.get("admin"):
        raise HTTPException(
            status_code=401,
            detail="Authentication required",
        )


def check_static_file(filename: str):
    path = STATIC_DIR / filename

    if not path.is_file():
        raise HTTPException(
            status_code=500,
            detail=f"{filename} not found",
        )

    return path


if STATIC_DIR.exists():
    app.mount(
        "/static",
        StaticFiles(directory=str(STATIC_DIR)),
        name="static",
    )


@app.get("/", response_class=HTMLResponse)
def home(request: Request):
    index_file = check_static_file("index.html")

    # Records a page visit. The site's privacy notice should explain
    # that basic technical information is logged.
    record_visit(request)

    return HTMLResponse(
        index_file.read_text(encoding="utf-8")
    )


@app.get("/api")
def api_info():
    return {
        "name": "DARK.exe",
        "version": "2.1.0",
        "mode": "demo",
    }


@app.get("/api/health")
@app.get("/api/status")
def health():
    with lock:
        active_count = sum(modules.values())

    return {
        "status": "online",
        "mode": "demo",
        "active_modules": active_count,
        "timestamp": timestamp(),
    }


@app.get("/api/healthcheck")
def healthcheck():
    return {"ok": True}


@app.get("/api/modules")
def get_modules():
    with lock:
        return dict(modules)


@app.post("/api/modules/{module_name}/toggle")
def toggle_module(module_name: str):
    if module_name not in modules:
        raise HTTPException(
            status_code=404,
            detail="Unknown module",
        )

    with lock:
        modules[module_name] = not modules[module_name]
        enabled = modules[module_name]

    add_event(
        "MODULE_STATE",
        f"{module_name}: {'active' if enabled else 'standby'}",
    )

    return {
        "ok": True,
        "module": module_name,
        "active": enabled,
    }


@app.get("/api/events")
def get_events():
    with lock:
        return list(events)


@app.post("/api/events/demo")
def create_demo_event():
    event = add_event(
        "DEMO",
        "Demonstration event created",
    )

    return {
        "ok": True,
        "event": event,
    }


@app.get("/api/admin/me")
def admin_me(request: Request):
    configured = admin_is_configured()

    return {
        "authenticated": (
            configured and bool(request.session.get("admin"))
        ),
        "configured": configured,
    }


@app.post("/api/admin/login")
def admin_login(data: LoginData, request: Request):
    if not admin_is_configured():
        raise HTTPException(
            status_code=503,
            detail="Admin credentials are not configured",
        )

    ip = client_ip(request)
    now = time.time()

    with lock:
        recent_attempts = [
            attempt
            for attempt in login_attempts[ip]
            if now - attempt < LOCKOUT_SECONDS
        ]

        login_attempts[ip] = recent_attempts
        blocked = len(recent_attempts) >= MAX_ATTEMPTS

    if blocked:
        raise HTTPException(
            status_code=429,
            detail="Too many attempts. Try again later.",
        )

    username_ok = hmac.compare_digest(
        data.username.encode("utf-8"),
        ADMIN_USERNAME.encode("utf-8"),
    )

    password_ok = hmac.compare_digest(
        data.password.encode("utf-8"),
        ADMIN_PASSWORD.encode("utf-8"),
    )

    if not (username_ok and password_ok):
        with lock:
            login_attempts[ip].append(now)

        add_event(
            "LOGIN_FAILED",
            f"Failed admin login from {ip}",
        )

        raise HTTPException(
            status_code=401,
            detail="Invalid credentials",
        )

    with lock:
        login_attempts.pop(ip, None)

    request.session.clear()
    request.session["admin"] = True
    request.session["login_time"] = timestamp()

    add_event(
        "ADMIN_LOGIN",
        "Administrator signed in",
    )

    return {
        "ok": True,
        "authenticated": True,
    }


@app.post("/api/admin/logout")
def admin_logout(request: Request):
    require_admin(request)

    request.session.clear()

    add_event(
        "ADMIN_LOGOUT",
        "Administrator signed out",
    )

    return {"ok": True}


@app.get("/api/admin/visits")
def admin_visits(request: Request):
    require_admin(request)

    with lock:
        return list(visits)


@app.get("/api/admin/events")
def admin_events(request: Request):
    require_admin(request)

    with lock:
        return list(events)
