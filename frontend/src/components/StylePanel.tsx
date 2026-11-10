import React from 'react';
import { Upload, Smartphone, Square, Monitor } from 'lucide-react';
import { VisualSettings } from '../types';
import { uploadImage } from '../api';

interface StylePanelProps {
  visuals: VisualSettings;
  onVisualsChange: (visuals: VisualSettings) => void;
  onLogoUploaded: (img: HTMLImageElement | null) => void;
}

export const StylePanel: React.FC<StylePanelProps> = ({
  visuals,
  onVisualsChange,
  onLogoUploaded,
}) => {
  const updateVisual = <K extends keyof VisualSettings>(key: K, value: VisualSettings[K]) => {
    onVisualsChange({ ...visuals, [key]: value });
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const res = await uploadImage(file);
      updateVisual('logoUrl', res.url);
      const img = new Image();
      img.src = res.url;
      img.onload = () => onLogoUploaded(img);
    } catch (err) {
      console.error('Logo upload error:', err);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#0d131f] overflow-y-auto p-4 space-y-6 text-xs text-slate-300">
      {/* 1. Aspect Ratio Sizer */}
      <div>
        <label className="block text-slate-400 font-semibold mb-2">Aspect Ratio</label>
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => updateVisual('aspectRatio', '1:1')}
            className={`flex flex-col items-center justify-center p-2.5 rounded-xl border transition-all ${
              visuals.aspectRatio === '1:1'
                ? 'bg-cyan-500/10 border-cyan-500 text-cyan-400 font-bold'
                : 'bg-slate-900 border-slate-800 hover:border-slate-700'
            }`}
          >
            <Square size={18} className="mb-1" />
            <span>1:1 Square</span>
            <span className="text-[10px] text-slate-500">IG / Feed</span>
          </button>

          <button
            onClick={() => updateVisual('aspectRatio', '9:16')}
            className={`flex flex-col items-center justify-center p-2.5 rounded-xl border transition-all ${
              visuals.aspectRatio === '9:16'
                ? 'bg-cyan-500/10 border-cyan-500 text-cyan-400 font-bold'
                : 'bg-slate-900 border-slate-800 hover:border-slate-700'
            }`}
          >
            <Smartphone size={18} className="mb-1" />
            <span>9:16 Story</span>
            <span className="text-[10px] text-slate-500">TikTok / Reels</span>
          </button>

          <button
            onClick={() => updateVisual('aspectRatio', '16:9')}
            className={`flex flex-col items-center justify-center p-2.5 rounded-xl border transition-all ${
              visuals.aspectRatio === '16:9'
                ? 'bg-cyan-500/10 border-cyan-500 text-cyan-400 font-bold'
                : 'bg-slate-900 border-slate-800 hover:border-slate-700'
            }`}
          >
            <Monitor size={18} className="mb-1" />
            <span>16:9 Wide</span>
            <span className="text-[10px] text-slate-500">YouTube</span>
          </button>
        </div>
      </div>

      {/* 2. Header & Branding */}
      <div className="space-y-3 pt-3 border-t border-slate-800">
        <label className="block text-slate-400 font-semibold">Header & Branding</label>

        <div>
          <span className="text-[11px] text-slate-400 mb-1 block">Podcast Title</span>
          <div className="flex items-center space-x-2">
            <input
              type="text"
              value={visuals.podcastTitle}
              onChange={(e) => updateVisual('podcastTitle', e.target.value)}
              className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-cyan-500"
            />
            <input
              type="color"
              value={visuals.podcastTitleColor}
              onChange={(e) => updateVisual('podcastTitleColor', e.target.value)}
              className="w-7 h-7 rounded border-none cursor-pointer bg-transparent"
              title="Title color"
            />
          </div>
        </div>

        <div>
          <span className="text-[11px] text-slate-400 mb-1 block">Episode Subtitle</span>
          <div className="flex items-center space-x-2">
            <input
              type="text"
              value={visuals.episodeTitle}
              onChange={(e) => updateVisual('episodeTitle', e.target.value)}
              className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-cyan-500"
            />
            <input
              type="color"
              value={visuals.episodeTitleColor}
              onChange={(e) => updateVisual('episodeTitleColor', e.target.value)}
              className="w-7 h-7 rounded border-none cursor-pointer bg-transparent"
              title="Subtitle color"
            />
          </div>
        </div>

        {/* Cover Art Upload */}
        <div>
          <span className="text-[11px] text-slate-400 mb-1 block">Podcast Cover / Logo</span>
          <label className="flex items-center justify-center p-3 border-2 border-dashed border-slate-700 hover:border-cyan-500 rounded-xl cursor-pointer bg-slate-900/50 hover:bg-slate-900 transition-colors">
            <input
              type="file"
              accept="image/*"
              onChange={handleLogoUpload}
              className="hidden"
            />
            <div className="flex items-center space-x-2 text-slate-400">
              <Upload size={16} />
              <span>{visuals.logoUrl ? 'Change Cover Art' : 'Upload Cover Art (Square)'}</span>
            </div>
          </label>
        </div>
      </div>

      {/* 3. Captions Animation & Colors */}
      <div className="space-y-3 pt-3 border-t border-slate-800">
        <label className="block text-slate-400 font-semibold">Captions Style</label>

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => updateVisual('captionAnimation', 'karaoke')}
            className={`p-2 rounded-lg border text-center ${
              visuals.captionAnimation === 'karaoke'
                ? 'bg-cyan-500/10 border-cyan-500 text-cyan-400 font-bold'
                : 'bg-slate-900 border-slate-800'
            }`}
          >
            Karaoke Highlight
          </button>
          <button
            onClick={() => updateVisual('captionAnimation', 'hormozi')}
            className={`p-2 rounded-lg border text-center ${
              visuals.captionAnimation === 'hormozi'
                ? 'bg-cyan-500/10 border-cyan-500 text-cyan-400 font-bold'
                : 'bg-slate-900 border-slate-800'
            }`}
          >
            Word-by-Word
          </button>
        </div>

        <div className="pt-2">
          <span className="text-[11px] text-slate-400 mb-1.5 block">Active Highlight Effect</span>
          <div className="grid grid-cols-4 gap-1.5">
            {[
              { id: 'color', label: 'Color' },
              { id: 'pill', label: 'Pill' },
              { id: 'pop', label: 'Pop' },
              { id: 'underline', label: 'Line' },
            ].map((style) => (
              <button
                key={style.id}
                onClick={() => updateVisual('highlightStyle', style.id as any)}
                className={`py-1.5 px-2 rounded-lg border text-center text-[11px] transition-all ${
                  (visuals.highlightStyle || 'color') === style.id
                    ? 'bg-cyan-500/10 border-cyan-500 text-cyan-400 font-bold'
                    : 'bg-slate-900 border-slate-800 hover:border-slate-700 text-slate-300'
                }`}
              >
                {style.label}
              </button>
            ))}
          </div>
        </div>

        {visuals.highlightStyle === 'pill' && (
          <div className="pt-1">
            <span className="text-[11px] text-slate-400 mb-1 block">Pill Background Color</span>
            <div className="flex items-center space-x-2">
              <input
                type="color"
                value={visuals.highlightBgColor || '#06B6D4'}
                onChange={(e) => updateVisual('highlightBgColor', e.target.value)}
                className="w-7 h-7 rounded border-none cursor-pointer bg-transparent"
              />
              <span className="font-mono text-[11px]">{visuals.highlightBgColor || '#06B6D4'}</span>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 pt-1">
          <div>
            <span className="text-[11px] text-slate-400 mb-1 block">Active Word Highlight</span>
            <div className="flex items-center space-x-2">
              <input
                type="color"
                value={visuals.activeWordColor}
                onChange={(e) => updateVisual('activeWordColor', e.target.value)}
                className="w-7 h-7 rounded border-none cursor-pointer bg-transparent"
              />
              <span className="font-mono text-[11px]">{visuals.activeWordColor}</span>
            </div>
          </div>

          <div>
            <span className="text-[11px] text-slate-400 mb-1 block">Inactive Words Color</span>
            <div className="flex items-center space-x-2">
              <input
                type="color"
                value={visuals.inactiveWordColor}
                onChange={(e) => updateVisual('inactiveWordColor', e.target.value)}
                className="w-7 h-7 rounded border-none cursor-pointer bg-transparent"
              />
              <span className="font-mono text-[11px]">{visuals.inactiveWordColor}</span>
            </div>
          </div>
        </div>

        <div>
          <span className="text-[11px] text-slate-400 mb-1 block">Font Family</span>
          <select
            value={visuals.fontFamily}
            onChange={(e) => updateVisual('fontFamily', e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-slate-200 focus:outline-none focus:border-cyan-500"
          >
            <option value="Inter">Inter (Clean Modern)</option>
            <option value="Montserrat">Montserrat (Punchy Bold)</option>
            <option value="Poppins">Poppins (Geometric Rounded)</option>
            <option value="sans-serif">System Sans-Serif</option>
          </select>
        </div>
      </div>

      {/* 4. Progress Bar & Visualizer Style */}
      <div className="space-y-3 pt-3 border-t border-slate-800">
        <label className="block text-slate-400 font-semibold">Progress Indicator</label>

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => updateVisual('visualizerStyle', 'minimal_dot')}
            className={`p-2 rounded-lg border text-center ${
              visuals.visualizerStyle === 'minimal_dot'
                ? 'bg-cyan-500/10 border-cyan-500 text-cyan-400 font-bold'
                : 'bg-slate-900 border-slate-800'
            }`}
          >
            Minimal Line + Dot
          </button>
          <button
            onClick={() => updateVisual('visualizerStyle', 'waveform_bars')}
            className={`p-2 rounded-lg border text-center ${
              visuals.visualizerStyle === 'waveform_bars'
                ? 'bg-cyan-500/10 border-cyan-500 text-cyan-400 font-bold'
                : 'bg-slate-900 border-slate-800'
            }`}
          >
            Waveform Bars
          </button>
        </div>

        <div className="flex items-center space-x-2 pt-1">
          <span className="text-[11px] text-slate-400">Indicator Color:</span>
          <input
            type="color"
            value={visuals.visualizerColor}
            onChange={(e) => updateVisual('visualizerColor', e.target.value)}
            className="w-6 h-6 rounded border-none cursor-pointer bg-transparent"
          />
          <span className="font-mono text-[11px]">{visuals.visualizerColor}</span>
        </div>
      </div>

      {/* 5. Background Color */}
      <div className="space-y-3 pt-3 border-t border-slate-800">
        <label className="block text-slate-400 font-semibold">Canvas Background</label>
        <div className="flex items-center space-x-3">
          <input
            type="color"
            value={visuals.backgroundColor}
            onChange={(e) => updateVisual('backgroundColor', e.target.value)}
            className="w-8 h-8 rounded border-none cursor-pointer bg-transparent"
          />
          <span className="font-mono text-xs">{visuals.backgroundColor}</span>
          <div className="flex space-x-1 ml-auto">
            {['#FFFFFF', '#0F172A', '#1E293B', '#F8FAFC', '#FEF3C7'].map((c) => (
              <button
                key={c}
                onClick={() => updateVisual('backgroundColor', c)}
                className="w-5 h-5 rounded-full border border-slate-700"
                style={{ backgroundColor: c }}
                title={c}
              />
            ))}
          </div>
        </div>
      </div>

      {/* 6. CTA Badge (Bottom-Right) */}
      <div className="space-y-3 pt-3 border-t border-slate-800">
        <label className="block text-slate-400 font-semibold">Bottom-Right CTA Badge</label>

        <div>
          <span className="text-[11px] text-slate-400 mb-1 block">Badge Text</span>
          <input
            type="text"
            value={visuals.ctaText}
            onChange={(e) => updateVisual('ctaText', e.target.value)}
            placeholder="e.g. Acast, Listen on Spotify..."
            className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-cyan-500"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <span className="text-[11px] text-slate-400 mb-1 block">Badge Background</span>
            <div className="flex items-center space-x-2">
              <input
                type="color"
                value={visuals.ctaBgColor}
                onChange={(e) => updateVisual('ctaBgColor', e.target.value)}
                className="w-7 h-7 rounded border-none cursor-pointer bg-transparent"
              />
              <span className="font-mono text-[11px]">{visuals.ctaBgColor}</span>
            </div>
          </div>

          <div>
            <span className="text-[11px] text-slate-400 mb-1 block">Badge Text Color</span>
            <div className="flex items-center space-x-2">
              <input
                type="color"
                value={visuals.ctaTextColor}
                onChange={(e) => updateVisual('ctaTextColor', e.target.value)}
                className="w-7 h-7 rounded border-none cursor-pointer bg-transparent"
              />
              <span className="font-mono text-[11px]">{visuals.ctaTextColor}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
