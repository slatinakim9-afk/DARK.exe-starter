from datetime import datetime
from pathlib import Path
from threading import Lock

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

app = FastAPI(
    title="DARK.exe",
    description="DARK.exe Control System API",
    version="2.0.0",
)

ROOT = Path(__file__).resolve().parent.parent
WEB = ROOT / "static"

lock = Lock()

events = [
    {
        "type": "SYSTEM",
        "detail": "DARK.exe Control System initialized",
        "created_at": datetime.now().astimezone().isoformat(),
    }
]

modules = {
    "ghost_mode": {
        "name": "GHOST MODE",
        "enabled": False,
    },
    "auto_reply": {
        "name": "AUTO REPLY",
        "enabled": False,
    },
}

if WEB.is_dir():
    app.mount(
        "/static",
        StaticFiles(directory=str(WEB)),
        name="static",
    )


def add_event(event_type: str, detail: str):
    event = {
        "type": event_type,
        "detail": detail,
        "created_at": datetime.now().astimezone().isoformat(),
    }

    with lock:
        events.insert(0, event)
        del events[8:]

    return event


@app.get("/")
async def home():
    index_file = WEB / "index.html"

    if not index_file.is_file():
        raise HTTPException(
            status_code=404,
            detail="DARK.exe interface not found",
        )

    return FileResponse(index_file)


@app.get("/api/health")
async def health():
    return {
        "system": "DARK.exe",
        "status": "online",
        "version": app.version,
    }


@app.get("/api/status")
async def system_status():
    with lock:
        module_snapshot = {
            key: value.copy()
            for key, value in modules.items()
        }

        event_count = len(events)

    return {
        "system": "DARK.exe",
        "status": "online",
        "modules": module_snapshot,
        "event_count": event_count,
    }


@app.get("/api/modules")
async def get_modules():
    with lock:
        return {
            key: value.copy()
            for key, value in modules.items()
        }


@app.post("/api/modules/{module_name}/toggle")
async def toggle_module(module_name: str):
    if module_name not in modules:
        raise HTTPException(
            status_code=404,
            detail="Module not found",
        )

    with lock:
        modules[module_name]["enabled"] = (
            not modules[module_name]["enabled"]
        )
        enabled = modules[module_name]["enabled"]
        module_title = modules[module_name]["name"]

    add_event(
        "MODULE",
        f"{module_title}: {'ACTIVE' if enabled else 'STANDBY'}",
    )

    return {
        "ok": True,
        "module": module_name,
        "enabled": enabled,
    }


@app.get("/api/events")
async def get_events():
    with lock:
        return list(events[:8])


@app.post("/api/events/demo")
async def demo_event():
    event = add_event(
        "USER_SIGNAL",
        "Test signal received by DARK.exe",
    )

    return {
        "ok": True,
        "event": event,
    }


@app.get("/api")
async def api_root():
    return {
        "system": "DARK.exe",
        "endpoints": [
            "/api/health",
            "/api/status",
            "/api/modules",
            "/api/events",
        ],
    }


@app.exception_handler(404)
async def not_found_handler(request, exc):
    if request.url.path.startswith("/api/"):
        return JSONResponse(
            status_code=404,
            content={"error": "Endpoint not found"},
        )

    return JSONResponse(
        status_code=404,
        content={"error": "Page not found"},
    )
