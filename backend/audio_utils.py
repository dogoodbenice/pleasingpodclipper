import os
import subprocess
import json
from typing import Dict, Any, List, Optional

def resolve_media_path(path_str: Optional[str]) -> Optional[str]:
    """
    Robustly resolves a path to an existing file in the filesystem.
    Handles:
    - Direct absolute path
    - Relative URL like '/media/xyz.mp3'
    - Filename only like 'xyz.mp3'
    - Relative to project BASE_DIR or data/media
    """
    if not path_str:
        return None
    
    # 1. Direct path that exists
    if os.path.exists(path_str):
        return os.path.abspath(path_str)
        
    base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    media_dir = os.path.join(base_dir, "data", "media")
    
    # 2. Check in data/media using basename
    base_name = os.path.basename(path_str)
    candidate_media = os.path.join(media_dir, base_name)
    if os.path.exists(candidate_media):
        return candidate_media
        
    # 3. Check directly in data/
    clean_rel = path_str.lstrip("/")
    candidate_data = os.path.join(base_dir, "data", clean_rel)
    if os.path.exists(candidate_data):
        return candidate_data

    # 4. Check directly in base_dir
    candidate_base = os.path.join(base_dir, clean_rel)
    if os.path.exists(candidate_base):
        return candidate_base

    return None


def get_audio_metadata(file_path: str) -> Dict[str, Any]:
    """Extract audio duration, channels, sample rate using ffprobe."""
    cmd = [
        "ffprobe",
        "-v", "error",
        "-show_entries", "format=duration:stream=codec_name,sample_rate,channels",
        "-of", "json",
        file_path
    ]
    result = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, check=True)
    data = json.loads(result.stdout)
    
    duration = float(data.get("format", {}).get("duration", 0.0))
    streams = data.get("streams", [])
    stream_info = streams[0] if streams else {}
    
    return {
        "duration": duration,
        "codec": stream_info.get("codec_name", "unknown"),
        "sample_rate": int(stream_info.get("sample_rate", 44100)),
        "channels": int(stream_info.get("channels", 2))
    }

def generate_waveform_peaks(file_path: str, num_peaks: int = 1200) -> List[float]:
    """
    Extract normalized peak amplitudes (0.0 to 1.0) from audio file.
    Downsamples audio to 8kHz 8-bit mono raw PCM, then extracts max peak per block.
    Fast and takes only 1-2 seconds even on a 60-minute file.
    """
    cmd = [
        "ffmpeg",
        "-i", file_path,
        "-ac", "1",
        "-ar", "8000",
        "-f", "s8",
        "-",
    ]
    process = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
    raw_data, _ = process.communicate()
    
    if not raw_data:
        return [0.0] * num_peaks
        
    total_samples = len(raw_data)
    block_size = max(1, total_samples // num_peaks)
    peaks = []
    
    for i in range(0, total_samples, block_size):
        chunk = raw_data[i:i + block_size]
        if not chunk:
            break
        # s8 is signed byte: -128 to 127
        max_val = max(abs(b if b < 128 else b - 256) for b in chunk)
        peaks.append(round(min(1.0, max_val / 128.0), 3))
        if len(peaks) >= num_peaks:
            break
            
    while len(peaks) < num_peaks:
        peaks.append(0.0)
        
    return peaks

def extract_audio_slice(input_path: str, start: float, duration: float, output_path: str) -> str:
    """Extract an audio segment between start and start+duration to output_path."""
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    cmd = [
        "ffmpeg",
        "-y",
        "-ss", str(start),
        "-t", str(duration),
        "-i", input_path,
        "-c:a", "aac",
        "-b:a", "192k",
        output_path
    ]
    subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, check=True)
    return output_path
