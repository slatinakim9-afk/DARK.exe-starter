
from datetime import datetime
from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

app = FastAPI(title="DARK.exe API")

ROOT = Path(__file__).resolve().parent.parent
WEB = ROOT / "app" / "static"

events = [
    {
        "type": "SYSTEM",
        "detail": "DARK.exe ONLINE",
        "created_at": datetime.now().astimezone().isoformat()
    }
]

app.mount(
    "/static",
    StaticFiles(directory=str(WEB)),
    name="static"
)


@app.get("/")
async def home():
    return FileResponse(WEB / "index.html")


@app.get("/api/health")
async def health():
    return {
        "system": "DARK.exe",
        "status": "online"
    }


@app.get("/api/events")
async def get_events():
    return events[:8]


@app.post("/api/events/demo")
async def demo_event():
    events.insert(0, {
        "type": "USER_SIGNAL",
        "detail": "Тестовое событие интерфейса",
        "created_at": datetime.now().astimezone().isoformat()
    })
    return {"ok": True}
