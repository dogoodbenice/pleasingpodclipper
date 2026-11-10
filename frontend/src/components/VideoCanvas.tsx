import React, { useRef, useEffect } from 'react';
import { VisualSettings, CaptionSegment, WordToken, OverlayAsset } from '../types';
import { isImageToken, isWaveToken, layoutArcRun, visibleTokens } from '../captionLayout';

interface VideoCanvasProps {
  visuals: VisualSettings;
  currentTime: number;
  clipStart: number;
  clipEnd: number;
  segments: CaptionSegment[];
  overlays?: OverlayAsset[];
  logoImage: HTMLImageElement | null;
  mediaImages: Record<string, HTMLImageElement>;
  isPlaying: boolean;
}

export const VideoCanvas: React.FC<VideoCanvasProps> = ({
  visuals,
  currentTime,
  clipStart,
  clipEnd,
  segments,
  overlays = [],
  logoImage,
  mediaImages,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

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

    if (visuals.backgroundType === 'gradient' && visuals.gradientSecondaryColor) {
      const grad = ctx.createLinearGradient(0, 0, 0, height);
      grad.addColorStop(0, visuals.backgroundColor);
      grad.addColorStop(1, visuals.gradientSecondaryColor);
      ctx.fillStyle = grad;
    } else {
      ctx.fillStyle = visuals.backgroundColor || '#FFFFFF';
    }
    ctx.fillRect(0, 0, width, height);

    const padX = width * 0.08;
    const topY = height * 0.08;

    ctx.save();
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    const titleSize = Math.round(width * 0.048);
    ctx.font = `800 ${titleSize}px ${visuals.fontFamily}, sans-serif`;
    ctx.fillStyle = visuals.podcastTitleColor || '#111111';
    ctx.fillText(visuals.podcastTitle || 'Podcast Title', padX, topY);

    const subtitleSize = Math.round(width * 0.038);
    ctx.font = `500 ${subtitleSize}px ${visuals.fontFamily}, sans-serif`;
    ctx.fillStyle = visuals.episodeTitleColor || '#666666';
    ctx.fillText(visuals.episodeTitle || 'Episode Title', padX, topY + titleSize * 1.25);
    ctx.restore();

    const logoSize = Math.round(width * 0.15);
    const logoX = width - padX - logoSize;
    const logoY = topY;

    if (logoImage && logoImage.complete) {
      ctx.save();
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

    const captionFontSize = Math.round(width * (visuals.aspectRatio === '9:16' ? 0.075 : 0.065));
    const lineHeight = captionFontSize * 1.35;
    const maxLineWidth = width - padX * 2;

    // Overlays behind captions
    overlays.forEach((overlay) => {
      if (currentTime < overlay.start || currentTime > overlay.end) return;
      const img = mediaImages[overlay.url];
      if (!img || !img.complete || !img.naturalWidth) return;
      const drawW = width * overlay.scale;
      const drawH = drawW * (img.naturalHeight / img.naturalWidth);
      const x = overlay.x * width - drawW / 2;
      const y = overlay.y * height - drawH / 2;
      ctx.drawImage(img, x, y, drawW, drawH);
    });

    const activeSeg = segments.find(
      (s) => currentTime >= s.start - 0.05 && currentTime <= s.end + 0.1
    );

    if (activeSeg) {
      ctx.save();
      const tokens = visibleTokens(activeSeg.words);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      const captionFont = `800 ${captionFontSize}px ${visuals.fontFamily}, sans-serif`;
      ctx.font = captionFont;

      if (visuals.captionAnimation === 'hormozi') {
        const activeWord = tokens.find(
          (w) => !isImageToken(w) && currentTime >= w.start && currentTime <= w.end
        );
        if (activeWord) {
          ctx.font = `800 ${Math.round(captionFontSize * 1.4)}px ${visuals.fontFamily}, sans-serif`;
          ctx.textAlign = 'center';
          ctx.fillStyle = activeWord.color || visuals.activeWordColor || '#06B6D4';
          ctx.fillText(activeWord.word.toUpperCase(), width / 2, height / 2);
        }
      } else {
        type LineItem =
          | {
              kind: 'word';
              token: WordToken;
              isActive: boolean;
              width: number;
            }
          | {
              kind: 'wave';
              tokens: WordToken[];
              width: number;
              chars: { char: string; width: number; tokenIndex: number }[];
            }
          | {
              kind: 'image';
              token: WordToken;
              width: number;
              height: number;
            };

        const items: LineItem[] = [];
        let i = 0;
        while (i < tokens.length) {
          const token = tokens[i];
          if (isImageToken(token)) {
            const img = token.imageUrl ? mediaImages[token.imageUrl] : undefined;
            const boxH = captionFontSize * 1.4;
            const aspect = img && img.naturalWidth ? img.naturalWidth / img.naturalHeight : 1;
            items.push({ kind: 'image', token, width: boxH * aspect, height: boxH });
            i += 1;
            continue;
          }
          if (isWaveToken(token)) {
            const run: WordToken[] = [];
            while (i < tokens.length && isWaveToken(tokens[i])) {
              run.push(tokens[i]);
              i += 1;
            }
            const chars: { char: string; width: number; tokenIndex: number }[] = [];
            run.forEach((t, ti) => {
              const text = t.word + (ti < run.length - 1 ? ' ' : '');
              for (const ch of text) {
                chars.push({ char: ch, width: ctx.measureText(ch).width, tokenIndex: ti });
              }
            });
            const totalW = chars.reduce((s, c) => s + c.width, 0);
            items.push({ kind: 'wave', tokens: run, width: totalW, chars });
            continue;
          }
          const isActive = currentTime >= token.start && currentTime <= token.end;
          const wordText = token.word + ' ';
          items.push({
            kind: 'word',
            token,
            isActive,
            width: ctx.measureText(wordText).width,
          });
          i += 1;
        }

        const lines: LineItem[][] = [[]];
        let currentLineWidth = 0;
        items.forEach((item) => {
          if (currentLineWidth + item.width > maxLineWidth && lines[lines.length - 1].length > 0) {
            lines.push([]);
            currentLineWidth = 0;
          }
          lines[lines.length - 1].push(item);
          currentLineWidth += item.width;
        });

        const extraRise = lines.some((line) => line.some((it) => it.kind === 'wave'))
          ? captionFontSize * 0.55
          : 0;
        const totalHeight = lines.length * lineHeight + extraRise;
        const startY = height / 2 - totalHeight / 2 + lineHeight / 2;

        lines.forEach((line, lineIndex) => {
          let lineX = padX;
          const y = startY + lineIndex * lineHeight;

          line.forEach((item) => {
            if (item.kind === 'image') {
              const img = item.token.imageUrl ? mediaImages[item.token.imageUrl] : undefined;
              if (img && img.complete) {
                ctx.drawImage(img, lineX, y - item.height / 2, item.width, item.height);
              }
              lineX += item.width + captionFontSize * 0.15;
              return;
            }

            if (item.kind === 'wave') {
              const variant =
                typeof item.tokens[0]?.waveVariant === 'number'
                  ? item.tokens[0].waveVariant
                  : item.tokens[0]?.id
                  ? item.tokens[0].id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) % 5
                  : 0;
              const arc = layoutArcRun(item.chars, captionFontSize, lineX, y, variant);
              ctx.save();
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.font = captionFont;
              arc.glyphs.forEach((g) => {
                const tok = item.tokens[g.tokenIndex];
                const isActive = currentTime >= tok.start && currentTime <= tok.end;
                ctx.fillStyle = tok.color || (isActive ? visuals.activeWordColor : visuals.inactiveWordColor) || '#111111';
                ctx.save();
                ctx.translate(g.x, g.y);
                ctx.rotate(g.angle);
                ctx.fillText(g.char, 0, 0);
                ctx.restore();
              });
              ctx.restore();
              lineX += item.width;
              return;
            }

            ctx.save();
            ctx.font = captionFont;
            const hStyle = visuals.highlightStyle || 'color';
            const wordW = ctx.measureText(item.token.word).width;

            if (item.isActive) {
              if (hStyle === 'pill') {
                const pillPadX = captionFontSize * 0.22;
                const pillH = captionFontSize * 1.15;
                const pillRadius = captionFontSize * 0.25;
                ctx.fillStyle = visuals.highlightBgColor || '#06B6D4';
                ctx.beginPath();
                ctx.roundRect(
                  lineX - pillPadX,
                  y - pillH / 2,
                  wordW + pillPadX * 2,
                  pillH,
                  pillRadius
                );
                ctx.fill();
              } else if (hStyle === 'pop') {
                const cx = lineX + wordW / 2;
                ctx.translate(cx, y);
                ctx.scale(1.15, 1.15);
                ctx.translate(-cx, -y);
              }

              ctx.fillStyle = item.token.color || visuals.activeWordColor || '#999999';
              ctx.fillText(item.token.word, lineX, y);

              if (hStyle === 'underline') {
                const lineH = Math.max(3, Math.round(captionFontSize * 0.09));
                const lineY = y + captionFontSize * 0.55;
                ctx.fillStyle = visuals.activeWordColor || '#06B6D4';
                ctx.beginPath();
                ctx.roundRect(lineX, lineY, wordW, lineH, lineH / 2);
                ctx.fill();
              }
            } else {
              ctx.fillStyle = item.token.color || visuals.inactiveWordColor || '#111111';
              ctx.fillText(item.token.word, lineX, y);
            }
            ctx.restore();
            lineX += item.width;
          });
        });
      }
      ctx.restore();
    }

    const clipDuration = Math.max(0.1, clipEnd - clipStart);
    const progress = Math.min(1.0, Math.max(0.0, (currentTime - clipStart) / clipDuration));
    const bottomY = height * 0.88;

    ctx.save();
    if (visuals.visualizerStyle === 'minimal_dot') {
      const barWidth = width * 0.22;
      const barHeight = Math.round(height * 0.016);
      const dotRadius = Math.round(barHeight * 1.35);

      ctx.fillStyle = visuals.visualizerColor || '#111111';
      ctx.beginPath();
      ctx.roundRect(padX, bottomY - barHeight / 2, barWidth, barHeight, barHeight / 2);
      ctx.fill();

      const dotX = padX + progress * barWidth;
      ctx.beginPath();
      ctx.arc(dotX, bottomY, dotRadius, 0, Math.PI * 2);
      ctx.fillStyle = visuals.visualizerColor || '#111111';
      ctx.fill();
    } else {
      const barCount = 20;
      const totalWidth = width * 0.32;
      const barWidth = (totalWidth / barCount) * 0.55;
      const maxBarHeight = height * 0.05;

      ctx.fillStyle = visuals.visualizerColor || '#111111';
      for (let i = 0; i < barCount; i++) {
        const x = padX + i * (totalWidth / barCount);
        const wave = Math.sin(currentTime * 8 + i * 0.7) * 0.5 + 0.5;
        const barH = Math.max(4, wave * maxBarHeight);
        ctx.beginPath();
        ctx.roundRect(x, bottomY - barH / 2, barWidth, barH, barWidth / 2);
        ctx.fill();
      }
    }
    ctx.restore();

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

      ctx.fillStyle = visuals.ctaBgColor || '#222222';
      ctx.beginPath();
      ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 12);
      ctx.fill();

      ctx.fillStyle = visuals.ctaTextColor || '#F5A623';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(visuals.ctaText, badgeX + badgeW / 2, badgeY + badgeH / 2);
      ctx.restore();
    }
  }, [visuals, currentTime, clipStart, clipEnd, segments, overlays, logoImage, mediaImages, width, height]);

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
