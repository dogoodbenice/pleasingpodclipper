import os
import subprocess
from backend.audio_utils import get_audio_metadata, generate_waveform_peaks, extract_audio_slice
from backend.storage import save_project, get_project, list_projects, duplicate_project, delete_project

def test_audio_pipeline(tmp_path):
    # Generate 3-second test WAV file using ffmpeg sine wave
    test_audio = str(tmp_path / "test.wav")
    cmd = [
        "ffmpeg", "-y",
        "-f", "lavfi",
        "-i", "sine=frequency=1000:duration=3",
        "-c:a", "pcm_s16le",
        test_audio
    ]
    subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)
    assert os.path.exists(test_audio)

    # 1. Test metadata
    meta = get_audio_metadata(test_audio)
    assert meta["duration"] >= 2.9
    assert meta["channels"] >= 1

    # 2. Test waveform peaks
    peaks = generate_waveform_peaks(test_audio, num_peaks=50)
    assert len(peaks) == 50
    assert any(p > 0 for p in peaks)

    # 3. Test audio slicing
    slice_output = str(tmp_path / "slice.m4a")
    extract_audio_slice(test_audio, start=0.5, duration=1.0, output_path=slice_output)
    assert os.path.exists(slice_output)
    slice_meta = get_audio_metadata(slice_output)
    assert 0.9 <= slice_meta["duration"] <= 1.2

def test_project_storage():
    test_draft = {
        "name": "Test Clip 1",
        "audio_filename": "sample.mp3",
        "audio_duration": 45.0,
        "clip_range": {"start": 5.0, "end": 25.0},
        "visuals": {
            "aspect_ratio": "1:1",
            "podcast_title": "Agreeably Test",
            "episode_title": "Sample Episode"
        },
        "caption_segments": []
    }

    # Save
    saved = save_project(test_draft)
    proj_id = saved["id"]
    assert proj_id is not None

    # Retrieve
    loaded = get_project(proj_id)
    assert loaded is not None
    assert loaded["name"] == "Test Clip 1"
    assert loaded["visuals"]["podcast_title"] == "Agreeably Test"

    # List
    all_projects = list_projects()
    assert any(p["id"] == proj_id for p in all_projects)

    # Duplicate
    dupe = duplicate_project(proj_id, new_name="Duplicated Clip")
    assert dupe is not None
    assert dupe["id"] != proj_id
    assert dupe["name"] == "Duplicated Clip"

    # Clean up
    delete_project(proj_id)
    delete_project(dupe["id"])
    assert get_project(proj_id) is None

if __name__ == "__main__":
    import tempfile
    from pathlib import Path
    with tempfile.TemporaryDirectory() as td:
        test_audio_pipeline(Path(td))
    test_project_storage()
    print("All tests passed successfully!")
