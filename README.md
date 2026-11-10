# PleasingPodClipper

A standalone podcast audiogram and social clip generator designed to transform long-form audio episodes into high-engagement video clips for TikTok, Instagram Reels, YouTube Shorts, and standard landscape feeds.

Engineered for the [Agreeably Podcast](agreeablypodcast.com) and general content creators.

---

## Features

### Episode Waveform Analysis and Clip Trimming
- Load full audio episodes (.mp3, .wav, .m4a).
- Rapid audio waveform peak extraction in milliseconds.
- Interactive timeline scrubber with draggable In and Out handles to select clip ranges from a few seconds up to 10 minutes.
- Keyboard shortcuts for clip range boundary setting ([ for In-point, ] for Out-point).

### Local Offline AI Transcription
- Powered by `faster-whisper` and CTranslate2 running entirely on your local machine.
- Zero API keys, zero subscriptions, and complete data privacy (no audio or text is transmitted externally).
- Slices and transcribes selected clip ranges in seconds with accurate word-level timestamps.

### Interactive Transcript and Subtitle Editor
- Synchronized transcript block display matching playback in real time.
- Click any word token to immediately seek the video playhead and scrubber to that exact moment.
- Word formatting popover:
  - Custom word accent color swatches with instant reset.
  - Wavy and arc text toggle.
  - Wave shape randomization and variation cycling.
  - Inline image insertion directly into the subtitle flow.
  - Split subtitle block into two separate segments at any word boundary.
  - Permanent word token deletion.
- Caption block controls:
  - Merge current block with the subsequent block.
  - Insert blank caption blocks with custom timestamps.
  - Attach block-level media.
  - Remove caption blocks.
  - Direct micro-adjustment of start and end timestamps.

### Caption Highlighting and Kinetic Animation Styles
- **Display Modes**:
  - **Karaoke Mode**: Multi-line subtitle blocks with active spoken word highlighted dynamically.
  - **Hormozi Mode**: Punchy, centered word-by-word display optimized for rapid short-form video engagement.
- **Active Word Highlight Styles**:
  - **Color**: Clean accent color switch.
  - **Pill**: Solid background pill badge around the currently spoken word with customizable badge color.
  - **Pop**: Subtle 1.15x scale pulse on beat without disrupting neighboring words.
  - **Underline**: Rounded accent highlight bar rendered beneath the active word.

### Undulating Wavy and Arc Text Effects
- 5 mathematical wave geometry models:
  1. **Rainbow Dome (Arc Up)**: Curves upward in the center.
  2. **Smile Bowl (Arc Down)**: Curves downward in the center.
  3. **S-Wave**: Classic undulating sine curve.
  4. **Inverted S-Wave**: Inverted sine undulation.
  5. **Multi-Crest Ripple**: Fast, rhythmic ripple oscillation across character tokens.
- In-editor cycle button to quickly randomize and select different wave curves per word or run.
- Exact rendering parity: HTML5 2D Canvas in the web UI and Python Pillow compositor in the video exporter share identical arc projection formulas.

### Floating and Inline Media Overlays
- **Inline Image Tokens**: Insert screenshots or reaction graphics directly into the text stream alongside spoken words.
- **Timed Canvas Overlays**: Upload screenshot layers to display on screen for specific time windows, with direct start/end timing controls and scale adjustment sliders.

### Non-Intrusive Tooltip Guidance System
- Contextual tooltips across word controls, block headers, and action bars.
- Built with a deliberate 1-second hover delay: swift mouse navigation remains uninterrupted, while pausing over any icon reveals a clear explanation and associated keyboard shortcut.

### Comprehensive Undo and Redo System
- In-memory state history stack tracking up to 30 revisions across subtitle editing, timing changes, styling adjustments, and overlay positioning.
- Dedicated Undo and Redo buttons in the primary studio header with visual enabled/disabled states.
- System-wide keyboard shortcuts:
  - `Cmd+Z` / `Ctrl+Z`: Undo.
  - `Shift+Cmd+Z` / `Ctrl+Shift+Z` / `Ctrl+Y`: Redo.

