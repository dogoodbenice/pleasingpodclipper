import React, { useRef, useEffect } from 'react';
import { VisualSettings, CaptionSegment, WordToken } from '../types';

interface VideoCanvasProps {
  visuals: VisualSettings;
  currentTime: number;
  clipStart: number;
  clipEnd: number;
  segments: CaptionSegment[];
  logoImage: HTMLImageElement | null;
  isPlaying: boolean;
}

export const VideoCanvas: React.FC<VideoCanvasProps> = ({
  visuals,
  currentTime,
  clipStart,
  clipEnd,
  segments,
  logoImage,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Compute canonical canvas dimensions based on aspect ratio
  const getCanvasDimensions = () => {
    switch (visuals.aspectRatio) {
      case '9:16':
        return { width: 1080, height: 1920 };
      case '16:9':
        return { width: 1920, height: 1080 };
      case '1:1':
      default:
        return { width: 1080, height: 1080 };
    }
  };

  const { width, height } = getCanvasDimensions();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 1. Draw Background
    if (visuals.backgroundType === 'gradient' && visuals.gradientSecondaryColor) {
      const grad = ctx.createLinearGradient(0, 0, 0, height);
      grad.addColorStop(0, visuals.backgroundColor);
      grad.addColorStop(1, visuals.gradientSecondaryColor);
      ctx.fillStyle = grad;
    } else {
      ctx.fillStyle = visuals.backgroundColor || '#FFFFFF';
    }
    ctx.fillRect(0, 0, width, height);

    // Padding & layout geometry
    const padX = width * 0.08;
    const topY = height * 0.08;

    // 2. Draw Header: Podcast Title & Episode Title (Top-Left)
    ctx.save();
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    // Podcast Title (Bold)
    const titleSize = Math.round(width * 0.048);
    ctx.font = `800 ${titleSize}px ${visuals.fontFamily}, sans-serif`;
    ctx.fillStyle = visuals.podcastTitleColor || '#111111';
    ctx.fillText(visuals.podcastTitle || 'Podcast Title', padX, topY);

    // Episode Title (Secondary/Regular)
    const subtitleSize = Math.round(width * 0.038);
    ctx.font = `500 ${subtitleSize}px ${visuals.fontFamily}, sans-serif`;
    ctx.fillStyle = visuals.episodeTitleColor || '#666666';
    ctx.fillText(visuals.episodeTitle || 'Episode Title', padX, topY + titleSize * 1.25);
    ctx.restore();

    // 3. Draw Cover Art / Logo (Top-Right)
    const logoSize = Math.round(width * 0.15);
    const logoX = width - padX - logoSize;
    const logoY = topY;

    if (logoImage && logoImage.complete) {
      ctx.save();
      // Rounded rectangle clip
      const radius = logoSize * 0.15;
      ctx.beginPath();
      ctx.moveTo(logoX + radius, logoY);
      ctx.lineTo(logoX + logoSize - radius, logoY);
      ctx.quadraticCurveTo(logoX + logoSize, logoY, logoX + logoSize, logoY + radius);
      ctx.lineTo(logoX + logoSize, logoY + logoSize - radius);
      ctx.quadraticCurveTo(logoX + logoSize, logoY + logoSize, logoX + logoSize - radius, logoY + logoSize);
      ctx.lineTo(logoX + radius, logoY + logoSize);
      ctx.quadraticCurveTo(logoX, logoY + logoSize, logoX, logoY + logoSize - radius);
      ctx.lineTo(logoX, logoY + radius);
      ctx.quadraticCurveTo(logoX, logoY, logoX + radius, logoY);
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(logoImage, logoX, logoY, logoSize, logoSize);
      ctx.restore();
    } else {
      // Placeholder badge if no image loaded
      ctx.save();
      ctx.fillStyle = '#E2E8F0';
      ctx.beginPath();
      ctx.roundRect(logoX, logoY, logoSize, logoSize, logoSize * 0.15);
      ctx.fill();
      ctx.fillStyle = '#94A3B8';
      ctx.font = `700 ${Math.round(logoSize * 0.2)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('LOGO', logoX + logoSize / 2, logoY + logoSize / 2);
      ctx.restore();
    }

    // 4. Draw Captions (Center)
    // Find active segment for currentTime
    const activeSeg = segments.find(
      (s) => currentTime >= s.start - 0.05 && currentTime <= s.end + 0.1
    );

    if (activeSeg) {
      ctx.save();
      const captionFontSize = Math.round(width * (visuals.aspectRatio === '9:16' ? 0.075 : 0.065));
      const lineHeight = captionFontSize * 1.35;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';

      if (visuals.captionAnimation === 'hormozi') {
        // Hormozi mode: show 1-2 punchy words right in the dead center
        const activeWord = activeSeg.words.find(
          (w) => currentTime >= w.start && currentTime <= w.end
        ) || activeSeg.words[0];

        if (activeWord) {
          ctx.font = `900 ${Math.round(captionFontSize * 1.4)}px ${visuals.fontFamily}, sans-serif`;
          ctx.textAlign = 'center';
          ctx.fillStyle = activeWord.color || visuals.activeWordColor || '#06B6D4';
          ctx.fillText(activeWord.word.toUpperCase(), width / 2, height / 2);
        }
      } else {
        // Karaoke Mode: Layout words on lines, highlighting active word
        const maxLineWidth = width - padX * 2;
        ctx.font = `800 ${captionFontSize}px ${visuals.fontFamily}, sans-serif`;

        // Measure & wrap words into lines
        interface RenderWord {
          token: WordToken;
          isActive: boolean;
          isPast: boolean;
          width: number;
        }

        const lines: RenderWord[][] = [[]];
        let currentLineWidth = 0;

        activeSeg.words.forEach((token) => {
          const isActive = currentTime >= token.start && currentTime <= token.end;
          const isPast = currentTime > token.end;
          const wordText = token.word + ' ';
          const wordWidth = ctx.measureText(wordText).width;

          if (currentLineWidth + wordWidth > maxLineWidth && lines[lines.length - 1].length > 0) {
            lines.push([]);
            currentLineWidth = 0;
          }

          lines[lines.length - 1].push({
            token,
            isActive,
            isPast,
            width: wordWidth,
          });
          currentLineWidth += wordWidth;
        });

        // Vertical center of the screen
        const totalHeight = lines.length * lineHeight;
        const startY = height / 2 - totalHeight / 2 + lineHeight / 2;

        lines.forEach((line, lineIndex) => {
          let lineX = padX;
          const y = startY + lineIndex * lineHeight;

          line.forEach(({ token, isActive, width: wWidth }) => {
            ctx.save();
            if (isActive) {
              ctx.fillStyle = token.color || visuals.activeWordColor || '#999999';
              ctx.font = `900 ${captionFontSize}px ${visuals.fontFamily}, sans-serif`;
            } else {
              ctx.fillStyle = token.color || visuals.inactiveWordColor || '#111111';
              ctx.font = token.bold
                ? `800 ${captionFontSize}px ${visuals.fontFamily}, sans-serif`
                : `600 ${captionFontSize}px ${visuals.fontFamily}, sans-serif`;
            }
            ctx.fillText(token.word, lineX, y);
            ctx.restore();
            lineX += wWidth;
          });
        });
      }
      ctx.restore();
    }

    // 5. Draw Progress / Visualizer (Bottom-Left)
    const clipDuration = Math.max(0.1, clipEnd - clipStart);
    const progress = Math.min(1.0, Math.max(0.0, (currentTime - clipStart) / clipDuration));
    const bottomY = height * 0.88;

    ctx.save();
    if (visuals.visualizerStyle === 'minimal_dot') {
      // Minimal line with circle dot scrubber (matching screenshot 1)
      const barWidth = width * 0.22;
      const barHeight = Math.round(height * 0.016);
      const dotRadius = Math.round(barHeight * 1.35);

      // Background track pill
      ctx.fillStyle = visuals.visualizerColor || '#111111';
      ctx.beginPath();
      ctx.roundRect(padX, bottomY - barHeight / 2, barWidth, barHeight, barHeight / 2);
      ctx.fill();

      // Scrubber dot position
      const dotX = padX + progress * barWidth;
      ctx.beginPath();
      ctx.arc(dotX, bottomY, dotRadius, 0, Math.PI * 2);
      ctx.fillStyle = visuals.visualizerColor || '#111111';
      ctx.fill();
    } else {
      // Audio Waveform Spectrum Bars (Style B)
      const barCount = 20;
      const totalWidth = width * 0.32;
      const barWidth = (totalWidth / barCount) * 0.55;
      const maxBarHeight = height * 0.05;

      ctx.fillStyle = visuals.visualizerColor || '#111111';
      for (let i = 0; i < barCount; i++) {
        const x = padX + i * (totalWidth / barCount);
        // Animated simulated frequency response based on progress and sine oscillation
        const wave = Math.sin(currentTime * 8 + i * 0.7) * 0.5 + 0.5;
        const barH = Math.max(4, wave * maxBarHeight);
        ctx.beginPath();
        ctx.roundRect(x, bottomY - barH / 2, barWidth, barH, barWidth / 2);
        ctx.fill();
      }
    }
    ctx.restore();

    // 6. Draw CTA Badge (Bottom-Right)
    if (visuals.ctaText) {
      ctx.save();
      const badgeFontSize = Math.round(width * 0.042);
      ctx.font = `800 ${badgeFontSize}px ${visuals.fontFamily}, sans-serif`;
      const textMetrics = ctx.measureText(visuals.ctaText);
      const badgePadH = badgeFontSize * 0.9;
      const badgePadV = badgeFontSize * 0.55;
      const badgeW = textMetrics.width + badgePadH * 2;
      const badgeH = badgeFontSize + badgePadV * 2;
      const badgeX = width - padX - badgeW;
      const badgeY = bottomY - badgeH / 2;

      // Rounded pill badge
      ctx.fillStyle = visuals.ctaBgColor || '#222222';
      ctx.beginPath();
      ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 12);
      ctx.fill();

      // Badge Text
      ctx.fillStyle = visuals.ctaTextColor || '#F5A623';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(visuals.ctaText, badgeX + badgeW / 2, badgeY + badgeH / 2);
      ctx.restore();
    }
  }, [visuals, currentTime, clipStart, clipEnd, segments, logoImage, width, height]);

  // Determine aspect ratio class for responsive preview container
  const getContainerAspect = () => {
    switch (visuals.aspectRatio) {
      case '9:16':
        return 'aspect-[9/16] max-h-[580px]';
      case '16:9':
        return 'aspect-[16/9] max-w-[640px]';
      case '1:1':
      default:
        return 'aspect-square max-h-[520px]';
    }
  };

  return (
    <div className={`relative flex items-center justify-center bg-black/40 rounded-xl overflow-hidden shadow-2xl border border-slate-700/60 mx-auto ${getContainerAspect()}`}>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        className="w-full h-full object-contain"
      />
    </div>
  );
};
