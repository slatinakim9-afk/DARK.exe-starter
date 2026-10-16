
from fastapi import FastAPI
from fastapi.responses import HTMLResponse
from pathlib import Path

app = FastAPI(title="DARK.exe API")

ROOT = Path(__file__).resolve().parent.parent
WEB = ROOT / "app" / "static"


@app.get("/", response_class=HTMLResponse)
async def home():
    index_file = WEB / "index.html"
    if index_file.exists():
        return index_file.read_text(encoding="utf-8")
    return "<h1>DARK.exe</h1><p>System online.</p>"


@app.get("/api/health")
async def health():
    return {
        "status": "online",
        "system": "DARK.exe"
    }


@app.get("/api/events")
async def events():
    return {
        "events": [
            {"time": "00:00:01", "message": "SYSTEM INITIALIZED"},
            {"time": "00:00:02", "message": "CONNECTION ESTABLISHED"},
            {"time": "00:00:03", "message": "DARK.exe ONLINE"}
        ]
    }
