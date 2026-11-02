import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Upload, 
  FolderOpen, 
  Sparkles, 
  Sliders, 
  FileText, 
  Download
} from 'lucide-react';
import { ProjectDraft, VisualSettings, CaptionSegment, ClipRange } from './types';
import { VideoCanvas } from './components/VideoCanvas';
import { WaveformTimeline } from './components/WaveformTimeline';
import { TranscriptEditor } from './components/TranscriptEditor';
import { StylePanel } from './components/StylePanel';
import { DraftsModal } from './components/DraftsModal';
import { ExportModal } from './components/ExportModal';
import { uploadAudio, transcribeRange, saveProject, getProject } from './api';

const DEFAULT_VISUALS: VisualSettings = {
  aspectRatio: '1:1',
  backgroundType: 'solid',
  backgroundColor: '#FFFFFF',
  podcastTitle: 'Agreeably',
  podcastTitleColor: '#111111',
  episodeTitle: 'The quietest appliance?',
  episodeTitleColor: '#777777',
  logoUrl: null,
  ctaText: 'Acast',
  ctaBgColor: '#222222',
  ctaTextColor: '#F5A623',
  visualizerStyle: 'minimal_dot',
  visualizerColor: '#111111',
  captionAnimation: 'karaoke',
  fontFamily: 'Inter',
  fontSize: 48,
  activeWordColor: '#999999',
  inactiveWordColor: '#111111',
};

