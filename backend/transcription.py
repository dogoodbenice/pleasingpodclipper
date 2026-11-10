import os
import uuid
from typing import List, Dict, Any, Optional
from faster_whisper import WhisperModel

# Cache model instance in memory
_MODEL_CACHE: Dict[str, WhisperModel] = {}

def get_whisper_model(model_size: str = "base.en") -> WhisperModel:
    """Retrieve or initialize a cached WhisperModel."""
    if model_size not in _MODEL_CACHE:
        # device="cpu", compute_type="int8" runs smoothly on macOS
        _MODEL_CACHE[model_size] = WhisperModel(model_size, device="cpu", compute_type="int8")
    return _MODEL_CACHE[model_size]

def transcribe_audio_slice(
    audio_path: str,
    start_offset: float = 0.0,
    model_size: str = "base.en"
) -> List[Dict[str, Any]]:
    """
    Transcribe audio file (or extracted slice) and return segments with word-level timestamps.
    All timestamps will have `start_offset` added so they align with the full episode timeline.
    """
    model = get_whisper_model(model_size)
    segments, info = model.transcribe(
        audio_path,
        beam_size=5,
        word_timestamps=True,
        vad_filter=True,
        vad_parameters=dict(min_silence_duration_ms=400)
    )
    
    results = []
    for seg in segments:
        words = []
        if seg.words:
            for w in seg.words:
                cleaned = w.word.strip()
                if not cleaned:
                    continue
                words.append({
                    "id": str(uuid.uuid4())[:8],
                    "word": cleaned,
                    "start": round(w.start + start_offset, 3),
                    "end": round(w.end + start_offset, 3),
                    "bold": True,
                    "color": None,
                    "type": "word",
                    "effect": "none",
                })
        else:
            # Fallback if word-level wasn't available
            fallback = seg.text.strip()
            if fallback:
                words.append({
                    "id": str(uuid.uuid4())[:8],
                    "word": fallback,
                    "start": round(seg.start + start_offset, 3),
                    "end": round(seg.end + start_offset, 3),
                    "bold": True,
                    "color": None,
                    "type": "word",
                    "effect": "none",
                })
            
        results.append({
            "id": str(uuid.uuid4())[:8],
            "start": round(seg.start + start_offset, 3),
            "end": round(seg.end + start_offset, 3),
            "text": seg.text.strip(),
            "words": words
        })
        
    return results
