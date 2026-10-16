from datetime import datetime
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

app = FastAPI(title="DARK.exe Local Test")

ROOT = Path(__file__).resolve().parent / "app"
WEB = ROOT / "static"

events = [
    {
        "type": "SYSTEM",
        "detail": "DARK.exe LOCAL TEST ONLINE",
        "created_at": datetime.now().astimezone().isoformat(),
    }
]

modules = {
    "ghost_mode": {"enabled": False},
    "auto_reply": {"enabled": False},
}

app.mount("/static", StaticFiles(directory=str(WEB)), name="static")


@app.get("/")
async def home():
    return FileResponse(WEB / "index.html")


@app.get("/api/health")
async def health():
    return {"system": "DARK.exe", "status": "online"}


@app.get("/api/status")
async def status():
    return {
        "system": "DARK.exe",
        "status": "online",
        "modules": modules,
        "event_count": len(events),
    }


@app.get("/api/modules")
async def get_modules():
    return modules


@app.post("/api/modules/{module_name}/toggle")
async def toggle_module(module_name: str):
    if module_name not in modules:
        raise HTTPException(status_code=404, detail="Module not found")

    modules[module_name]["enabled"] = not modules[module_name]["enabled"]

    events.insert(0, {
        "type": "MODULE",
        "detail": f"{module_name}: {'ON' if modules[module_name]['enabled'] else 'OFF'}",
        "created_at": datetime.now().astimezone().isoformat(),
    })

    del events[8:]

    return {
        "ok": True,
        "module": module_name,
        "enabled": modules[module_name]["enabled"],
    }


@app.get("/api/events")
async def get_events():
    return events[:8]


@app.post("/api/events/demo")
async def demo():
    events.insert(0, {
        "type": "USER_SIGNAL",
        "detail": "Тестовое событие интерфейса",
        "created_at": datetime.now().astimezone().isoformat(),
    })

    del events[8:]

    return {"ok": True}
