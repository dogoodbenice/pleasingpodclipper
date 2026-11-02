export interface WordToken {
  id: string;
  word: string;
  start: number;
  end: number;
  bold?: boolean;
  color?: string | null;
}

export interface CaptionSegment {
  id: string;
  start: number;
  end: number;
  text: string;
  words: WordToken[];
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
  visualizerColor: string;
  captionAnimation: 'karaoke' | 'hormozi';
  fontFamily: string;
  fontSize: number;
  activeWordColor: string;
  inactiveWordColor: string;
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
