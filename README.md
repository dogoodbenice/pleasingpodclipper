# PleasingPodClipper 🎙️🎬

A standalone podcast audiogram and social clip generator designed to turn audio episodes into high-engagement video clips for **TikTok, Instagram Reels, YouTube Shorts, and YouTube/LinkedIn feeds**.

Designed for the **Agreeably Podcast** and general podcast creators.

---

## ✨ Features

- **Episode-Level Waveform & Fast Clip Trimming:**
  - Load full ~45-minute audio files (`.mp3`, `.wav`, `.m4a`).
  - Generates waveform amplitude peaks in ~0.1s.
  - Interactive draggable handles to select 30–60 second clips (or up to 10 minutes).
- **Fast Offline AI Transcription (`faster-whisper`):**
  - Runs 100% locally on your machine with CTranslate2 — no API keys, no subscriptions, zero data leaves your Mac.
  - Slices and transcribes only your chosen range in **1–3 seconds** with word-level timestamps.
- **Interactive Transcript & Word Styling Editor:**
  - View synchronized transcript blocks alongside playback.
  - Click any word to make it **Bold**, assign **Custom Colors**, or **Split/Merge** blocks.
  - Dual kinetic caption animation styles:
    - **Karaoke Mode:** Wrapped multi-line text with dynamic active-word highlight.
    - **Hormozi Mode:** Punchy, centered word-by-word display.
- **Customizable Visual Canvas (WYSIWYG 60FPS Preview):**
  - **Header:** Podcast title, episode title, and uploaded cover art/logo.
  - **Progress Visualizers:** Minimalist line + dot scrubber (matching screenshot) or animated audio frequency spectrum bars.
  - **CTA Badge:** Customizable bottom-right badge (e.g. "Acast", "Listen on Spotify") with custom colors.
  - **Colors & Theming:** Freely customize background color/gradient, text colors, and fonts.
- **Multi-Format Social Media Export:**
  - `9:16 Vertical` ($1080 \times 1920$) for TikTok, Instagram Reels, YouTube Shorts.
  - `1:1 Square` ($1080 \times 1080$) for Instagram Feed, LinkedIn, Twitter/X.
  - `16:9 Wide` ($1920 \times 1080$) for YouTube standard.
  - **Hardware-Accelerated Video Rendering:** Uses Apple Silicon VideoToolbox (`h264_videotoolbox`) in FFmpeg to export 1080p video in just 2–4 seconds!
- **Local Drafts & WIP System:**
  - Silent auto-save with `● Saved` indicator.
  - "Drafts" drawer to resume work, delete drafts, or **Duplicate Clips** to make multiple clips from the same episode without re-transcribing.

---

## 🚀 Quick Start

### 1. Launch the Studio

Run the launcher script from the project root:

```bash
python run.py
```

This starts the backend and automatically opens the studio in your browser at:
`http://127.0.0.1:8000/`

For live hot-reloading development (Vite + FastAPI):
```bash
python run.py --dev
```

---

## 🛠️ Tech Stack & Architecture

- **Backend:** Python 3.11, FastAPI, Uvicorn, faster-whisper, Pillow, FFmpeg 7
- **Frontend:** React 18, TypeScript, Vite 5, TailwindCSS, Lucide-React, HTML5 2D Canvas
- **Video Compositor:** Python Pillow frame compositor piped directly into FFmpeg H.264 VideoToolbox hardware encoder.

---

## 🧪 Testing

Run automated tests:

```bash
# Test audio metadata, waveform peaks, and project storage
PYTHONPATH=. ./venv/bin/python tests/test_backend.py

# Test video rendering pipeline
PYTHONPATH=. ./venv/bin/python tests/test_renderer.py

# Test full end-to-end API rendering and ffprobe stream verification
PYTHONPATH=. ./venv/bin/python tests/test_e2e_render.py
```
