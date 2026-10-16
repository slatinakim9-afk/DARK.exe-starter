from datetime import datetime
from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

app = FastAPI(
    title="DARK.exe API",
    description="DARK.exe control panel API",
    version="1.0.0",
)

ROOT = Path(__file__).resolve().parent.parent
WEB = ROOT / "static"

events = [
    {
        "type": "SYSTEM",
        "detail": "DARK.exe ONLINE",
        "created_at": datetime.now().astimezone().isoformat(),
    }
]

modules = {
    "ghost_mode": {
        "name": "Ghost Mode",
        "status": "standby",
        "description": "Режим скрытого отображения интерфейса.",
        "enabled": False,
    },
    "auto_reply": {
        "name": "Auto Reply",
        "status": "standby",
        "description": "Автоответчик. Требует подключения к источнику сообщений.",
        "enabled": False,
    },
}


def add_event(event_type: str, detail: str) -> None:
    events.insert(
        0,
        {
            "type": event_type,
            "detail": detail,
            "created_at": datetime.now().astimezone().isoformat(),
        },
    )
    del events[50:]


app.mount(
    "/static",
    StaticFiles(directory=str(WEB), check_dir=False),
    name="static",
)


@app.get("/")
async def home():
    index_file = WEB / "index.html"

    if not index_file.is_file():
        return JSONResponse(
            status_code=503,
            content={
                "system": "DARK.exe",
                "status": "web_files_missing",
                "message": "Файл static/index.html не найден.",
            },
        )

    return FileResponse(index_file)


@app.get("/api/health")
async def health():
    return {
        "system": "DARK.exe",
        "status": "online",
        "version": app.version,
        "timestamp": datetime.now().astimezone().isoformat(),
    }


@app.get("/api/events")
async def get_events():
    return events[:8]


@app.post("/api/events/demo")
async def demo_event():
    add_event("USER_SIGNAL", "Тестовое событие интерфейса")
    return {"ok": True, "message": "Событие добавлено"}


@app.get("/api/modules")
async def get_modules():
    return modules


@app.post("/api/modules/{module_name}/toggle")
async def toggle_module(module_name: str):
    if module_name not in modules:
        return JSONResponse(
            status_code=404,
            content={"ok": False, "error": "Модуль не найден"},
        )

    module = modules[module_name]
    module["enabled"] = not module["enabled"]
    module["status"] = "active" if module["enabled"] else "standby"

    add_event(
        "MODULE",
        f'{module["name"]}: {"включён" if module["enabled"] else "выключен"}',
    )

    return {
        "ok": True,
        "module": module_name,
        "enabled": module["enabled"],
        "status": module["status"],
    }


@app.get("/api/status")
async def status():
    return {
        "system": "DARK.exe",
        "status": "online",
        "modules": modules,
        "events_count": len(events),
        "timestamp": datetime.now().astimezone().isoformat(),
    }
