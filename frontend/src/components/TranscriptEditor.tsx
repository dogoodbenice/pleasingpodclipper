import React, { useRef } from 'react';
import { Split, Trash2, Plus, Sparkles, Combine, Waves, ImagePlus, Shuffle } from 'lucide-react';
import { CaptionSegment, OverlayAsset, WordToken } from '../types';
import { defaultOverlay, isImageToken, segmentDisplayText } from '../captionLayout';
import { uploadImage } from '../api';
import { Tooltip } from './Tooltip';

interface TranscriptEditorProps {
  segments: CaptionSegment[];
  overlays: OverlayAsset[];
  currentTime: number;
  clipStart: number;
  clipEnd: number;
  onSegmentsChange: (segments: CaptionSegment[]) => void;
  onOverlaysChange: (overlays: OverlayAsset[]) => void;
  onSeek: (time: number) => void;
  onTriggerTranscribe: () => void;
  isTranscribing: boolean;
}

const PRESET_COLORS = [
  '#000000',
  '#FFFFFF',
  '#F59E0B',
  '#06B6D4',
  '#EF4444',
  '#10B981',
  '#8B5CF6',
  '#EC4899',
];

const newId = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID().slice(0, 8)
    : Math.random().toString(36).slice(2, 10);

export const TranscriptEditor: React.FC<TranscriptEditorProps> = ({
  segments,
  overlays,
  currentTime,
  clipStart,
  clipEnd,
  onSegmentsChange,
  onOverlaysChange,
  onSeek,
  onTriggerTranscribe,
  isTranscribing,
}) => {
  const [selectedWordId, setSelectedWordId] = React.useState<string | null>(null);
  const inlineImageInputRef = useRef<HTMLInputElement | null>(null);
  const overlayImageInputRef = useRef<HTMLInputElement | null>(null);
  const pendingInlineInsert = useRef<{ segIndex: number; afterWordId: string | null } | null>(null);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
  };

  const cloneSegments = () => segments.map((s) => ({ ...s, words: s.words.map((w) => ({ ...w })) }));

  const handleTextChange = (segIndex: number, newText: string) => {
    const updated = cloneSegments();
    const seg = updated[segIndex];
    const imageTokens = seg.words
      .map((w, i) => ({ w, i }))
      .filter(({ w }) => isImageToken(w));
    const oldWords = seg.words.filter((w) => !isImageToken(w));
    const trimmed = newText.trim();
    const newWordList = trimmed === '' ? [] : trimmed.split(/\s+/);

    const rebuilt: WordToken[] = newWordList.map((word, i) => {
      if (i < oldWords.length) {
        return { ...oldWords[i], word, type: 'word' };
      }
      const prev = i > 0 && i - 1 < oldWords.length ? oldWords[i - 1] : oldWords[oldWords.length - 1];
      const gapStart = prev ? prev.end : seg.start;
      const gapEnd = prev ? Math.min(seg.end, prev.end + 0.25) : Math.min(seg.end, seg.start + 0.25);
      return {
        id: newId(),
        word,
        start: gapStart,
        end: Math.max(gapStart + 0.05, gapEnd),
        type: 'word' as const,
        color: null,
        effect: 'none' as const,
      };
    });

    imageTokens.forEach(({ w, i }) => {
      const insertAt = Math.min(i, rebuilt.length);
      rebuilt.splice(insertAt, 0, w);
    });

    seg.words = rebuilt.filter((w) => isImageToken(w) || w.word.trim().length > 0);
    seg.text = segmentDisplayText(seg.words);
    onSegmentsChange(updated);
  };

  const handleSetWordColor = (segIndex: number, wordId: string, color: string | null) => {
    const updated = cloneSegments();
    const word = updated[segIndex].words.find((w) => w.id === wordId);
    if (word) {
      word.color = color;
      onSegmentsChange(updated);
    }
  };

  const handleToggleWave = (segIndex: number, wordId: string) => {
    const updated = cloneSegments();
    const word = updated[segIndex].words.find((w) => w.id === wordId);
    if (word && !isImageToken(word)) {
      word.effect = word.effect === 'wave' ? 'none' : 'wave';
      onSegmentsChange(updated);
    }
  };

  const handleCycleWaveVariant = (segIndex: number, wordId: string) => {
    const updated = cloneSegments();
    const word = updated[segIndex].words.find((w) => w.id === wordId);
    if (word && !isImageToken(word)) {
      word.effect = 'wave';
      word.waveVariant = (((word.waveVariant ?? 0) + 1) % 5);
      onSegmentsChange(updated);
    }
  };

  const handleDeleteWord = (segIndex: number, wordId: string) => {
    const updated = cloneSegments();
    const seg = updated[segIndex];
    seg.words = seg.words.filter((w) => w.id !== wordId);
    seg.text = segmentDisplayText(seg.words);
    onSegmentsChange(updated);
    setSelectedWordId(null);
  };

  const handleSplitSegment = (segIndex: number, wordIndex: number) => {
    if (wordIndex <= 0 || wordIndex >= segments[segIndex].words.length) return;
    const seg = segments[segIndex];
    const wordsBefore = seg.words.slice(0, wordIndex);
    const wordsAfter = seg.words.slice(wordIndex);
    if (wordsBefore.length === 0 || wordsAfter.length === 0) return;

    const times = (words: WordToken[]) => {
      const timed = words.filter((w) => typeof w.start === 'number');
      return {
        start: timed[0]?.start ?? seg.start,
        end: timed[timed.length - 1]?.end ?? seg.end,
      };
    };

    const beforeTimes = times(wordsBefore);
    const afterTimes = times(wordsAfter);

    const seg1: CaptionSegment = {
      id: `${seg.id}_1`,
      start: beforeTimes.start,
      end: beforeTimes.end,
      text: segmentDisplayText(wordsBefore),
      words: wordsBefore,
    };
    const seg2: CaptionSegment = {
      id: `${seg.id}_2`,
      start: afterTimes.start,
      end: afterTimes.end,
      text: segmentDisplayText(wordsAfter),
      words: wordsAfter,
    };

    const updated = [...segments];
    updated.splice(segIndex, 1, seg1, seg2);
    onSegmentsChange(updated);
    setSelectedWordId(null);
  };

  const handleMergeNext = (segIndex: number) => {
    if (segIndex >= segments.length - 1) return;
    const curr = segments[segIndex];
    const next = segments[segIndex + 1];
    const mergedWords = [...curr.words, ...next.words];
    const merged: CaptionSegment = {
      id: curr.id,
      start: curr.start,
      end: next.end,
      text: segmentDisplayText(mergedWords),
      words: mergedWords,
    };
    const updated = [...segments];
    updated.splice(segIndex, 2, merged);
    onSegmentsChange(updated);
  };

  const handleDeleteSegment = (segIndex: number) => {
    onSegmentsChange(segments.filter((_, i) => i !== segIndex));
  };

  const handleInsertBlock = (segIndex: number) => {
    const seg = segments[segIndex];
    const next = segments[segIndex + 1];
    const start = Math.min(clipEnd, Math.max(clipStart, seg.end));
    const rawEnd = next ? next.start : start + 1;
    const end = Math.min(clipEnd, Math.max(start + 0.1, rawEnd));
    const newSeg: CaptionSegment = {
      id: newId(),
      start,
      end,
      text: '',
      words: [],
    };
    const updated = [...segments];
    updated.splice(segIndex + 1, 0, newSeg);
    onSegmentsChange(updated);
  };

  const handleSegmentTiming = (segIndex: number, field: 'start' | 'end', value: number) => {
    const updated = cloneSegments();
    const seg = updated[segIndex];
    let nextVal = Number.isFinite(value) ? value : seg[field];
    nextVal = Math.min(clipEnd, Math.max(clipStart, nextVal));
    if (field === 'start') {
      seg.start = Math.min(nextVal, seg.end - 0.05);
    } else {
      seg.end = Math.max(nextVal, seg.start + 0.05);
    }
    onSegmentsChange(updated);
  };

  const handleWordClick = (_segIndex: number, word: WordToken) => {
    onSeek(word.start);
    setSelectedWordId(selectedWordId === word.id ? null : word.id);
  };

  const pickInlineImage = (segIndex: number, afterWordId: string | null) => {
    pendingInlineInsert.current = { segIndex, afterWordId };
    inlineImageInputRef.current?.click();
  };

  const handleInlineImageFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    const pending = pendingInlineInsert.current;
    pendingInlineInsert.current = null;
    if (!file || !pending) return;
    try {
      const res = await uploadImage(file);
      const updated = cloneSegments();
      const seg = updated[pending.segIndex];
      const afterIdx = pending.afterWordId
        ? seg.words.findIndex((w) => w.id === pending.afterWordId)
        : seg.words.length - 1;
      const ref = afterIdx >= 0 ? seg.words[afterIdx] : seg.words[seg.words.length - 1];
      const token: WordToken = {
        id: newId(),
        word: '',
        type: 'image',
        imageUrl: res.url,
        start: ref?.start ?? seg.start,
        end: ref?.end ?? seg.end,
      };
      const insertAt = afterIdx >= 0 ? afterIdx + 1 : seg.words.length;
      seg.words.splice(insertAt, 0, token);
      onSegmentsChange(updated);
    } catch (err) {
      alert(`Image upload failed: ${err}`);
    }
  };

  const handleOverlayFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const res = await uploadImage(file);
      const start = Math.max(clipStart, currentTime);
      const end = Math.min(clipEnd, start + 1);
      onOverlaysChange([
        ...overlays,
        defaultOverlay({ id: newId(), url: res.url, start, end: Math.max(end, start + 0.1) }),
      ]);
    } catch (err) {
      alert(`Image upload failed: ${err}`);
    }
  };

  const updateOverlay = (id: string, patch: Partial<OverlayAsset>) => {
    onOverlaysChange(overlays.map((o) => (o.id === id ? { ...o, ...patch } : o)));
  };

  if (segments.length === 0) {
    return (
      <div className="flex flex-col h-full bg-[#0d131f] overflow-y-auto">
        <div className="flex flex-col items-center justify-center p-8 text-center text-slate-400 flex-1">
          <Sparkles className="w-12 h-12 text-amber-400 mb-3 animate-pulse" />
          <h3 className="text-base font-bold text-slate-200 mb-1">No Transcript Yet</h3>
          <p className="text-xs text-slate-400 max-w-xs mb-4">
            Select your desired clip range on the timeline below, then hit Transcribe to generate word-level captions in seconds.
          </p>
          <button
            onClick={onTriggerTranscribe}
            disabled={isTranscribing}
            className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs shadow-lg shadow-amber-500/20 disabled:opacity-50"
          >
            {isTranscribing ? 'Transcribing...' : 'Transcribe Selected Range'}
          </button>
        </div>
        <OverlayList
          overlays={overlays}
          onPickFile={() => overlayImageInputRef.current?.click()}
          onChange={updateOverlay}
          onDelete={(id) => onOverlaysChange(overlays.filter((o) => o.id !== id))}
          onSeek={onSeek}
        />
        <input ref={overlayImageInputRef} type="file" accept="image/*" className="hidden" onChange={handleOverlayFile} />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#0d131f] overflow-y-auto p-4 space-y-4">
      <input ref={inlineImageInputRef} type="file" accept="image/*" className="hidden" onChange={handleInlineImageFile} />
      <input ref={overlayImageInputRef} type="file" accept="image/*" className="hidden" onChange={handleOverlayFile} />

      <div className="flex items-center justify-between text-xs text-slate-400 pb-2 border-b border-slate-800">
        <span>Click a word to seek and format</span>
        <span className="font-mono text-cyan-400">{segments.length} segments</span>
      </div>

      {segments.map((seg, segIndex) => {
        const isCurrent = currentTime >= seg.start && currentTime <= seg.end;

        return (
          <div
            key={seg.id}
            className={`p-3 rounded-xl border transition-all ${
              isCurrent
                ? 'bg-slate-800/80 border-cyan-500/60 shadow-lg shadow-cyan-500/10'
                : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between mb-2 gap-2">
              <Tooltip title="Jump to Segment" description="Seek playhead to the start of this block" delay={1000}>
                <button
                  onClick={() => onSeek(seg.start)}
                  className="flex items-center space-x-1.5 font-mono text-xs text-cyan-400 hover:text-cyan-300 font-semibold shrink-0"
                >
                  <span>{formatTime(seg.start)}</span>
                  <span className="text-slate-600">→</span>
                  <span>{formatTime(seg.end)}</span>
                </button>
              </Tooltip>

              <div className="flex items-center space-x-1">
                {segIndex < segments.length - 1 && (
                  <Tooltip title="Merge with Next" description="Combine this caption block with the one after it" delay={1000}>
                    <button
                      onClick={() => handleMergeNext(segIndex)}
                      className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors"
                    >
                      <Combine size={14} />
                    </button>
                  </Tooltip>
                )}
                <Tooltip title="Insert Block" description="Add a new blank caption block right after this one" delay={1000}>
                  <button
                    onClick={() => handleInsertBlock(segIndex)}
                    className="p-1 text-slate-400 hover:text-cyan-300 rounded hover:bg-slate-800 transition-colors"
                  >
                    <Plus size={14} />
                  </button>
                </Tooltip>
                <Tooltip title="Attach Image" description="Upload and insert an image at the end of this block" delay={1000}>
                  <button
                    onClick={() => pickInlineImage(segIndex, seg.words[seg.words.length - 1]?.id ?? null)}
                    className="p-1 text-slate-400 hover:text-amber-300 rounded hover:bg-slate-800 transition-colors"
                  >
                    <ImagePlus size={14} />
                  </button>
                </Tooltip>
                <Tooltip title="Delete Segment" description="Permanently delete this entire caption block" delay={1000}>
                  <button
                    onClick={() => handleDeleteSegment(segIndex)}
                    className="p-1 text-slate-400 hover:text-rose-400 rounded hover:bg-slate-800 transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </Tooltip>
              </div>
            </div>

            <div className="flex items-center gap-2 mb-2">
              <label className="text-[10px] uppercase tracking-wide text-slate-500">Start</label>
              <input
                type="number"
                step={0.01}
                value={Number(seg.start.toFixed(2))}
                onChange={(e) => handleSegmentTiming(segIndex, 'start', parseFloat(e.target.value))}
                className="w-20 bg-slate-950 border border-slate-800 rounded px-1.5 py-0.5 font-mono text-[11px] text-slate-200"
              />
              <label className="text-[10px] uppercase tracking-wide text-slate-500">End</label>
              <input
                type="number"
                step={0.01}
                value={Number(seg.end.toFixed(2))}
                onChange={(e) => handleSegmentTiming(segIndex, 'end', parseFloat(e.target.value))}
                className="w-20 bg-slate-950 border border-slate-800 rounded px-1.5 py-0.5 font-mono text-[11px] text-slate-200"
              />
            </div>

            <textarea
              value={seg.text}
              onChange={(e) => handleTextChange(segIndex, e.target.value)}
              className="w-full bg-slate-950/70 border border-slate-800 rounded-lg p-2 text-sm text-slate-200 focus:outline-none focus:border-cyan-500/60 resize-none font-medium mb-3"
              rows={2}
            />

            <div className="flex flex-wrap gap-1.5 pt-1 border-t border-slate-800/80">
              {seg.words.map((w, wIdx) => {
                const isWordPlaying = currentTime >= w.start && currentTime <= w.end;
                const isWordSelected = selectedWordId === w.id;
                const image = isImageToken(w);

                return (
                  <div key={w.id} className="relative group inline-block">
                    <button
                      onClick={() => handleWordClick(segIndex, w)}
                      className={`px-2 py-0.5 rounded text-xs transition-colors flex items-center space-x-1 font-extrabold ${
                        isWordPlaying
                          ? 'bg-yellow-400 text-black shadow-sm'
                          : isWordSelected
                          ? 'bg-cyan-500 text-black ring-2 ring-cyan-400'
                          : w.effect === 'wave'
                          ? 'bg-slate-800 text-fuchsia-300 border border-fuchsia-500/40'
                          : 'bg-slate-950 text-slate-300 hover:bg-slate-800'
                      }`}
                      style={{
                        color: !isWordPlaying && w.color ? w.color : undefined,
                      }}
                    >
                      {image ? (
                        <span className="flex items-center gap-1">
                          <ImagePlus size={12} />
                          <span>img</span>
                        </span>
                      ) : (
                        <span>{w.word}</span>
                      )}
                    </button>

                    {isWordSelected && (
                      <div className="absolute top-full left-0 mt-1 z-30 bg-slate-900 border border-slate-700 rounded-lg p-2 shadow-2xl flex items-center space-x-2">
                        {!image && (
                          <>
                            <Tooltip title="Wavy / Arc Text" description="Curve text along a waving animated path" delay={1000}>
                              <button
                                onClick={() => handleToggleWave(segIndex, w.id)}
                                className={`p-1.5 rounded transition-colors ${w.effect === 'wave' ? 'bg-fuchsia-500 text-black font-bold' : 'hover:bg-slate-800 text-slate-300'}`}
                              >
                                <Waves size={14} />
                              </button>
                            </Tooltip>

                            {w.effect === 'wave' && (
                              <Tooltip
                                title={`Wave Shape: Variant ${(w.waveVariant ?? 0) + 1}/5`}
                                description="Cycle through arc dome, smile bowl, S-curve, and ripple oscillations"
                                delay={1000}
                              >
                                <button
                                  onClick={() => handleCycleWaveVariant(segIndex, w.id)}
                                  className="p-1.5 rounded bg-fuchsia-950/70 border border-fuchsia-500/50 hover:bg-fuchsia-900/60 text-fuchsia-200 transition-colors"
                                >
                                  <Shuffle size={14} />
                                </button>
                              </Tooltip>
                            )}

                            <div className="flex items-center space-x-1 border-l border-slate-800 pl-2">
                              <Tooltip title="Reset Color" description="Restore standard text color" delay={1000}>
                                <button
                                  onClick={() => handleSetWordColor(segIndex, w.id, null)}
                                  className="w-4 h-4 rounded-full border border-slate-600 bg-transparent text-[8px] text-slate-400 flex items-center justify-center hover:border-slate-400"
                                >
                                  ×
                                </button>
                              </Tooltip>
                              {PRESET_COLORS.map((c) => (
                                <Tooltip key={c} title="Word Accent Color" description="Apply custom color to this word" delay={1000}>
                                  <button
                                    onClick={() => handleSetWordColor(segIndex, w.id, c)}
                                    className="w-4 h-4 rounded-full border border-slate-700 hover:scale-125 transition-transform"
                                    style={{ backgroundColor: c }}
                                  />
                                </Tooltip>
                              ))}
                            </div>
                          </>
                        )}

                        <Tooltip title="Insert Image Here" description="Insert an inline picture after this word" delay={1000}>
                          <button
                            onClick={() => pickInlineImage(segIndex, w.id)}
                            className="p-1.5 hover:bg-slate-800 text-slate-300 rounded border-l border-slate-800 pl-2 transition-colors"
                          >
                            <ImagePlus size={14} />
                          </button>
                        </Tooltip>

                        {wIdx > 0 && (
                          <Tooltip title="Split Segment Here" description="Divide into two caption blocks at this word" delay={1000}>
                            <button
                              onClick={() => handleSplitSegment(segIndex, wIdx)}
                              className="p-1.5 hover:bg-slate-800 text-slate-300 rounded transition-colors"
                            >
                              <Split size={14} />
                            </button>
                          </Tooltip>
                        )}

                        <Tooltip title="Delete Word" description="Permanently remove this word token from subtitles" delay={1000}>
                          <button
                            onClick={() => handleDeleteWord(segIndex, w.id)}
                            className="p-1.5 hover:bg-rose-500/20 text-rose-400 rounded transition-colors"
                          >
                            <Trash2 size={14} />
                          </button>
                        </Tooltip>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      <OverlayList
        overlays={overlays}
        onPickFile={() => overlayImageInputRef.current?.click()}
        onChange={updateOverlay}
        onDelete={(id) => onOverlaysChange(overlays.filter((o) => o.id !== id))}
        onSeek={onSeek}
      />
    </div>
  );
};

const OverlayList: React.FC<{
  overlays: OverlayAsset[];
  onPickFile: () => void;
  onChange: (id: string, patch: Partial<OverlayAsset>) => void;
  onDelete: (id: string) => void;
  onSeek: (time: number) => void;
}> = ({ overlays, onPickFile, onChange, onDelete, onSeek }) => {
  return (
    <div className="p-4 border-t border-slate-800 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-400">Timed overlays</span>
        <Tooltip title="Add Floating Image" description="Upload a screenshot or image layer behind captions" delay={1000}>
          <button
            onClick={onPickFile}
            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] text-slate-200 transition-colors"
          >
            <ImagePlus size={12} />
            Add overlay
          </button>
        </Tooltip>
      </div>
      {overlays.length === 0 && (
        <p className="text-[11px] text-slate-500">Screenshots shown on the canvas for a chosen time range, behind captions.</p>
      )}
      {overlays.map((o) => (
        <div key={o.id} className="bg-slate-900/70 border border-slate-800 rounded-lg p-2 space-y-2">
          <div className="flex items-center gap-2">
            <img src={o.url} alt="" className="w-10 h-10 object-cover rounded" />
            <Tooltip title="Seek to Overlay" description="Jump playhead to when this image appears" delay={1000}>
              <button onClick={() => onSeek(o.start)} className="text-[11px] font-mono text-cyan-400 hover:underline">
                {o.start.toFixed(2)}s → {o.end.toFixed(2)}s
              </button>
            </Tooltip>
            <Tooltip title="Delete Overlay" description="Remove this image overlay" delay={1000}>
              <button onClick={() => onDelete(o.id)} className="ml-auto p-1 text-rose-400 hover:bg-slate-800 rounded transition-colors">
                <Trash2 size={12} />
              </button>
            </Tooltip>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <label className="text-[10px] text-slate-500">
              Start
              <input
                type="number"
                step={0.01}
                value={Number(o.start.toFixed(2))}
                onChange={(e) => onChange(o.id, { start: parseFloat(e.target.value) || 0 })}
                className="w-full bg-slate-950 border border-slate-800 rounded px-1.5 py-0.5 font-mono text-[11px] text-slate-200"
              />
            </label>
            <label className="text-[10px] text-slate-500">
              End
              <input
                type="number"
                step={0.01}
                value={Number(o.end.toFixed(2))}
                onChange={(e) => onChange(o.id, { end: parseFloat(e.target.value) || 0 })}
                className="w-full bg-slate-950 border border-slate-800 rounded px-1.5 py-0.5 font-mono text-[11px] text-slate-200"
              />
            </label>
          </div>
          <label className="text-[10px] text-slate-500 block">
            Scale {Math.round(o.scale * 100)}%
            <input
              type="range"
              min={0.1}
              max={0.9}
              step={0.01}
              value={o.scale}
              onChange={(e) => onChange(o.id, { scale: parseFloat(e.target.value) })}
              className="w-full"
            />
          </label>
        </div>
      ))}
    </div>
  );
};
