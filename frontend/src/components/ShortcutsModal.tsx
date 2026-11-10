import React from 'react';
import { X, Keyboard } from 'lucide-react';

interface ShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ShortcutsModal: React.FC<ShortcutsModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const shortcuts = [
    { key: '⌘Z / Ctrl+Z', desc: 'Undo last edit' },
    { key: '⇧⌘Z / Ctrl+Y', desc: 'Redo previously undone edit' },
    { key: 'Space', desc: 'Play / Pause playback' },
    { key: 'J / ←', desc: 'Rewind 2 seconds (Shift + J for 5s)' },
    { key: 'L / →', desc: 'Fast forward 2 seconds (Shift + L for 5s)' },
    { key: 'K', desc: 'Toggle pause / play' },
    { key: '[', desc: 'Set Clip Start (In-point) to playhead' },
    { key: ']', desc: 'Set Clip End (Out-point) to playhead' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-[#111827] border border-slate-700/80 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <div className="flex items-center space-x-2">
            <Keyboard className="w-5 h-5 text-cyan-400" />
            <h2 className="text-sm font-bold text-white">Keyboard Shortcuts</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-5 space-y-3">
          {shortcuts.map((s, idx) => (
            <div key={idx} className="flex items-center justify-between py-1.5 border-b border-slate-850">
              <span className="text-xs text-slate-300">{s.desc}</span>
              <kbd className="px-2.5 py-1 bg-slate-900 border border-slate-700 rounded-lg text-cyan-400 font-mono text-xs font-bold shadow-sm">
                {s.key}
              </kbd>
            </div>
          ))}
        </div>

        <div className="px-5 py-3 bg-slate-900/60 border-t border-slate-800 text-center">
          <span className="text-[11px] text-slate-400">
            Shortcuts are active whenever you are not typing in a text field.
          </span>
        </div>
      </div>
    </div>
  );
};
