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

def is_image_token(token: Dict[str, Any]) -> bool:
    return token.get("type") == "image" and bool(token.get("imageUrl"))


def is_renderable_token(token: Dict[str, Any]) -> bool:
    if is_image_token(token):
        return True
    return bool(str(token.get("word", "")).strip())


def is_wave_token(token: Dict[str, Any]) -> bool:
    return not is_image_token(token) and token.get("effect") == "wave"


def layout_arc_run(
    chars: List[Dict[str, Any]],
    font_size: int,
    origin_x: float,
    baseline_y: float,
    variant: int = 0,
) -> List[Dict[str, Any]]:
    total_width = sum(c["width"] for c in chars) or float(font_size)
    v = abs(int(variant)) % 5
    walked = 0.0
    glyphs = []

    if v == 0:
        radius = max(font_size * 1.8, total_width / 1.6)
        sweep = min(math.pi * 0.9, total_width / radius)
        rise = radius * (1 - math.cos(sweep / 2))
        cx = origin_x + total_width / 2
        cy = baseline_y + radius - rise * 0.15
        for c in chars:
            t = 0.5 if total_width <= 0 else (walked + c["width"] / 2) / total_width
            walked += c["width"]
            theta = -sweep / 2 + t * sweep
            glyphs.append({
                "char": c["char"],
                "x": cx + radius * math.sin(theta),
                "y": cy - radius * math.cos(theta),
                "angle": theta,
                "token_index": c["token_index"],
            })
    elif v == 1:
        radius = max(font_size * 1.8, total_width / 1.6)
        sweep = min(math.pi * 0.9, total_width / radius)
        rise = radius * (1 - math.cos(sweep / 2))
        cx = origin_x + total_width / 2
        cy = baseline_y - radius + rise * 0.15
        for c in chars:
            t = 0.5 if total_width <= 0 else (walked + c["width"] / 2) / total_width
            walked += c["width"]
            theta = -sweep / 2 + t * sweep
            glyphs.append({
                "char": c["char"],
                "x": cx + radius * math.sin(theta),
                "y": cy + radius * math.cos(theta),
                "angle": -theta,
                "token_index": c["token_index"],
            })
    else:
        cycles = 1.5 if v == 4 else 1.0
        sign = -1.0 if v == 3 else 1.0
        amplitude = min(font_size * 0.5, total_width * 0.18)
        for c in chars:
            t = 0.5 if total_width <= 0 else (walked + c["width"] / 2) / total_width
            walked += c["width"]
            phase = t * math.pi * 2 * cycles
            y_offset = sign * math.sin(phase) * amplitude
            slope = sign * math.cos(phase) * amplitude * ((math.pi * 2 * cycles) / max(1.0, total_width))
            angle = math.atan(slope) * 0.85
            glyphs.append({
                "char": c["char"],
                "x": origin_x + (walked - c["width"] / 2),
                "y": baseline_y + y_offset,
                "angle": angle,
                "token_index": c["token_index"],
            })
    return glyphs


def load_image_cache(urls: List[str]) -> Dict[str, Image.Image]:
    cache: Dict[str, Image.Image] = {}
    for url in urls:
        path = resolve_media_path(url)
        if not path or not os.path.exists(path):
            continue
        try:
            with Image.open(path) as img:
                cache[url] = img.convert("RGBA")
        except Exception as e:
            print("Failed to load overlay/inline image:", url, e)
    return cache


