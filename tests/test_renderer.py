import os
import subprocess
from PIL import Image
from backend.renderer import render_video, is_renderable_token, is_wave_token

def test_empty_tokens_are_skipped():
    assert is_renderable_token({"word": ""}) is False
    assert is_renderable_token({"word": "   "}) is False
    assert is_renderable_token({"word": "yeah"}) is True
    assert is_renderable_token({"type": "image", "imageUrl": "/media/a.png"}) is True
    assert is_wave_token({"word": "YEAH", "effect": "wave"}) is True
    assert is_wave_token({"type": "image", "imageUrl": "x", "effect": "wave"}) is False

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

    overlay_png = str(tmp_path / "overlay.png")
    Image.new("RGBA", (80, 80), (255, 120, 0, 255)).save(overlay_png)
    inline_png = str(tmp_path / "inline.png")
    Image.new("RGBA", (64, 40), (0, 180, 255, 255)).save(inline_png)

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
                    {"word": "None", "start": 0.0, "end": 0.3, "effect": "wave", "color": None},
                    {"word": "", "start": 0.3, "end": 0.4, "color": None},
                    {"word": "of", "start": 0.3, "end": 0.5, "color": None},
                    {"word": "these", "start": 0.5, "end": 0.9, "color": None},
                    {"word": "things", "start": 0.9, "end": 1.4, "color": None},
                    {"word": "exist,", "start": 1.4, "end": 1.9, "color": None},
                    {"type": "image", "word": "", "imageUrl": inline_png, "start": 1.5, "end": 1.8},
                    {"word": "does", "start": 1.9, "end": 2.2, "color": "#06B6D4"},
                    {"word": "it?", "start": 2.2, "end": 2.5, "color": None},
                ]
            }
        ],
        "overlays": [
            {"id": "ov1", "url": overlay_png, "start": 0.2, "end": 1.2, "x": 0.5, "y": 0.45, "scale": 0.2}
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
