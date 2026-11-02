import os
import subprocess
import math
import uuid
from typing import Dict, Any, Callable, Optional, List, Tuple
from PIL import Image, ImageDraw, ImageFont
from .audio_utils import resolve_media_path

def get_system_font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    """Find and return an appropriate TrueType font on macOS or fallback."""
    candidate_paths = [
        "/System/Library/Fonts/Helvetica.ttc",
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf" if bold else "/System/Library/Fonts/Supplemental/Arial.ttf",
        "/System/Library/Fonts/Supplemental/Arial.ttf",
        "/Library/Fonts/Arial.ttf",
    ]
    for p in candidate_paths:
        if os.path.exists(p):
            try:
                # index 1 or 0 for TTC collections
                return ImageFont.truetype(p, size=size, index=1 if bold and p.endswith(".ttc") else 0)
            except Exception:
                try:
                    return ImageFont.truetype(p, size=size)
                except Exception:
                    continue
    return ImageFont.load_default()

def hex_to_rgb(hex_str: Optional[str], default: Tuple[int, int, int] = (255, 255, 255)) -> Tuple[int, int, int]:
    """Convert hex string e.g. #FFFFFF to (255, 255, 255)."""
    if not hex_str or not hex_str.startswith("#"):
        return default
    try:
        hex_clean = hex_str.lstrip("#")
        if len(hex_clean) == 3:
            hex_clean = "".join([c * 2 for c in hex_clean])
        return tuple(int(hex_clean[i:i+2], 16) for i in (0, 2, 4))
    except Exception:
        return default

def get_dimensions(aspect_ratio: str) -> Tuple[int, int]:
    if aspect_ratio == "9:16":
        return 1080, 1920
    elif aspect_ratio == "16:9":
        return 1920, 1080
    else:
        return 1080, 1080

def create_base_layer(
    width: int,
    height: int,
    visuals: Dict[str, Any],
    logo_path: Optional[str]
) -> Tuple[Image.Image, Tuple[int, int, int, int]]:
    """
    Pre-renders static elements (background + header + logo).
    Returns (base_image, (pad_x, top_y, logo_size, bottom_y)).
    """
    bg_color = hex_to_rgb(visuals.get("backgroundColor", "#FFFFFF"), (255, 255, 255))
    base = Image.new("RGBA", (width, height), bg_color + (255,))
    draw = ImageDraw.Draw(base)

    pad_x = int(width * 0.08)
    top_y = int(height * 0.08)
    bottom_y = int(height * 0.88)

    # 1. Header Titles
    title_text = visuals.get("podcastTitle", "Podcast Title")
    subtitle_text = visuals.get("episodeTitle", "Episode Title")
    title_color = hex_to_rgb(visuals.get("podcastTitleColor", "#111111"), (17, 17, 17))
    subtitle_color = hex_to_rgb(visuals.get("episodeTitleColor", "#666666"), (102, 102, 102))

    title_size = int(width * 0.048)
    subtitle_size = int(width * 0.038)

    title_font = get_system_font(title_size, bold=True)
    subtitle_font = get_system_font(subtitle_size, bold=False)

    draw.text((pad_x, top_y), title_text, fill=title_color + (255,), font=title_font)
    draw.text((pad_x, top_y + int(title_size * 1.3)), subtitle_text, fill=subtitle_color + (255,), font=subtitle_font)

    # 2. Cover Art / Logo (Top Right)
    logo_size = int(width * 0.15)
    logo_x = width - pad_x - logo_size
    logo_y = top_y

    if logo_path and os.path.exists(logo_path):
        try:
            with Image.open(logo_path) as logo_img:
                logo_resized = logo_img.convert("RGBA").resize((logo_size, logo_size), Image.Resampling.LANCZOS)
                
                # Create rounded mask
                mask = Image.new("L", (logo_size, logo_size), 0)
                mask_draw = ImageDraw.Draw(mask)
                radius = int(logo_size * 0.15)
                mask_draw.rounded_rectangle((0, 0, logo_size, logo_size), radius=radius, fill=255)
                
                base.paste(logo_resized, (logo_x, logo_y), mask)
        except Exception as e:
            print("Failed to load logo in renderer:", e)
    else:
        # Default placeholder rounded box
        radius = int(logo_size * 0.15)
        draw.rounded_rectangle((logo_x, logo_y, logo_x + logo_size, logo_y + logo_size), radius=radius, fill=(226, 232, 240, 255))

    return base, (pad_x, top_y, logo_size, bottom_y)

