
from datetime import datetime, timezone
from pathlib import Path
from threading import Lock

from fastapi import FastAPI
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles

BASE_DIR = Path(__file__).resolve().parent.parent
STATIC_DIR = BASE_DIR / "static"

app = FastAPI(title="DARK.exe API", version="1.0.0")

lock = Lock()

modules = {
    "ghost_mode": False,
    "auto_reply": False,
    "specter": False,
    "archive": False,
}

events = []


def add_event(event_type: str, message: str):
    event = {
        "type": event_type,
        "message": message,
        "time": datetime.now(timezone.utc).isoformat(),
    }

    with lock:
        events.insert(0, event)
        del events[100:]

    return event


if STATIC_DIR.exists():
    app.mount(
        "/static",
        StaticFiles(directory=str(STATIC_DIR)),
        name="static",
    )


@app.get("/", response_class=HTMLResponse)
def home():
    index_file = STATIC_DIR / "index.html"

    if not index_file.exists():
        return HTMLResponse(
            "<h1>DARK.exe</h1><p>index.html not found</p>",
            status_code=500,
        )

    return HTMLResponse(index_file.read_text(encoding="utf-8"))


@app.get("/api")
def api_info():
    return {
        "name": "DARK.exe",
        "version": "1.0.0",
        "mode": "demo",
    }


@app.get("/api/health")
@app.get("/api/status")
def health():
    with lock:
        active = sum(modules.values())
        event_count = len(events)

    return {
        "status": "online",
        "mode": "demo",
        "active_modules": active,
        "event_count": event_count,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@app.get("/api/modules")
def get_modules():
    with lock:
        return dict(modules)


@app.post("/api/modules/{module_name}/toggle")
def toggle_module(module_name: str):
    if module_name not in modules:
        return {
            "ok": False,
            "error": "Unknown module",
        }

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
        "Demonstration event created.",
    )
    return {"ok": True, "event": event}


@app.get("/api/healthcheck")
def healthcheck():
    return {"ok": True}
