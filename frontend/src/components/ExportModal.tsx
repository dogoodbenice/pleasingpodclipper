import React, { useState, useEffect } from 'react';
import { X, Download, Film, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { ProjectDraft } from '../types';
import { startRender, getRenderStatus, RenderJob } from '../api';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: ProjectDraft;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  project,
}) => {
  const [job, setJob] = useState<RenderJob | null>(null);
  const [isStarting, setIsStarting] = useState(false);

  const clipDuration = Math.max(0, project.clip_range.end - project.clip_range.start);

  // Poll render job status if processing
  useEffect(() => {
    if (!job || job.status === 'completed' || job.status === 'failed') return;

    const interval = setInterval(async () => {
      try {
        const updated = await getRenderStatus(job.job_id);
        setJob(updated);
      } catch (err) {
        console.error('Error polling render status:', err);
      }
    }, 500);

    return () => clearInterval(interval);
  }, [job]);

  const handleStartRender = async () => {
    try {
      setIsStarting(true);
      const res = await startRender(project);
      setJob(res);
    } catch (err) {
      alert(`Render failed to start: ${err}`);
    } finally {
      setIsStarting(false);
    }
  };

  const handleReset = () => {
    setJob(null);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="bg-[#111827] border border-slate-700/80 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div className="flex items-center space-x-2">
            <Film className="w-5 h-5 text-cyan-400" />
            <h2 className="text-base font-bold text-white">Export Video Clip</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {!job ? (
            <>
              {/* Summary details */}
              <div className="bg-slate-900/80 rounded-xl p-4 border border-slate-800 space-y-2.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-400">Clip Name:</span>
                  <span className="font-semibold text-white">{project.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Aspect Ratio:</span>
                  <span className="font-mono text-cyan-400 font-bold">
                    {project.visuals.aspectRatio}{' '}
                    {project.visuals.aspectRatio === '9:16'
                      ? '(1080x1920 Vertical)'
                      : project.visuals.aspectRatio === '16:9'
                      ? '(1920x1080 Wide)'
                      : '(1080x1080 Square)'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Clip Duration:</span>
                  <span className="font-mono text-white">{clipDuration.toFixed(1)} seconds</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Caption Style:</span>
                  <span className="text-white capitalize">
                    {project.visuals.captionAnimation} • {project.caption_segments.length} segments
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Hardware Acceleration:</span>
                  <span className="text-emerald-400 font-semibold">
                    Apple Silicon VideoToolbox (H.264)
                  </span>
                </div>
              </div>

              <button
                onClick={handleStartRender}
                disabled={isStarting}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-sm shadow-lg shadow-cyan-500/25 flex items-center justify-center space-x-2 transition-all disabled:opacity-50"
              >
                {isStarting ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Preparing Render...</span>
                  </>
                ) : (
                  <>
                    <Film size={16} />
                    <span>Render Social MP4 Video</span>
                  </>
                )}
              </button>
            </>
          ) : job.status === 'pending' || job.status === 'processing' ? (
            <div className="py-8 text-center space-y-4">
              <Loader2 className="w-10 h-10 text-cyan-400 animate-spin mx-auto" />
              <div>
                <h4 className="text-sm font-bold text-white">Rendering High-Res Video...</h4>
                <p className="text-xs text-slate-400 mt-1">
                  Encoding frames with hardware acceleration (~2-4 seconds)
                </p>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-slate-900 h-3 rounded-full overflow-hidden border border-slate-800">
                <div
                  className="bg-gradient-to-r from-cyan-500 to-blue-500 h-full transition-all duration-300"
                  style={{ width: `${Math.round(job.progress * 100)}%` }}
                />
              </div>
              <div className="font-mono text-xs text-cyan-400 font-bold">
                {Math.round(job.progress * 100)}%
              </div>
            </div>
          ) : job.status === 'completed' ? (
            <div className="py-4 text-center space-y-4">
              <div className="w-12 h-12 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto border border-emerald-500/40">
                <CheckCircle2 size={28} />
              </div>

              <div>
                <h4 className="text-base font-bold text-white">Video Ready!</h4>
                <p className="text-xs text-slate-400 mt-1">
                  Your clip is rendered in 1080p and ready for TikTok, Instagram & YouTube.
                </p>
              </div>

              {/* Preview player */}
              {job.download_url && (
                <div className="rounded-xl overflow-hidden border border-slate-800 bg-black max-h-56 mx-auto flex items-center justify-center">
                  <video
                    src={job.download_url}
                    controls
                    className="max-h-56 w-auto"
                    autoPlay
                    loop
                  />
                </div>
              )}

              <div className="flex items-center space-x-3 pt-2">
                <button
                  onClick={handleReset}
                  className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300"
                >
                  Render Another
                </button>
                <a
                  href={job.download_url || '#'}
                  download={job.filename}
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-black font-extrabold text-xs shadow-lg shadow-emerald-500/20 flex items-center justify-center space-x-1.5"
                >
                  <Download size={15} />
                  <span>Download MP4</span>
                </a>
              </div>
            </div>
          ) : (
            <div className="py-6 text-center space-y-3">
              <AlertCircle className="w-10 h-10 text-rose-400 mx-auto" />
              <h4 className="text-sm font-bold text-white">Rendering Failed</h4>
              <p className="text-xs text-rose-300 bg-rose-950/40 p-3 rounded-lg border border-rose-900 font-mono text-left">
                {job.error || 'Unknown rendering error'}
              </p>
              <button
                onClick={handleReset}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white"
              >
                Try Again
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
