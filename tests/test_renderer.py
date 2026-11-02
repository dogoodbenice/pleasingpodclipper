import os
import subprocess
from backend.renderer import render_video

def test_video_render(tmp_path):
    # 1. Create 3s sine audio
    test_audio = str(tmp_path / "test_audio.wav")
    cmd = [
        "ffmpeg", "-y",
        "-f", "lavfi",
        "-i", "sine=frequency=440:duration=3",
        "-c:a", "pcm_s16le",
        test_audio
    ]
    subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)

    # 2. Build mock project data
    project_data = {
        "audio_path": test_audio,
        "clip_range": {"start": 0.0, "end": 2.5},
        "visuals": {
            "aspectRatio": "1:1",
            "backgroundColor": "#FFFFFF",
            "podcastTitle": "Agreeably",
            "podcastTitleColor": "#111111",
            "episodeTitle": "The quietest appliance?",
            "episodeTitleColor": "#777777",
            "logoUrl": None,
            "ctaText": "Acast",
            "ctaBgColor": "#222222",
            "ctaTextColor": "#F5A623",
            "visualizerStyle": "minimal_dot",
            "visualizerColor": "#111111",
            "captionAnimation": "karaoke",
            "activeWordColor": "#999999",
            "inactiveWordColor": "#111111",
        },
        "caption_segments": [
            {
                "id": "s1",
                "start": 0.0,
                "end": 2.5,
                "text": "None of these things exist, does it?",
                "words": [
                    {"word": "None", "start": 0.0, "end": 0.3, "bold": True, "color": None},
                    {"word": "of", "start": 0.3, "end": 0.5, "bold": True, "color": None},
                    {"word": "these", "start": 0.5, "end": 0.9, "bold": True, "color": None},
                    {"word": "things", "start": 0.9, "end": 1.4, "bold": True, "color": None},
                    {"word": "exist,", "start": 1.4, "end": 1.9, "bold": True, "color": None},
                    {"word": "does", "start": 1.9, "end": 2.2, "bold": False, "color": "#06B6D4"},
                    {"word": "it?", "start": 2.2, "end": 2.5, "bold": False, "color": None},
                ]
            }
        ]
    }

    out_mp4 = str(tmp_path / "output_test.mp4")
    progress_records = []
    
    def on_progress(p):
        progress_records.append(p)

    res = render_video(project_data, out_mp4, fps=30, progress_callback=on_progress)
    assert os.path.exists(res)
    assert os.path.getsize(res) > 10000
    assert len(progress_records) > 0
    print(f"Rendered video successfully! Size: {os.path.getsize(res)} bytes, Progress events: {len(progress_records)}")

if __name__ == "__main__":
    import tempfile
    from pathlib import Path
    with tempfile.TemporaryDirectory() as td:
        test_video_render(Path(td))
