import os
import time
import subprocess
from fastapi.testclient import TestClient
from backend.main import app

def test_full_render_pipeline(tmp_path):
    # 1. Create 3s sample audio in data/media
    media_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "data", "media"))
    os.makedirs(media_dir, exist_ok=True)
    sample_audio = os.path.join(media_dir, "test_e2e_audio.wav")
    
    cmd = [
        "ffmpeg", "-y",
        "-f", "lavfi",
        "-i", "sine=frequency=500:duration=3",
        "-c:a", "pcm_s16le",
        sample_audio
    ]
    subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)

    client = TestClient(app)

    # 2. Build project draft payload
    project_payload = {
        "name": "E2E Test Episode",
        "audio_path": sample_audio,
        "clip_range": {"start": 0.0, "end": 2.5},
        "visuals": {
            "aspectRatio": "9:16",
            "backgroundColor": "#0F172A",
            "podcastTitle": "Agreeably",
            "podcastTitleColor": "#FFFFFF",
            "episodeTitle": "The quietest appliance?",
            "episodeTitleColor": "#94A3B8",
            "logoUrl": None,
            "ctaText": "Acast",
            "ctaBgColor": "#1E293B",
            "ctaTextColor": "#38BDF8",
            "visualizerStyle": "waveform_bars",
            "visualizerColor": "#38BDF8",
            "captionAnimation": "karaoke",
            "activeWordColor": "#38BDF8",
            "inactiveWordColor": "#FFFFFF"
        },
        "caption_segments": [
            {
                "id": "seg_e2e_1",
                "start": 0.0,
                "end": 2.5,
                "text": "None of these things exist, does it?",
                "words": [
                    {"word": "None", "start": 0.0, "end": 0.3, "effect": "wave", "color": None},
                    {"word": "", "start": 0.25, "end": 0.28, "color": None},
                    {"word": "of", "start": 0.3, "end": 0.5, "bold": True, "color": None},
                    {"word": "these", "start": 0.5, "end": 0.9, "bold": True, "color": None},
                    {"word": "things", "start": 0.9, "end": 1.4, "bold": True, "color": None},
                    {"word": "exist,", "start": 1.4, "end": 1.9, "bold": True, "color": None},
                    {"word": "does", "start": 1.9, "end": 2.2, "bold": False, "color": "#F59E0B"},
                    {"word": "it?", "start": 2.2, "end": 2.5, "bold": False, "color": None}
                ]
            }
        ]
    }

    # 3. Post render job
    response = client.post("/api/render", json=project_payload)
    assert response.status_code == 200
    job_data = response.json()
    job_id = job_data["job_id"]
    assert job_id is not None

    # 4. Poll until complete
    completed = False
    for _ in range(30):
        time.sleep(0.5)
        status_res = client.get(f"/api/render/{job_id}")
        assert status_res.status_code == 200
        cur_job = status_res.json()
        if cur_job["status"] == "completed":
            completed = True
            download_url = cur_job["download_url"]
            break
        elif cur_job["status"] == "failed":
            raise RuntimeError(f"Render failed: {cur_job.get('error')}")

    assert completed, "Render did not complete in time"
    assert download_url is not None

    # 5. Verify the generated MP4 file with ffprobe
    exports_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "data", "exports"))
    exported_file = os.path.join(exports_dir, os.path.basename(download_url))
    assert os.path.exists(exported_file)
    assert os.path.getsize(exported_file) > 10000

    probe_cmd = [
        "ffprobe", "-v", "error",
        "-show_entries", "stream=width,height,codec_name",
        "-of", "json",
        exported_file
    ]
    probe_res = subprocess.run(probe_cmd, stdout=subprocess.PIPE, text=True, check=True)
    import json
    probe_data = json.loads(probe_res.stdout)
    streams = probe_data.get("streams", [])
    video_stream = next((s for s in streams if s.get("width") is not None), None)
    assert video_stream is not None
    assert video_stream["width"] == 1080
    assert video_stream["height"] == 1920
    print("E2E Render test passed: 1080x1920 9:16 vertical video rendered successfully!")

if __name__ == "__main__":
    import tempfile
    from pathlib import Path
    with tempfile.TemporaryDirectory() as td:
        test_full_render_pipeline(Path(td))
