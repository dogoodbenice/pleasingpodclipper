import React, { useRef, useState } from 'react';
import { Play, Pause, RotateCcw, FastForward, Rewind, Scissors } from 'lucide-react';
import { ClipRange } from '../types';

interface WaveformTimelineProps {
  duration: number;
  currentTime: number;
  clipRange: ClipRange;
  waveformPeaks: number[];
  isPlaying: boolean;
  onSeek: (time: number) => void;
  onTogglePlay: () => void;
  onClipRangeChange: (range: ClipRange) => void;
  onTranscribeRange: () => void;
  isTranscribing: boolean;
}

export const WaveformTimeline: React.FC<WaveformTimelineProps> = ({
  duration,
  currentTime,
  clipRange,
  waveformPeaks,
  isPlaying,
  onSeek,
  onTogglePlay,
  onClipRangeChange,
  onTranscribeRange,
  isTranscribing,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [draggingHandle, setDraggingHandle] = useState<'start' | 'end' | 'playhead' | null>(null);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 10);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms}`;
  };

  const getPositionFromEvent = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current || duration <= 0) return 0;
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    return (x / rect.width) * duration;
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>, handle: 'start' | 'end' | 'playhead') => {
    e.stopPropagation();
    setDraggingHandle(handle);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!draggingHandle || duration <= 0) return;
    const newTime = getPositionFromEvent(e);

    if (draggingHandle === 'start') {
      const clamped = Math.min(newTime, clipRange.end - 1);
      onClipRangeChange({ ...clipRange, start: Math.max(0, clamped) });
    } else if (draggingHandle === 'end') {
      const clamped = Math.max(newTime, clipRange.start + 1);
      onClipRangeChange({ ...clipRange, end: Math.min(duration, clamped) });
    } else if (draggingHandle === 'playhead') {
      onSeek(newTime);
    }
  };

  const handleMouseUp = () => {
    setDraggingHandle(null);
  };

  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (draggingHandle) return;
    const time = getPositionFromEvent(e);
    onSeek(time);
  };

  // Percentages for UI positioning
  const startPercent = duration > 0 ? (clipRange.start / duration) * 100 : 0;
  const endPercent = duration > 0 ? (clipRange.end / duration) * 100 : 100;
  const currentPercent = duration > 0 ? (currentTime / duration) * 100 : 0;
  const clipLength = Math.max(0, clipRange.end - clipRange.start);

  return (
    <div
      className="bg-[#131b2a] border-t border-slate-800 p-4 select-none"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* Controls & Metrics Header */}
      <div className="flex items-center justify-between mb-3 text-xs text-slate-300">
        <div className="flex items-center space-x-3">
          <button
            onClick={() => onSeek(Math.max(0, currentTime - 5))}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
            title="Rewind 5s"
          >
            <Rewind size={16} />
          </button>
          <button
            onClick={onTogglePlay}
            className="p-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-semibold shadow-lg shadow-cyan-500/20"
            title={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? <Pause size={18} /> : <Play size={18} className="translate-x-0.5" />}
          </button>
          <button
            onClick={() => onSeek(Math.min(duration, currentTime + 5))}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
            title="Forward 5s"
          >
            <FastForward size={16} />
          </button>
          <button
            onClick={() => onSeek(clipRange.start)}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
            title="Jump to Clip Start"
          >
            <RotateCcw size={16} />
          </button>

          <div className="font-mono text-sm font-semibold text-white ml-2">
            {formatTime(currentTime)}{' '}
            <span className="text-slate-500 text-xs">/ {formatTime(duration)}</span>
          </div>
        </div>

        {/* Selected Clip Info & Transcribe Range Button */}
        <div className="flex items-center space-x-3">
          <div className="bg-slate-800/80 px-3 py-1 rounded-md text-slate-300 font-mono text-xs border border-slate-700">
            Selected Range:{' '}
            <span className="text-cyan-400 font-bold">{clipLength.toFixed(1)}s</span>{' '}
            <span className="text-slate-500">
              ({formatTime(clipRange.start)} - {formatTime(clipRange.end)})
            </span>
          </div>

          <button
            onClick={onTranscribeRange}
            disabled={isTranscribing}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-black font-bold text-xs shadow-md shadow-amber-500/20 disabled:opacity-50"
          >
            <Scissors size={14} />
            <span>{isTranscribing ? 'Transcribing (~2s)...' : 'Transcribe This Clip'}</span>
          </button>
        </div>
      </div>

      {/* Main Interactive Waveform Timeline Track */}
      <div
        ref={containerRef}
        onClick={handleTimelineClick}
        className="relative h-20 bg-slate-950 rounded-xl overflow-hidden cursor-pointer border border-slate-800"
      >
        {/* Render Peaks */}
        <div className="absolute inset-0 flex items-center justify-between px-1 pointer-events-none opacity-40">
          {waveformPeaks.length > 0
            ? waveformPeaks.map((peak, idx) => (
                <div
                  key={idx}
                  className="w-[1.5px] bg-slate-400 rounded-full"
                  style={{ height: `${Math.max(4, peak * 90)}%` }}
                />
              ))
            : Array.from({ length: 120 }).map((_, idx) => (
                <div
                  key={idx}
                  className="w-[1.5px] bg-slate-700 rounded-full"
                  style={{ height: `${Math.sin(idx * 0.2) * 30 + 35}%` }}
                />
              ))}
        </div>

        {/* Shaded unselected regions (Dimmed before start and after end) */}
        <div
          className="absolute top-0 bottom-0 left-0 bg-black/60 pointer-events-none"
          style={{ width: `${startPercent}%` }}
        />
        <div
          className="absolute top-0 bottom-0 right-0 bg-black/60 pointer-events-none"
          style={{ left: `${endPercent}%` }}
        />

        {/* Selected Highlight Zone */}
        <div
          className="absolute top-0 bottom-0 border-y-2 border-cyan-500/80 bg-cyan-500/10 pointer-events-none"
          style={{
            left: `${startPercent}%`,
            width: `${Math.max(0, endPercent - startPercent)}%`,
          }}
        />

        {/* Left Clip Range Handle */}
        <div
          onMouseDown={(e) => handleMouseDown(e, 'start')}
          className="absolute top-0 bottom-0 w-3 bg-cyan-400 hover:bg-cyan-300 cursor-ew-resize flex items-center justify-center shadow-lg group z-10"
          style={{ left: `calc(${startPercent}% - 6px)` }}
          title="Drag to adjust clip start"
        >
          <div className="w-0.5 h-6 bg-slate-900 rounded-full group-hover:scale-110" />
        </div>

        {/* Right Clip Range Handle */}
        <div
          onMouseDown={(e) => handleMouseDown(e, 'end')}
          className="absolute top-0 bottom-0 w-3 bg-cyan-400 hover:bg-cyan-300 cursor-ew-resize flex items-center justify-center shadow-lg group z-10"
          style={{ left: `calc(${endPercent}% - 6px)` }}
          title="Drag to adjust clip end"
        >
          <div className="w-0.5 h-6 bg-slate-900 rounded-full group-hover:scale-110" />
        </div>

        {/* Playhead Scrubber Line */}
        <div
          onMouseDown={(e) => handleMouseDown(e, 'playhead')}
          className="absolute top-0 bottom-0 w-0.5 bg-yellow-400 z-20 pointer-events-auto"
          style={{ left: `${currentPercent}%` }}
        >
          <div className="w-3 h-3 bg-yellow-400 rounded-full -ml-[5px] -mt-0.5 shadow-md shadow-yellow-500/50" />
        </div>
      </div>
    </div>
  );
};
