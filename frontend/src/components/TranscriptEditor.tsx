import React, { useState } from 'react';
import { Bold, Split, Trash2, Plus, Sparkles } from 'lucide-react';
import { CaptionSegment } from '../types';

interface TranscriptEditorProps {
  segments: CaptionSegment[];
  currentTime: number;
  onSegmentsChange: (segments: CaptionSegment[]) => void;
  onSeek: (time: number) => void;
  onTriggerTranscribe: () => void;
  isTranscribing: boolean;
}

const PRESET_COLORS = [
  '#000000',
  '#FFFFFF',
  '#F59E0B', // Amber
  '#06B6D4', // Cyan
  '#EF4444', // Red
  '#10B981', // Emerald
  '#8B5CF6', // Purple
  '#EC4899', // Pink
];

export const TranscriptEditor: React.FC<TranscriptEditorProps> = ({
  segments,
  currentTime,
  onSegmentsChange,
  onSeek,
  onTriggerTranscribe,
  isTranscribing,
}) => {
  const [selectedWordId, setSelectedWordId] = useState<string | null>(null);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
  };

  const handleTextChange = (segIndex: number, newText: string) => {
    const updated = [...segments];
    const seg = updated[segIndex];
    seg.text = newText;
    
    // Simple word sync if word count matches
    const newWordList = newText.trim().split(/\s+/);
    if (newWordList.length === seg.words.length) {
      seg.words.forEach((w, i) => {
        w.word = newWordList[i];
      });
    }
    onSegmentsChange(updated);
  };

  const handleToggleWordBold = (segIndex: number, wordId: string) => {
    const updated = [...segments];
    const word = updated[segIndex].words.find((w) => w.id === wordId);
    if (word) {
      word.bold = !word.bold;
      onSegmentsChange(updated);
    }
  };

  const handleSetWordColor = (segIndex: number, wordId: string, color: string | null) => {
    const updated = [...segments];
    const word = updated[segIndex].words.find((w) => w.id === wordId);
    if (word) {
      word.color = color;
      onSegmentsChange(updated);
    }
  };

  const handleSplitSegment = (segIndex: number, wordIndex: number) => {
    if (wordIndex <= 0 || wordIndex >= segments[segIndex].words.length) return;
    const seg = segments[segIndex];
    const wordsBefore = seg.words.slice(0, wordIndex);
    const wordsAfter = seg.words.slice(wordIndex);

    const seg1: CaptionSegment = {
      id: `${seg.id}_1`,
      start: wordsBefore[0].start,
      end: wordsBefore[wordsBefore.length - 1].end,
      text: wordsBefore.map((w) => w.word).join(' '),
      words: wordsBefore,
    };

    const seg2: CaptionSegment = {
      id: `${seg.id}_2`,
      start: wordsAfter[0].start,
      end: wordsAfter[wordsAfter.length - 1].end,
      text: wordsAfter.map((w) => w.word).join(' '),
      words: wordsAfter,
    };

    const updated = [...segments];
    updated.splice(segIndex, 1, seg1, seg2);
    onSegmentsChange(updated);
  };

  const handleMergeNext = (segIndex: number) => {
    if (segIndex >= segments.length - 1) return;
    const curr = segments[segIndex];
    const next = segments[segIndex + 1];

    const merged: CaptionSegment = {
      id: curr.id,
      start: curr.start,
      end: next.end,
      text: `${curr.text} ${next.text}`,
      words: [...curr.words, ...next.words],
    };

    const updated = [...segments];
    updated.splice(segIndex, 2, merged);
    onSegmentsChange(updated);
  };

  const handleDeleteSegment = (segIndex: number) => {
    const updated = segments.filter((_, i) => i !== segIndex);
    onSegmentsChange(updated);
  };

  if (segments.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center text-slate-400 h-full">
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
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#0d131f] overflow-y-auto p-4 space-y-4">
      {/* Top action helper */}
      <div className="flex items-center justify-between text-xs text-slate-400 pb-2 border-b border-slate-800">
        <span>Click word to format: Bold / Color</span>
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
            {/* Header: Timestamps & Segment Controls */}
            <div className="flex items-center justify-between mb-2">
              <button
                onClick={() => onSeek(seg.start)}
                className="flex items-center space-x-1.5 font-mono text-xs text-cyan-400 hover:text-cyan-300 font-semibold"
                title="Jump to this segment"
              >
                <span>{formatTime(seg.start)}</span>
                <span className="text-slate-600">→</span>
                <span>{formatTime(seg.end)}</span>
              </button>

              <div className="flex items-center space-x-1">
                {segIndex < segments.length - 1 && (
                  <button
                    onClick={() => handleMergeNext(segIndex)}
                    className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800"
                    title="Merge with next segment"
                  >
                    <Plus size={14} />
                  </button>
                )}
                <button
                  onClick={() => handleDeleteSegment(segIndex)}
                  className="p-1 text-slate-400 hover:text-rose-400 rounded hover:bg-slate-800"
                  title="Delete segment"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>

            {/* Editable Raw Textarea */}
            <textarea
              value={seg.text}
              onChange={(e) => handleTextChange(segIndex, e.target.value)}
              className="w-full bg-slate-950/70 border border-slate-800 rounded-lg p-2 text-sm text-slate-200 focus:outline-none focus:border-cyan-500/60 resize-none font-medium mb-3"
              rows={2}
            />

            {/* Interactive Word Tokens */}
            <div className="flex flex-wrap gap-1.5 pt-1 border-t border-slate-800/80">
              {seg.words.map((w, wIdx) => {
                const isWordPlaying = currentTime >= w.start && currentTime <= w.end;
                const isWordSelected = selectedWordId === w.id;

                return (
                  <div key={w.id} className="relative group inline-block">
                    <button
                      onClick={() => setSelectedWordId(isWordSelected ? null : w.id)}
                      className={`px-2 py-0.5 rounded text-xs transition-colors flex items-center space-x-1 ${
                        isWordPlaying
                          ? 'bg-yellow-400 text-black font-extrabold shadow-sm'
                          : isWordSelected
                          ? 'bg-cyan-500 text-black font-bold ring-2 ring-cyan-400'
                          : w.bold
                          ? 'bg-slate-800 text-white font-extrabold border border-slate-700'
                          : 'bg-slate-950 text-slate-300 hover:bg-slate-800'
                      }`}
                      style={{
                        color: !isWordPlaying && w.color ? w.color : undefined,
                      }}
                    >
                      <span>{w.word}</span>
                    </button>

                    {/* Word Formatting Popover */}
                    {isWordSelected && (
                      <div className="absolute top-full left-0 mt-1 z-30 bg-slate-900 border border-slate-700 rounded-lg p-2 shadow-2xl flex items-center space-x-2">
                        <button
                          onClick={() => handleToggleWordBold(segIndex, w.id)}
                          className={`p-1.5 rounded ${w.bold ? 'bg-cyan-500 text-black' : 'hover:bg-slate-800 text-slate-300'}`}
                          title="Toggle Bold"
                        >
                          <Bold size={14} />
                        </button>

                        {/* Color swatches */}
                        <div className="flex items-center space-x-1 border-l border-slate-800 pl-2">
                          <button
                            onClick={() => handleSetWordColor(segIndex, w.id, null)}
                            className="w-4 h-4 rounded-full border border-slate-600 bg-transparent text-[8px] text-slate-400 flex items-center justify-center"
                            title="Reset color"
                          >
                            ×
                          </button>
                          {PRESET_COLORS.map((c) => (
                            <button
                              key={c}
                              onClick={() => handleSetWordColor(segIndex, w.id, c)}
                              className="w-4 h-4 rounded-full border border-slate-700 hover:scale-110 transition-transform"
                              style={{ backgroundColor: c }}
                            />
                          ))}
                        </div>

                        {/* Split block at this word */}
                        {wIdx > 0 && (
                          <button
                            onClick={() => {
                              handleSplitSegment(segIndex, wIdx);
                              setSelectedWordId(null);
                            }}
                            className="p-1.5 hover:bg-slate-800 text-slate-300 rounded border-l border-slate-800 pl-2"
                            title="Split segment here"
                          >
                            <Split size={14} />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
};
