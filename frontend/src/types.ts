export interface WordToken {
  id: string;
  word: string;
  start: number;
  end: number;
  bold?: boolean;
  color?: string | null;
  type?: 'word' | 'image';
  imageUrl?: string;
  effect?: 'none' | 'wave';
  waveVariant?: number;
}

export interface CaptionSegment {
  id: string;
  start: number;
  end: number;
  text: string;
  words: WordToken[];
}

export interface OverlayAsset {
  id: string;
  url: string;
  start: number;
  end: number;
  x: number;
  y: number;
  scale: number;
}

export interface VisualSettings {
  aspectRatio: '1:1' | '9:16' | '16:9';
  backgroundType: 'solid' | 'gradient';
  backgroundColor: string;
  gradientSecondaryColor?: string;
  podcastTitle: string;
  podcastTitleColor: string;
  episodeTitle: string;
  episodeTitleColor: string;
  logoUrl: string | null;
  ctaText: string;
  ctaBgColor: string;
  ctaTextColor: string;
  visualizerStyle: 'minimal_dot' | 'waveform_bars';
  captionAnimation: 'karaoke' | 'hormozi';
  visualizerColor: string;
  fontFamily: string;
  fontSize: number;
  activeWordColor: string;
  inactiveWordColor: string;
  highlightStyle?: 'color' | 'pill' | 'pop' | 'underline';
  highlightBgColor?: string;
}

export interface ClipRange {
  start: number;
  end: number;
}

export interface ProjectDraft {
  id?: string;
  name: string;
  created_at?: string;
  updated_at?: string;
  audio_filename: string;
  audio_path: string;
  audio_duration: number;
  waveform_peaks: number[];
  clip_range: ClipRange;
  visuals: VisualSettings;
  caption_segments: CaptionSegment[];
  overlays?: OverlayAsset[];
}

export interface ProjectSummary {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
  audio_filename: string;
  audio_duration: number;
  clip_range: ClipRange;
  aspect_ratio: string;
  podcast_title: string;
  episode_title: string;
}