### Visual Styling and Layout Customization
- **Aspect Ratio Presets**:
  - 9:16 Vertical (1080 x 1920) for TikTok, Instagram Reels, and YouTube Shorts.
  - 1:1 Square (1080 x 1080) for Instagram Feed, LinkedIn, and Twitter/X.
  - 16:9 Landscape (1920 x 1080) for YouTube standard and desktop presentations.
- **Branding Header**: Podcast title, episode title, and custom logo or cover art upload.
- **Audio Visualizers**: Minimalist line-and-dot progress scrubber or animated audio frequency spectrum bars.
- **Call-to-Action Badge**: Customizable footer badge (e.g., "Available on Apple Podcasts", "Listen on Spotify") with customizable pill colors and typography.
- **Theme Controls**: Solid background colors, radial and linear gradients, customizable font families, font sizes, active/inactive word colors, and highlight backgrounds.

### Hardware-Accelerated Video Rendering
- Apple Silicon VideoToolbox (`h264_videotoolbox`) hardware acceleration via FFmpeg.
- Exports full 1080p 60FPS video in 2 to 4 seconds.
- Pixel-aligned rendering engine ensuring the downloaded MP4 is identical to the browser canvas preview.

### Local Drafts and Automatic Saving
- Debounced background auto-save to local JSON files with live status indicator.
- Drafts drawer to resume ongoing projects, duplicate projects to create alternate cuts from the same audio file, or remove completed work.

---

## Keyboard Shortcuts

The studio includes keyboard navigation active whenever typing in a text field is not in progress:

| Key Binding | Action |
| --- | --- |
| `Space` / `K` | Toggle playback (play / pause) |
| `J` / `Left Arrow` | Rewind 2 seconds (Hold Shift for 5 seconds) |
| `L` / `Right Arrow` | Fast forward 2 seconds (Hold Shift for 5 seconds) |
| `[` | Set clip Start (In-point) to current playhead |
| `]` | Set clip End (Out-point) to current playhead |
| `Cmd+Z` / `Ctrl+Z` | Undo last modification |
| `Shift+Cmd+Z` / `Ctrl+Y` | Redo previously undone modification |
| `?` | Open keyboard shortcuts modal |

---

## Architecture and Technology Stack

- **Backend**:
  - Python 3.11
  - FastAPI and Uvicorn for local REST API and static asset delivery
  - `faster-whisper` and CTranslate2 for local speech-to-text inference
  - Pillow (PIL) for frame-accurate 2D graphics rendering
  - FFmpeg with VideoToolbox hardware encoding
- **Frontend**:
  - React 18 and TypeScript
  - Vite 5 build toolchain
  - Tailwind CSS for modern responsive layout
  - HTML5 2D Canvas for real-time 60FPS preview
  - Lucide-React icons
- **Data Storage**:
  - Local filesystem storage (`data/media`, `data/exports`, `data/projects`)

---

## Quick Start

### 1. Prerequisites
- macOS (Apple Silicon recommended for VideoToolbox hardware encoding)
- Python 3.10+
- Node.js 18+
- FFmpeg installed (`brew install ffmpeg`)

### 2. Launch the Studio

Run the launcher script from the repository root:

```bash
python run.py
```

The script verifies backend dependencies, initializes the local server, and automatically launches your default browser at:
`http://127.0.0.1:8000/`

For live development with hot-reloading (Vite on port 5173 and FastAPI on port 8000):
```bash
python run.py --dev
```

---

## Automated Verification and Testing

Run the test suite from the repository root:

```bash
# Test metadata extraction, waveform peaks, and draft storage
PYTHONPATH=. ./venv/bin/python tests/test_backend.py

# Test Pillow frame compositor and wave layout calculations
PYTHONPATH=. ./venv/bin/python tests/test_renderer.py

# Run complete end-to-end API test and verify exported MP4 streams
PYTHONPATH=. ./venv/bin/python tests/test_e2e_render.py
```
