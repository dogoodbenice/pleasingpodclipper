import os
import json
import uuid
import shutil
from datetime import datetime
from typing import List, Dict, Any, Optional

PROJECTS_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "data", "projects"))
os.makedirs(PROJECTS_DIR, exist_ok=True)

def list_projects() -> List[Dict[str, Any]]:
    """Return summary metadata for all saved drafts, sorted by updated_at desc."""
    projects = []
    for entry in os.scandir(PROJECTS_DIR):
        if entry.is_dir():
            meta_path = os.path.join(entry.path, "project.json")
            if os.path.exists(meta_path):
                try:
                    with open(meta_path, "r", encoding="utf-8") as f:
                        data = json.load(f)
                        projects.append({
                            "id": data.get("id"),
                            "name": data.get("name"),
                            "created_at": data.get("created_at"),
                            "updated_at": data.get("updated_at"),
                            "audio_filename": data.get("audio_filename"),
                            "audio_duration": data.get("audio_duration", 0),
                            "clip_range": data.get("clip_range", {"start": 0, "end": 0}),
                            "aspect_ratio": data.get("visuals", {}).get("aspect_ratio", "1:1"),
                            "podcast_title": data.get("visuals", {}).get("podcast_title", ""),
                            "episode_title": data.get("visuals", {}).get("episode_title", "")
                        })
                except Exception:
                    continue
    projects.sort(key=lambda p: p.get("updated_at") or "", reverse=True)
    return projects

def get_project(project_id: str) -> Optional[Dict[str, Any]]:
    """Load complete project state from project.json."""
    project_path = os.path.join(PROJECTS_DIR, project_id, "project.json")
    if not os.path.exists(project_path):
        return None
    with open(project_path, "r", encoding="utf-8") as f:
        return json.load(f)

def save_project(project_data: Dict[str, Any]) -> Dict[str, Any]:
    """Create or update a project/draft."""
    project_id = project_data.get("id")
    if not project_id:
        project_id = f"proj_{uuid.uuid4().hex[:10]}"
        project_data["id"] = project_id
        project_data["created_at"] = datetime.utcnow().isoformat() + "Z"
        
    project_data["updated_at"] = datetime.utcnow().isoformat() + "Z"
    
    project_dir = os.path.join(PROJECTS_DIR, project_id)
    os.makedirs(project_dir, exist_ok=True)
    
    meta_path = os.path.join(project_dir, "project.json")
    with open(meta_path, "w", encoding="utf-8") as f:
        json.dump(project_data, f, indent=2, ensure_ascii=False)
        
    return project_data

def delete_project(project_id: str) -> bool:
    """Delete a project folder."""
    project_dir = os.path.join(PROJECTS_DIR, project_id)
    if os.path.exists(project_dir):
        shutil.rmtree(project_dir)
        return True
    return False

def duplicate_project(project_id: str, new_name: Optional[str] = None) -> Optional[Dict[str, Any]]:
    """Duplicate an existing project (e.g. to create another clip from the same audio file)."""
    src = get_project(project_id)
    if not src:
        return None
        
    new_id = f"proj_{uuid.uuid4().hex[:10]}"
    new_proj = dict(src)
    new_proj["id"] = new_id
    new_proj["name"] = new_name or f"{src.get('name', 'Clip')} (Copy)"
    new_proj["created_at"] = datetime.utcnow().isoformat() + "Z"
    new_proj["updated_at"] = datetime.utcnow().isoformat() + "Z"
    
    return save_project(new_proj)
