import React, { useState, useRef, useEffect } from 'react';

interface TooltipProps {
  title: string;
  description?: string;
  shortcut?: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
  delay?: number; // milliseconds, default 1000
  children: React.ReactNode;
  className?: string;
}

export const Tooltip: React.FC<TooltipProps> = ({
  title,
  description,
  shortcut,
  position = 'top',
  delay = 1000,
  children,
  className = '',
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleMouseEnter = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setIsVisible(true);
    }, delay);
  };

  const handleMouseLeave = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setIsVisible(false);
  };

  const handleClick = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setIsVisible(false);
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const getPositionClasses = () => {
    switch (position) {
      case 'bottom':
        return 'top-full left-1/2 -translate-x-1/2 mt-2';
      case 'left':
        return 'right-full top-1/2 -translate-y-1/2 mr-2';
      case 'right':
        return 'left-full top-1/2 -translate-y-1/2 ml-2';
      case 'top':
      default:
        return 'bottom-full left-1/2 -translate-x-1/2 mb-2';
    }
  };

  return (
    <div
      className={`relative inline-flex items-center ${className}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
    >
      {children}

      {isVisible && (
        <div
          role="tooltip"
          className={`absolute z-50 pointer-events-none w-max max-w-xs px-2.5 py-1.5 bg-[#161f30] border border-cyan-500/40 rounded-lg shadow-xl shadow-black/60 text-left transition-opacity duration-200 animate-in fade-in zoom-in-95 ${getPositionClasses()}`}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold text-slate-100">{title}</span>
            {shortcut && (
              <kbd className="px-1.5 py-0.5 bg-slate-900 border border-slate-700 rounded text-[9px] font-mono text-cyan-300 font-bold">
                {shortcut}
              </kbd>
            )}
          </div>
          {description && (
            <p className="text-[10px] text-slate-400 mt-0.5 leading-tight">{description}</p>
          )}
        </div>
      )}
    </div>
  );
};
