import os
import uuid
import shutil
from typing import Optional, Dict, Any, List
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from .audio_utils import get_audio_metadata, generate_waveform_peaks, extract_audio_slice, resolve_media_path
from .transcription import transcribe_audio_slice
from .storage import list_projects, get_project, save_project, delete_project, duplicate_project

# Directory setup
BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
MEDIA_DIR = os.path.join(BASE_DIR, "data", "media")
EXPORTS_DIR = os.path.join(BASE_DIR, "data", "exports")
FRONTEND_DIST = os.path.join(BASE_DIR, "frontend", "dist")

os.makedirs(MEDIA_DIR, exist_ok=True)
os.makedirs(EXPORTS_DIR, exist_ok=True)

app = FastAPI(title="PleasingPodClipper API", version="1.0.0")

# Enable CORS for local dev
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve static media (uploaded audio, images, exported videos)
app.mount("/media", StaticFiles(directory=MEDIA_DIR), name="media")
app.mount("/exports", StaticFiles(directory=EXPORTS_DIR), name="exports")

from fastapi.responses import RedirectResponse

# Mount frontend if built
if os.path.exists(FRONTEND_DIST):
    assets_dir = os.path.join(FRONTEND_DIST, "assets")
    if os.path.exists(assets_dir):
        app.mount("/assets", StaticFiles(directory=assets_dir), name="frontend_assets")
    app.mount("/app", StaticFiles(directory=FRONTEND_DIST, html=True), name="frontend_app")

    @app.get("/")
    def index():
        return RedirectResponse(url="/app/")


class TranscribeRequest(BaseModel):
    audio_path: str
    start: float
    end: float
    model_size: str = "base.en"

@app.get("/api/health")
def health_check():
    return {"status": "ok", "app": "PleasingPodClipper"}

@app.post("/api/upload")
async def upload_file(file: UploadFile = File(...), file_type: str = Form("audio")):
    """Upload an audio file or an image (logo/cover art)."""
    ext = os.path.splitext(file.filename)[1].lower()
    unique_filename = f"{uuid.uuid4().hex[:10]}_{file.filename}"
    save_path = os.path.join(MEDIA_DIR, unique_filename)
    
    with open(save_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    relative_url = f"/media/{unique_filename}"
    
    if file_type == "audio":
        try:
            meta = get_audio_metadata(save_path)
            peaks = generate_waveform_peaks(save_path, num_peaks=1200)
            return {
                "url": relative_url,
                "file_path": save_path,
                "filename": file.filename,
                "duration": meta["duration"],
                "sample_rate": meta["sample_rate"],
                "channels": meta["channels"],
                "waveform_peaks": peaks
            }
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to process audio: {str(e)}")
            
    return {
        "url": relative_url,
        "file_path": save_path,
        "filename": file.filename
    }

@app.post("/api/transcribe")
async def transcribe_clip(req: TranscribeRequest):
    """
    Extract slice between [start, end] and transcribe with word-level timestamps.
    Returns segments with word timings aligned to the overall audio.
    """
    resolved_path = resolve_media_path(req.audio_path)
    if not resolved_path:
        raise HTTPException(status_code=404, detail=f"Audio file not found: {req.audio_path}")
    req.audio_path = resolved_path

            
    duration = max(0.5, req.end - req.start)
    slice_path = os.path.join(MEDIA_DIR, f"temp_slice_{uuid.uuid4().hex[:8]}.m4a")
    
    try:
        extract_audio_slice(req.audio_path, req.start, duration, slice_path)
        segments = transcribe_audio_slice(
            audio_path=slice_path,
            start_offset=req.start,
            model_size=req.model_size
        )
        return {
            "status": "success",
            "start": req.start,
            "end": req.end,
            "duration": duration,
            "segments": segments
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Transcription failed: {str(e)}")
    finally:
        if os.path.exists(slice_path):
            try:
                os.remove(slice_path)
            except Exception:
                pass

# Draft / Project Endpoints
@app.get("/api/projects")
def get_all_projects():
    return list_projects()

@app.get("/api/projects/{project_id}")
def load_project(project_id: str):
    proj = get_project(project_id)
    if not proj:
        raise HTTPException(status_code=404, detail="Project not found")
    return proj

@app.post("/api/projects")
def update_or_create_project(project: Dict[str, Any]):
    return save_project(project)

@app.delete("/api/projects/{project_id}")
def remove_project(project_id: str):
    if not delete_project(project_id):
        raise HTTPException(status_code=404, detail="Project not found")
    return {"status": "deleted", "id": project_id}

from .renderer import render_video

# In-memory render job status tracking
RENDER_JOBS: Dict[str, Dict[str, Any]] = {}

def run_render_task(job_id: str, project_data: Dict[str, Any], output_path: str, filename: str):
    def on_progress(p: float):
        if job_id in RENDER_JOBS:
            RENDER_JOBS[job_id]["progress"] = round(p, 2)
            
    try:
        RENDER_JOBS[job_id]["status"] = "processing"
        render_video(project_data, output_path, fps=30, progress_callback=on_progress)
        RENDER_JOBS[job_id]["status"] = "completed"
        RENDER_JOBS[job_id]["progress"] = 1.0
        RENDER_JOBS[job_id]["download_url"] = f"/exports/{filename}"
    except Exception as e:
        RENDER_JOBS[job_id]["status"] = "failed"
        RENDER_JOBS[job_id]["error"] = str(e)

@app.post("/api/render")
async def start_render(project: Dict[str, Any], background_tasks: BackgroundTasks):
    """Start an asynchronous video render job."""
    job_id = uuid.uuid4().hex[:12]
    clean_name = "".join(c for c in project.get("name", "clip") if c.isalnum() or c in (" ", "_", "-")).rstrip()
    filename = f"{clean_name}_{job_id[:6]}.mp4".replace(" ", "_")
    output_path = os.path.join(EXPORTS_DIR, filename)

    RENDER_JOBS[job_id] = {
        "job_id": job_id,
        "status": "pending",
        "progress": 0.0,
        "filename": filename,
        "download_url": None,
        "error": None
    }

    background_tasks.add_task(run_render_task, job_id, project, output_path, filename)
    return RENDER_JOBS[job_id]

@app.get("/api/render/{job_id}")
def get_render_status(job_id: str):
    """Poll render progress."""
    if job_id not in RENDER_JOBS:
        raise HTTPException(status_code=404, detail="Job not found")
    return RENDER_JOBS[job_id]