export const App: React.FC = () => {
  // Project State
  const [currentProject, setCurrentProject] = useState<ProjectDraft>({
    name: 'Agreeably Clip 1',
    audio_filename: '',
    audio_path: '',
    audio_duration: 0,
    waveform_peaks: [],
    clip_range: { start: 0, end: 30 },
    visuals: DEFAULT_VISUALS,
    caption_segments: [],
  });

  // Audio Playback State
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);

  // UI state
  const [activeTab, setActiveTab] = useState<'transcript' | 'style'>('transcript');
  const [isDraftsModalOpen, setIsDraftsModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving'>('saved');
  const [logoImage, setLogoImage] = useState<HTMLImageElement | null>(null);

  // Auto-save debounce timer
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);


  // Load logo image if url changes
  useEffect(() => {
    if (currentProject.visuals.logoUrl) {
      const img = new Image();
      img.src = currentProject.visuals.logoUrl;
      img.onload = () => setLogoImage(img);
    } else {
      setLogoImage(null);
    }
  }, [currentProject.visuals.logoUrl]);

  // Audio time updater
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
      // Loop or stop if reaching clip end
      if (audio.currentTime >= currentProject.clip_range.end) {
        audio.pause();
        audio.currentTime = currentProject.clip_range.start;
        setIsPlaying(false);
      }
    };

    const onEnded = () => {
      setIsPlaying(false);
      audio.currentTime = currentProject.clip_range.start;
    };

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('ended', onEnded);
    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('ended', onEnded);
    };
  }, [currentProject.clip_range]);

  // Trigger Debounced Auto-Save
  const triggerAutoSave = useCallback((draft: ProjectDraft) => {
    if (!draft.audio_path) return;
    setSaveStatus('saving');
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);

    saveTimeoutRef.current = setTimeout(async () => {
      try {
        const saved = await saveProject(draft);
        if (saved.id && !draft.id) {
          setCurrentProject((prev) => ({ ...prev, id: saved.id }));
        }
        setSaveStatus('saved');
      } catch (err) {
        console.error('Auto-save error:', err);
      }
    }, 1200);
  }, []);

  // Update handlers
  const handleVisualsChange = (visuals: VisualSettings) => {
    const updated = { ...currentProject, visuals };
    setCurrentProject(updated);
    triggerAutoSave(updated);
  };

  const handleSegmentsChange = (caption_segments: CaptionSegment[]) => {
    const updated = { ...currentProject, caption_segments };
    setCurrentProject(updated);
    triggerAutoSave(updated);
  };

  const handleClipRangeChange = (clip_range: ClipRange) => {
    const updated = { ...currentProject, clip_range };
    setCurrentProject(updated);
    triggerAutoSave(updated);
  };

  const handleSeek = (time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time;
    }
    setCurrentTime(time);
  };

  const handleTogglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      if (currentTime < currentProject.clip_range.start || currentTime >= currentProject.clip_range.end) {
        audioRef.current.currentTime = currentProject.clip_range.start;
      }
      audioRef.current.play().then(() => setIsPlaying(true)).catch(console.error);
    }
  };

  // Upload handler
  const handleAudioUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsUploading(true);
      const res = await uploadAudio(file);
      const clipDuration = Math.min(30, res.duration);

      const newProj: ProjectDraft = {
        name: file.name.replace(/\.[^/.]+$/, '') + ' Clip',
        audio_filename: res.filename,
        audio_path: res.url,
        audio_duration: res.duration,
        waveform_peaks: res.waveform_peaks,
        clip_range: { start: 0, end: clipDuration },
        visuals: {
          ...DEFAULT_VISUALS,
          episodeTitle: file.name.replace(/\.[^/.]+$/, ''),
        },
        caption_segments: [],
      };

      setCurrentProject(newProj);
      if (audioRef.current) {
        audioRef.current.src = res.url;
        audioRef.current.load();
      }
      triggerAutoSave(newProj);
    } catch (err) {
      alert(`Upload error: ${err}`);
    } finally {
      setIsUploading(false);
    }
  };

  // Transcribe selected range
  const handleTranscribeRange = async () => {
    if (!currentProject.audio_path) return;
    try {
      setIsTranscribing(true);
      const res = await transcribeRange(
        currentProject.audio_path,
        currentProject.clip_range.start,
        currentProject.clip_range.end,
        'base.en'
      );
      handleSegmentsChange(res.segments);
    } catch (err) {
      alert(`Transcription error: ${err}`);
    } finally {
      setIsTranscribing(false);
    }
  };

  // Load project from draft list
  const handleLoadProject = async (id: string) => {
    try {
      const proj = await getProject(id);
      setCurrentProject(proj);
      if (audioRef.current) {
        audioRef.current.src = proj.audio_path;
        audioRef.current.load();
      }
      setCurrentTime(proj.clip_range.start);
    } catch (err) {
      alert(`Failed to load project: ${err}`);
    }
  };

  const handleNewProject = () => {
    setCurrentProject({
      name: 'New Podcast Clip',
      audio_filename: '',
      audio_path: '',
      audio_duration: 0,
      waveform_peaks: [],
      clip_range: { start: 0, end: 30 },
      visuals: DEFAULT_VISUALS,
      caption_segments: [],
    });
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
    }
    setIsPlaying(false);
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-[#0b0f19] text-slate-100 overflow-hidden font-sans">
      {/* Hidden Audio Element */}
      <audio ref={audioRef} preload="metadata" />

      {/* Top Header Bar */}
      <header className="h-14 border-b border-slate-800 bg-[#0d131f] px-5 flex items-center justify-between shrink-0">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center shadow-md shadow-cyan-500/20">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div>
            <input
              type="text"
              value={currentProject.name}
              onChange={(e) => {
                const updated = { ...currentProject, name: e.target.value };
                setCurrentProject(updated);
                triggerAutoSave(updated);
              }}
              className="bg-transparent font-bold text-sm text-white hover:bg-slate-800/60 focus:bg-slate-800 px-2 py-0.5 rounded transition-colors focus:outline-none focus:ring-1 focus:ring-cyan-500"
              placeholder="Clip Name"
            />
          </div>
          <span className="text-slate-600">|</span>
          <div className="flex items-center space-x-1.5 text-xs">
            <span
              className={`w-2 h-2 rounded-full ${
                saveStatus === 'saved' ? 'bg-emerald-500' : 'bg-amber-400 animate-pulse'
              }`}
            />
            <span className="text-slate-400">
              {saveStatus === 'saved' ? 'Saved' : 'Saving...'}
            </span>
          </div>
        </div>

        {/* Header Right Actions */}
        <div className="flex items-center space-x-3">
          <button
            onClick={() => setIsDraftsModalOpen(true)}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700"
          >
            <FolderOpen size={14} className="text-cyan-400" />
            <span>Drafts</span>
          </button>

          <label className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700 cursor-pointer">
            <Upload size={14} className="text-amber-400" />
            <span>{isUploading ? 'Uploading...' : 'Load Audio'}</span>
            <input
              type="file"
              accept="audio/*"
              onChange={handleAudioUpload}
              className="hidden"
            />
          </label>

          <button
            onClick={() => setIsExportModalOpen(true)}
            disabled={!currentProject.audio_path}
            className="flex items-center space-x-1.5 px-4 py-1.5 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-xs shadow-md shadow-cyan-500/20 disabled:opacity-50"
          >
            <Download size={14} />
            <span>Export Clip</span>
          </button>
        </div>
      </header>

      {/* Main Studio Body: 2 Columns */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Column: Tabs for Transcript & Style (Reference Image 2) */}
        <div className="w-[440px] border-r border-slate-800 flex flex-col shrink-0 bg-[#0d131f]">
          {/* Tab Headers */}
          <div className="flex border-b border-slate-800 bg-slate-900/50">
            <button
              onClick={() => setActiveTab('transcript')}
              className={`flex-1 py-3 text-xs font-bold flex items-center justify-center space-x-2 border-b-2 transition-all ${
                activeTab === 'transcript'
                  ? 'border-cyan-400 text-cyan-400 bg-slate-900'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <FileText size={15} />
              <span>TRANSCRIPT</span>
            </button>
            <button
              onClick={() => setActiveTab('style')}
              className={`flex-1 py-3 text-xs font-bold flex items-center justify-center space-x-2 border-b-2 transition-all ${
                activeTab === 'style'
                  ? 'border-cyan-400 text-cyan-400 bg-slate-900'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Sliders size={15} />
              <span>STYLE & BRAND</span>
            </button>
          </div>

          {/* Tab Content */}
          <div className="flex-1 overflow-hidden">
            {activeTab === 'transcript' ? (
              <TranscriptEditor
                segments={currentProject.caption_segments}
                currentTime={currentTime}
                onSegmentsChange={handleSegmentsChange}
                onSeek={handleSeek}
                onTriggerTranscribe={handleTranscribeRange}
                isTranscribing={isTranscribing}
              />
            ) : (
              <StylePanel
                visuals={currentProject.visuals}
                onVisualsChange={handleVisualsChange}
                onLogoUploaded={setLogoImage}
              />
            )}
          </div>
        </div>

        {/* Right Column: Live Video Canvas Preview */}
        <div className="flex-1 flex flex-col bg-[#080c14] relative overflow-hidden items-center justify-center p-6">
          {!currentProject.audio_path ? (
            <div className="text-center p-8 border-2 border-dashed border-slate-800 rounded-2xl max-w-md bg-slate-900/30">
              <Upload className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <h3 className="text-base font-bold text-slate-200 mb-1">No Audio Loaded</h3>
              <p className="text-xs text-slate-400 mb-4">
                Upload your 45-minute episode or audio clip to start creating social video audiograms.
              </p>
              <label className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-bold text-xs cursor-pointer shadow-lg shadow-cyan-500/20">
                <Upload size={14} />
                <span>Choose Audio File</span>
                <input
                  type="file"
                  accept="audio/*"
                  onChange={handleAudioUpload}
                  className="hidden"
                />
              </label>
            </div>
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center">
              <VideoCanvas
                visuals={currentProject.visuals}
                currentTime={currentTime}
                clipStart={currentProject.clip_range.start}
                clipEnd={currentProject.clip_range.end}
                segments={currentProject.caption_segments}
                logoImage={logoImage}
                isPlaying={isPlaying}
              />
            </div>
          )}
        </div>
      </div>

      {/* Bottom Timeline Section (Full episode waveform & clip range slider) */}
      <div className="shrink-0">
        <WaveformTimeline
          duration={currentProject.audio_duration}
          currentTime={currentTime}
          clipRange={currentProject.clip_range}
          waveformPeaks={currentProject.waveform_peaks}
          isPlaying={isPlaying}
          onSeek={handleSeek}
          onTogglePlay={handleTogglePlay}
          onClipRangeChange={handleClipRangeChange}
          onTranscribeRange={handleTranscribeRange}
          isTranscribing={isTranscribing}
        />
      </div>

      {/* Saved Drafts Modal */}
      <DraftsModal
        isOpen={isDraftsModalOpen}
        onClose={() => setIsDraftsModalOpen(false)}
        onLoadProject={handleLoadProject}
        onNewProject={handleNewProject}
      />

      {/* Video Export Modal */}
      <ExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        project={currentProject}
      />
    </div>
  );
};


export default App;