def draw_rotated_glyph(
    frame: Image.Image,
    char: str,
    font: ImageFont.FreeTypeFont,
    color: Tuple[int, int, int],
    x: float,
    y: float,
    angle_rad: float,
) -> None:
    dummy = ImageDraw.Draw(frame)
    bbox = dummy.textbbox((0, 0), char, font=font)
    gw = max(1, bbox[2] - bbox[0] + 8)
    gh = max(1, bbox[3] - bbox[1] + 8)
    glyph = Image.new("RGBA", (gw, gh), (0, 0, 0, 0))
    gdraw = ImageDraw.Draw(glyph)
    gdraw.text((4 - bbox[0], 4 - bbox[1]), char, font=font, fill=color + (255,))
    degrees = -math.degrees(angle_rad)
    rotated = glyph.rotate(degrees, expand=True, resample=Image.Resampling.BICUBIC)
    px = int(x - rotated.width / 2)
    py = int(y - rotated.height / 2)
    frame.paste(rotated, (px, py), rotated)


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
    overlays = project_data.get("overlays", []) or []
    caption_font_size = int(width * (0.075 if aspect_ratio == "9:16" else 0.065))
    line_height = int(caption_font_size * 1.35)
    font_bold = get_system_font(caption_font_size, bold=True)

    image_urls: List[str] = []
    for overlay in overlays:
        if overlay.get("url"):
            image_urls.append(overlay["url"])
    for seg in segments:
        for token in seg.get("words", []):
            if is_image_token(token) and token.get("imageUrl"):
                image_urls.append(token["imageUrl"])
    image_cache = load_image_cache(image_urls)

    active_word_color = hex_to_rgb(visuals.get("activeWordColor", "#999999"), (153, 153, 153))
    inactive_word_color = hex_to_rgb(visuals.get("inactiveWordColor", "#111111"), (17, 17, 17))
    highlight_style = visuals.get("highlightStyle", "color")
    highlight_bg_color = hex_to_rgb(visuals.get("highlightBgColor", "#06B6D4"), (6, 182, 212))
    font_pop = get_system_font(int(caption_font_size * 1.15), bold=True)
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

        # Timed overlays (behind captions)
        for overlay in overlays:
            if not (overlay.get("start", 0) <= current_time <= overlay.get("end", 0)):
                continue
            img = image_cache.get(overlay.get("url"))
            if img is None:
                continue
            scale = float(overlay.get("scale", 0.35))
            draw_w = int(width * scale)
            draw_h = max(1, int(draw_w * (img.height / max(1, img.width))))
            ox = int(float(overlay.get("x", 0.5)) * width - draw_w / 2)
            oy = int(float(overlay.get("y", 0.45)) * height - draw_h / 2)
            resized = img.resize((draw_w, draw_h), Image.Resampling.LANCZOS)
            frame.paste(resized, (ox, oy), resized)

        # Draw Captions
        active_seg = None
        for seg in segments:
            if seg.get("start", 0) - 0.05 <= current_time <= seg.get("end", 0) + 0.1:
                active_seg = seg
                break

        if active_seg:
            words = [w for w in active_seg.get("words", []) if is_renderable_token(w)]
            caption_mode = visuals.get("captionAnimation", "karaoke")

            if caption_mode == "hormozi":
                active_w = None
                for w in words:
                    if is_image_token(w):
                        continue
                    if w.get("start", 0) <= current_time <= w.get("end", 0):
                        active_w = w
                        break

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
                items: List[Dict[str, Any]] = []
                idx = 0
                while idx < len(words):
                    token = words[idx]
                    if is_image_token(token):
                        img = image_cache.get(token.get("imageUrl"))
                        box_h = int(caption_font_size * 1.4)
                        aspect = (img.width / img.height) if img else 1.0
                        items.append({
                            "kind": "image",
                            "token": token,
                            "width": box_h * aspect,
                            "height": box_h,
                        })
                        idx += 1
                        continue
                    if is_wave_token(token):
                        run = []
                        while idx < len(words) and is_wave_token(words[idx]):
                            run.append(words[idx])
                            idx += 1
                        chars = []
                        total_w = 0
                        for ti, tkn in enumerate(run):
                            text = tkn.get("word", "") + (" " if ti < len(run) - 1 else "")
                            for ch in text:
                                bbox = draw.textbbox((0, 0), ch, font=font_bold)
                                cw = bbox[2] - bbox[0]
                                chars.append({"char": ch, "width": cw, "token_index": ti})
                                total_w += cw
                        items.append({"kind": "wave", "tokens": run, "width": total_w, "chars": chars})
                        continue

                    token_str = token.get("word", "") + " "
                    bbox = draw.textbbox((0, 0), token_str, font=font_bold)
                    items.append({
                        "kind": "word",
                        "token": token,
                        "width": bbox[2] - bbox[0],
                        "is_active": token.get("start", 0) <= current_time <= token.get("end", 0),
                    })
                    idx += 1

                lines: List[List[Dict[str, Any]]] = [[]]
                curr_w = 0
                for item in items:
                    if curr_w + item["width"] > max_line_width and lines[-1]:
                        lines.append([])
                        curr_w = 0
                    lines[-1].append(item)
                    curr_w += item["width"]

                extra_rise = caption_font_size * 0.55 if any(it["kind"] == "wave" for line in lines for it in line) else 0
                total_caption_h = len(lines) * line_height + extra_rise
                start_y = height // 2 - total_caption_h // 2

                for line_idx, line in enumerate(lines):
                    line_y = start_y + line_idx * line_height
                    line_x = pad_x

                    for item in line:
                        if item["kind"] == "image":
                            img = image_cache.get(item["token"].get("imageUrl"))
                            if img is not None:
                                resized = img.resize(
                                    (max(1, int(item["width"])), max(1, int(item["height"]))),
                                    Image.Resampling.LANCZOS,
                                )
                                frame.paste(
                                    resized,
                                    (int(line_x), int(line_y - item["height"] / 2)),
                                    resized,
                                )
                            line_x += item["width"] + caption_font_size * 0.15
                            continue

                        if item["kind"] == "wave":
                            first_tok = item["tokens"][0] if item["tokens"] else {}
                            tok_var = first_tok.get("waveVariant")
                            if tok_var is None:
                                tok_id = str(first_tok.get("id", "0"))
                                tok_var = sum(ord(ch) for ch in tok_id) % 5
                            glyphs = layout_arc_run(
                                item["chars"],
                                caption_font_size,
                                line_x,
                                line_y + caption_font_size * 0.4,
                                variant=int(tok_var),
                            )
                            for g in glyphs:
                                tok = item["tokens"][g["token_index"]]
                                is_active = tok.get("start", 0) <= current_time <= tok.get("end", 0)
                                color = hex_to_rgb(
                                    tok.get("color"),
                                    active_word_color if is_active else inactive_word_color,
                                )
                                draw_rotated_glyph(
                                    frame, g["char"], font_bold, color, g["x"], g["y"], g["angle"]
                                )
                            line_x += item["width"]
                            continue

                        tok = item["token"]
                        is_active = item["is_active"]
                        word_str = tok.get("word", "")

                        if is_active:
                            color = hex_to_rgb(tok.get("color"), active_word_color)
                            w_bbox = draw.textbbox((0, 0), word_str, font=font_bold)
                            w_width = w_bbox[2] - w_bbox[0]

                            if highlight_style == "pill":
                                pill_pad_x = int(caption_font_size * 0.22)
                                pill_h = int(caption_font_size * 1.15)
                                pill_radius = int(caption_font_size * 0.25)
                                draw.rounded_rectangle(
                                    (
                                        int(line_x - pill_pad_x),
                                        int(line_y - (pill_h - (w_bbox[3] - w_bbox[1])) / 2),
                                        int(line_x + w_width + pill_pad_x),
                                        int(line_y + pill_h - (pill_h - (w_bbox[3] - w_bbox[1])) / 2),
                                    ),
                                    radius=pill_radius,
                                    fill=highlight_bg_color + (255,),
                                )
                                draw.text((line_x, line_y), word_str, fill=color + (255,), font=font_bold)
                            elif highlight_style == "pop":
                                pop_bbox = draw.textbbox((0, 0), word_str, font=font_pop)
                                pop_w = pop_bbox[2] - pop_bbox[0]
                                pop_x = line_x - (pop_w - w_width) / 2
                                pop_y = line_y - (pop_bbox[3] - pop_bbox[1] - (w_bbox[3] - w_bbox[1])) / 2
                                draw.text((pop_x, pop_y), word_str, fill=color + (255,), font=font_pop)
                            else:
                                draw.text((line_x, line_y), word_str, fill=color + (255,), font=font_bold)
                                if highlight_style == "underline":
                                    line_h = max(3, int(caption_font_size * 0.09))
                                    line_u_y = line_y + int(caption_font_size * 1.15)
                                    draw.rounded_rectangle(
                                        (int(line_x), int(line_u_y), int(line_x + w_width), int(line_u_y + line_h)),
                                        radius=line_h // 2,
                                        fill=color + (255,),
                                    )
                        else:
                            color = hex_to_rgb(tok.get("color"), inactive_word_color)
                            draw.text((line_x, line_y), word_str, fill=color + (255,), font=font_bold)
                        line_x += item["width"]

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
