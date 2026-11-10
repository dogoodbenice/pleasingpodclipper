import { OverlayAsset, WordToken } from './types';

export function isImageToken(token: WordToken): boolean {
  return token.type === 'image' && Boolean(token.imageUrl);
}

export function isRenderableToken(token: WordToken): boolean {
  if (isImageToken(token)) return true;
  return Boolean(token.word && token.word.trim());
}

export function visibleTokens(words: WordToken[]): WordToken[] {
  return words.filter(isRenderableToken);
}

export function segmentDisplayText(words: WordToken[]): string {
  return words
    .filter((w) => !isImageToken(w) && w.word.trim())
    .map((w) => w.word)
    .join(' ');
}

export function isWaveToken(token: WordToken): boolean {
  return !isImageToken(token) && token.effect === 'wave';
}

export interface GlyphLayout {
  char: string;
  x: number;
  y: number;
  angle: number;
  tokenIndex: number;
}

export interface ArcRunLayout {
  glyphs: GlyphLayout[];
  boxWidth: number;
  boxHeight: number;
  rise: number;
}

/** Place characters along a rainbow arc (center of circle below the baseline). */
export function layoutArcRun(
  chars: { char: string; width: number; tokenIndex: number }[],
  fontSize: number,
  originX: number,
  baselineY: number,
  variant: number = 0
): ArcRunLayout {
  const totalWidth = chars.reduce((sum, c) => sum + c.width, 0) || fontSize;
  const v = Math.abs(Math.floor(variant)) % 5;
  let walked = 0;
  let glyphs: GlyphLayout[] = [];
  let rise = 0;

  if (v === 0) {
    // 0: Rainbow Dome (arch upwards)
    const radius = Math.max(fontSize * 1.8, totalWidth / 1.6);
    const sweep = Math.min(Math.PI * 0.9, totalWidth / radius);
    rise = radius * (1 - Math.cos(sweep / 2));
    const cx = originX + totalWidth / 2;
    const cy = baselineY + radius - rise * 0.15;

    glyphs = chars.map((c) => {
      const t = totalWidth <= 0 ? 0.5 : (walked + c.width / 2) / totalWidth;
      walked += c.width;
      const theta = -sweep / 2 + t * sweep;
      return {
        char: c.char,
        x: cx + radius * Math.sin(theta),
        y: cy - radius * Math.cos(theta),
        angle: theta,
        tokenIndex: c.tokenIndex,
      };
    });
  } else if (v === 1) {
    // 1: Smile Bowl (curve downwards)
    const radius = Math.max(fontSize * 1.8, totalWidth / 1.6);
    const sweep = Math.min(Math.PI * 0.9, totalWidth / radius);
    rise = radius * (1 - Math.cos(sweep / 2));
    const cx = originX + totalWidth / 2;
    const cy = baselineY - radius + rise * 0.15;

    glyphs = chars.map((c) => {
      const t = totalWidth <= 0 ? 0.5 : (walked + c.width / 2) / totalWidth;
      walked += c.width;
      const theta = -sweep / 2 + t * sweep;
      return {
        char: c.char,
        x: cx + radius * Math.sin(theta),
        y: cy + radius * Math.cos(theta),
        angle: -theta,
        tokenIndex: c.tokenIndex,
      };
    });
  } else {
    // 2, 3, 4: S-Wave & Ripple Oscillations (Sine curves)
    const cycles = v === 4 ? 1.5 : 1.0;
    const sign = v === 3 ? -1 : 1;
    const amplitude = Math.min(fontSize * 0.5, totalWidth * 0.18);
    rise = amplitude * 2;

    glyphs = chars.map((c) => {
      const t = totalWidth <= 0 ? 0.5 : (walked + c.width / 2) / totalWidth;
      walked += c.width;
      const phase = t * Math.PI * 2 * cycles;
      const yOffset = sign * Math.sin(phase) * amplitude;
      const slope = sign * Math.cos(phase) * amplitude * ((Math.PI * 2 * cycles) / Math.max(1, totalWidth));
      const angle = Math.atan(slope) * 0.85;

      return {
        char: c.char,
        x: originX + (walked - c.width / 2),
        y: baselineY + yOffset,
        angle,
        tokenIndex: c.tokenIndex,
      };
    });
  }

  return {
    glyphs,
    boxWidth: totalWidth,
    boxHeight: fontSize + rise,
    rise,
  };
}

export function defaultOverlay(partial: { id: string; url: string; start: number; end: number }): OverlayAsset {
  return {
    ...partial,
    x: 0.5,
    y: 0.45,
    scale: 0.35,
  };
}