def render_video(
    project_data: Dict[str, Any],
    output_path: str,
    fps: int = 30,
    progress_callback: Optional[Callable[[float], None]] = None
) -> str:
    """
    Renders the complete audiogram video using Pillow and hardware-accelerated FFmpeg.
    """
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    
    audio_path = resolve_media_path(project_data.get("audio_path"))
    if not audio_path or not os.path.exists(audio_path):
        raise FileNotFoundError(f"Audio file not found: {project_data.get('audio_path')}")
        
    clip_range = project_data.get("clip_range", {"start": 0.0, "end": 30.0})
    clip_start = float(clip_range.get("start", 0.0))
    clip_end = float(clip_range.get("end", 30.0))
    duration = max(0.5, clip_end - clip_start)

    visuals = project_data.get("visuals", {})
    aspect_ratio = visuals.get("aspectRatio", "1:1")
    width, height = get_dimensions(aspect_ratio)

    # Resolve logo path
    logo_path = resolve_media_path(visuals.get("logoUrl"))


    # 1. Pre-render static base layer
    base_image, (pad_x, top_y, logo_size, bottom_y) = create_base_layer(width, height, visuals, logo_path)

    # 2. Prepare Subtitle Segments
    segments = project_data.get("caption_segments", [])
    caption_font_size = int(width * (0.075 if aspect_ratio == "9:16" else 0.065))
    line_height = int(caption_font_size * 1.35)
    font_bold = get_system_font(caption_font_size, bold=True)
    font_regular = get_system_font(caption_font_size, bold=False)

    active_word_color = hex_to_rgb(visuals.get("activeWordColor", "#999999"), (153, 153, 153))
    inactive_word_color = hex_to_rgb(visuals.get("inactiveWordColor", "#111111"), (17, 17, 17))
    vis_color = hex_to_rgb(visuals.get("visualizerColor", "#111111"), (17, 17, 17))
    cta_bg = hex_to_rgb(visuals.get("ctaBgColor", "#222222"), (34, 34, 34))
    cta_text_color = hex_to_rgb(visuals.get("ctaTextColor", "#F5A623"), (245, 166, 35))
    cta_text = visuals.get("ctaText", "Acast")
    cta_font = get_system_font(int(width * 0.042), bold=True)

    # 3. Setup FFmpeg Process with Hardware Acceleration
    # Try h264_videotoolbox first, fallback to libx264
    total_frames = int(duration * fps)

    ffmpeg_cmd = [
        "ffmpeg", "-y",
        "-f", "rawvideo",
        "-vcodec", "rawvideo",
        "-s", f"{width}x{height}",
        "-pix_fmt", "rgba",
        "-r", str(fps),
        "-i", "-", # stdin
        "-ss", str(clip_start),
        "-t", str(duration),
        "-i", audio_path,
        "-c:v", "h264_videotoolbox",
        "-b:v", "8000k",
        "-pix_fmt", "yuv420p",
        "-c:a", "aac",
        "-b:a", "192k",
        "-shortest",
        output_path
    ]

    try:
        proc = subprocess.Popen(ffmpeg_cmd, stdin=subprocess.PIPE, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
    except Exception:
        # Fallback to libx264
        ffmpeg_cmd[ffmpeg_cmd.index("h264_videotoolbox")] = "libx264"
        proc = subprocess.Popen(ffmpeg_cmd, stdin=subprocess.PIPE, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)

    max_line_width = width - pad_x * 2

    # 4. Render Frames Loop
    for frame_idx in range(total_frames):
        current_time = clip_start + (frame_idx / fps)
        frame = base_image.copy()
        draw = ImageDraw.Draw(frame)

        # Draw Captions
        active_seg = None
        for seg in segments:
            if seg.get("start", 0) - 0.05 <= current_time <= seg.get("end", 0) + 0.1:
                active_seg = seg
                break

        if active_seg:
            words = active_seg.get("words", [])
            caption_mode = visuals.get("captionAnimation", "karaoke")

            if caption_mode == "hormozi":
                # Hormozi: Show single punchy active word in center
                active_w = None
                for w in words:
                    if w.get("start", 0) <= current_time <= w.get("end", 0):
                        active_w = w
                        break
                if not active_w and words:
                    active_w = words[0]

                if active_w:
                    word_str = active_w.get("word", "").upper()
                    w_color = hex_to_rgb(active_w.get("color"), active_word_color)
                    h_font = get_system_font(int(caption_font_size * 1.4), bold=True)
                    bbox = draw.textbbox((0, 0), word_str, font=h_font)
                    text_w = bbox[2] - bbox[0]
                    text_h = bbox[3] - bbox[1]
                    draw.text(
                        (width // 2 - text_w // 2, height // 2 - text_h // 2),
                        word_str,
                        fill=w_color + (255,),
                        font=h_font
                    )
            else:
                # Karaoke Mode: Wrap text and highlight active word
                lines: List[List[Dict[str, Any]]] = [[]]
                curr_w = 0

                for token in words:
                    token_str = token.get("word", "") + " "
                    token_font = font_bold if token.get("bold") else font_regular
                    bbox = draw.textbbox((0, 0), token_str, font=token_font)
                    w_box = bbox[2] - bbox[0]

                    if curr_w + w_box > max_line_width and lines[-1]:
                        lines.append([])
                        curr_w = 0

                    is_active = token.get("start", 0) <= current_time <= token.get("end", 0)
                    lines[-1].append({
                        "token": token,
                        "str": token.get("word", ""),
                        "space_w": w_box,
                        "is_active": is_active,
                        "font": token_font
                    })
                    curr_w += w_box

                total_caption_h = len(lines) * line_height
                start_y = height // 2 - total_caption_h // 2

                for line_idx, line in enumerate(lines):
                    line_y = start_y + line_idx * line_height
                    line_x = pad_x

                    for item in line:
                        tok = item["token"]
                        is_active = item["is_active"]
                        f_font = font_bold if is_active or tok.get("bold") else font_regular

                        if is_active:
                            color = hex_to_rgb(tok.get("color"), active_word_color)
                        else:
                            color = hex_to_rgb(tok.get("color"), inactive_word_color)

                        draw.text((line_x, line_y), item["str"], fill=color + (255,), font=f_font)
                        line_x += item["space_w"]

        # Draw Progress Bar / Visualizer (Bottom-Left)
        progress = min(1.0, max(0.0, (current_time - clip_start) / duration))
        vis_style = visuals.get("visualizerStyle", "minimal_dot")

        if vis_style == "minimal_dot":
            bar_w = int(width * 0.22)
            bar_h = max(6, int(height * 0.016))
            radius = bar_h // 2
            dot_radius = int(bar_h * 1.35)

            # Scrubber track pill
            draw.rounded_rectangle(
                (pad_x, bottom_y - bar_h // 2, pad_x + bar_w, bottom_y + bar_h // 2),
                radius=radius,
                fill=vis_color + (255,)
            )

            # Scrubber dot
            dot_x = int(pad_x + progress * bar_w)
            draw.ellipse(
                (dot_x - dot_radius, bottom_y - dot_radius, dot_x + dot_radius, bottom_y + dot_radius),
                fill=vis_color + (255,)
            )
        else:
            # Waveform spectrum bars
            bar_count = 20
            total_vis_w = int(width * 0.32)
            bar_spacing = total_vis_w / bar_count
            bar_w = int(bar_spacing * 0.55)
            max_bar_h = int(height * 0.05)

            for i in range(bar_count):
                x = int(pad_x + i * bar_spacing)
                wave = math.sin(current_time * 8.0 + i * 0.7) * 0.5 + 0.5
                h = max(4, int(wave * max_bar_h))
                draw.rounded_rectangle(
                    (x, bottom_y - h // 2, x + bar_w, bottom_y + h // 2),
                    radius=bar_w // 2,
                    fill=vis_color + (255,)
                )

        # Draw CTA Badge (Bottom-Right)
        if cta_text:
            bbox = draw.textbbox((0, 0), cta_text, font=cta_font)
            text_w = bbox[2] - bbox[0]
            text_h = bbox[3] - bbox[1]
            pad_h = int(text_h * 1.4)
            pad_v = int(text_h * 0.9)
            badge_w = text_w + pad_h * 2
            badge_h = text_h + pad_v * 2
            badge_x = width - pad_x - badge_w
            badge_y = bottom_y - badge_h // 2

            draw.rounded_rectangle(
                (badge_x, badge_y, badge_x + badge_w, badge_y + badge_h),
                radius=14,
                fill=cta_bg + (255,)
            )
            draw.text(
                (badge_x + pad_h, badge_y + pad_v),
                cta_text,
                fill=cta_text_color + (255,),
                font=cta_font
            )

        # Write frame to FFmpeg stdin
        proc.stdin.write(frame.tobytes())

        if progress_callback and frame_idx % 15 == 0:
            progress_callback(frame_idx / total_frames)

    proc.stdin.close()
    proc.wait()

    if proc.returncode != 0:
        err = proc.stderr.read().decode("utf-8", errors="ignore")
        raise RuntimeError(f"FFmpeg rendering failed: {err}")

    if progress_callback:
        progress_callback(1.0)

    return output_path
