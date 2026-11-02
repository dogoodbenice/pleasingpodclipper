import React, { useEffect, useState } from 'react';
import { X, Copy, Trash2, FolderOpen, Plus, Clock, Film } from 'lucide-react';
import { ProjectSummary } from '../types';
import { getProjects, deleteProject, duplicateProject } from '../api';

interface DraftsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoadProject: (id: string) => void;
  onNewProject: () => void;
}

export const DraftsModal: React.FC<DraftsModalProps> = ({
  isOpen,
  onClose,
  onLoadProject,
  onNewProject,
}) => {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [loading, setLoading] = useState(false);

  const loadList = async () => {
    try {
      setLoading(true);
      const list = await getProjects();
      setProjects(list);
    } catch (err) {
      console.error('Failed to load drafts:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadList();
    }
  }, [isOpen]);

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this draft?')) return;
    try {
      await deleteProject(id);
      setProjects((prev) => prev.filter((p) => p.id !== id));
    } catch (err) {
      console.error('Failed to delete project:', err);
    }
  };

  const handleDuplicate = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      await duplicateProject(id);
      loadList();
    } catch (err) {
      console.error('Failed to duplicate project:', err);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-[#111827] border border-slate-700/80 rounded-2xl w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div className="flex items-center space-x-2">
            <FolderOpen className="w-5 h-5 text-cyan-400" />
            <h2 className="text-base font-bold text-white">Saved Drafts & Projects</h2>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => {
                onNewProject();
                onClose();
              }}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-black font-bold text-xs"
            >
              <Plus size={14} />
              <span>New Clip</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* List of drafts */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3">
          {loading ? (
            <div className="text-center py-12 text-slate-400 text-sm">Loading drafts...</div>
          ) : projects.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <Film className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <p className="text-sm">No saved drafts yet.</p>
              <p className="text-xs text-slate-500 mt-1">Upload an audio file and start creating clips!</p>
            </div>
          ) : (
            projects.map((proj) => (
              <div
                key={proj.id}
                onClick={() => {
                  onLoadProject(proj.id);
                  onClose();
                }}
                className="group flex items-center justify-between p-4 rounded-xl bg-slate-900/80 hover:bg-slate-800/80 border border-slate-800 hover:border-cyan-500/50 cursor-pointer transition-all"
              >
                <div className="flex-1 min-w-0 pr-4">
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-white text-sm truncate">
                      {proj.name || 'Untitled Clip'}
                    </span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-cyan-400 border border-slate-700">
                      {proj.aspect_ratio || '1:1'}
                    </span>
                  </div>

                  <div className="text-xs text-slate-400 mt-1 truncate">
                    {proj.podcast_title || 'Podcast'} • {proj.episode_title || 'Episode'}
                  </div>

                  <div className="flex items-center space-x-4 text-[11px] text-slate-500 mt-2 font-mono">
                    <span className="flex items-center space-x-1">
                      <Clock size={12} />
                      <span>
                        Clip:{' '}
                        {((proj.clip_range?.end || 0) - (proj.clip_range?.start || 0)).toFixed(1)}s
                      </span>
                    </span>
                    <span>Saved: {new Date(proj.updated_at).toLocaleDateString()}</span>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={(e) => handleDuplicate(e, proj.id)}
                    className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white"
                    title="Duplicate Clip from this episode"
                  >
                    <Copy size={15} />
                  </button>
                  <button
                    onClick={(e) => handleDelete(e, proj.id)}
                    className="p-2 rounded-lg bg-slate-800 hover:bg-rose-900/50 text-slate-400 hover:text-rose-400"
                    title="Delete Draft"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
