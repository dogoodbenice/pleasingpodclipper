import { ProjectDraft, ProjectSummary, CaptionSegment } from './types';

const API_BASE = '';

export async function uploadAudio(file: File): Promise<{
  url: string;
  file_path: string;
  filename: string;
  duration: number;
  sample_rate: number;
  channels: number;
  waveform_peaks: number[];
}> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('file_type', 'audio');

  const res = await fetch(`${API_BASE}/api/upload`, {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Upload failed' }));
    throw new Error(err.detail || 'Audio upload failed');
  }

  return res.json();
}

export async function uploadImage(file: File): Promise<{
  url: string;
  file_path: string;
  filename: string;
}> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('file_type', 'image');

  const res = await fetch(`${API_BASE}/api/upload`, {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Image upload failed' }));
    throw new Error(err.detail || 'Image upload failed');
  }

  return res.json();
}

export async function transcribeRange(
  audioPath: string,
  start: number,
  end: number,
  modelSize: string = 'base.en'
): Promise<{
  status: string;
  start: number;
  end: number;
  duration: number;
  segments: CaptionSegment[];
}> {
  const res = await fetch(`${API_BASE}/api/transcribe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      audio_path: audioPath,
      start,
      end,
      model_size: modelSize,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Transcription failed' }));
    throw new Error(err.detail || 'Transcription request failed');
  }

  return res.json();
}

export async function getProjects(): Promise<ProjectSummary[]> {
  const res = await fetch(`${API_BASE}/api/projects`);
  if (!res.ok) throw new Error('Failed to load projects');
  return res.json();
}

export async function getProject(id: string): Promise<ProjectDraft> {
  const res = await fetch(`${API_BASE}/api/projects/${id}`);
  if (!res.ok) throw new Error('Failed to load project');
  return res.json();
}

export async function saveProject(project: ProjectDraft): Promise<ProjectDraft> {
  const res = await fetch(`${API_BASE}/api/projects`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(project),
  });
  if (!res.ok) throw new Error('Failed to save project');
  return res.json();
}

export async function deleteProject(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/projects/${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Failed to delete project');
}

export async function duplicateProject(id: string): Promise<ProjectDraft> {
  const res = await fetch(`${API_BASE}/api/projects/${id}/duplicate`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error('Failed to duplicate project');
  return res.json();
}

export interface RenderJob {
  job_id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  filename: string;
  download_url: string | null;
  error?: string | null;
}

export async function startRender(project: ProjectDraft): Promise<RenderJob> {
  const res = await fetch(`${API_BASE}/api/render`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(project),
  });
  if (!res.ok) throw new Error('Failed to start video render');
  return res.json();
}

export async function getRenderStatus(jobId: string): Promise<RenderJob> {
  const res = await fetch(`${API_BASE}/api/render/${jobId}`);
  if (!res.ok) throw new Error('Failed to fetch render status');
  return res.json();
}

