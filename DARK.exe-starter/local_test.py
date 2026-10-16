from datetime import datetime
from pathlib import Path
from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

app = FastAPI()
ROOT = Path(__file__).parent / "app"
events = []

app.mount("/static", StaticFiles(directory=ROOT / "static"), name="static")

@app.get("/")
async def home():
    return FileResponse(ROOT / "static" / "index.html")

@app.get("/api/health")
async def health():
    return {"system": "DARK.exe", "status": "online"}

@app.get("/api/events")
async def get_events():
    return events

@app.post("/api/events/demo")
async def demo():
    events.insert(0, {
        "type": "USER_SIGNAL",
        "detail": "Тестовое событие интерфейса",
        "created_at": datetime.now().astimezone().isoformat()
    })
    return {"ok": True}
