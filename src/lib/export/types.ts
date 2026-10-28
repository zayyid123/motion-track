export type ExportFormat = 'gif' | 'mp4' | 'mov';

export interface ExportSettings {
  format: ExportFormat;
  width: number;
  height: number;
  fps: number;
  /** null = transparent (MOV) or white (MP4/GIF where alpha is unavailable). */
  background: string | null;
}

export type ExportStage = 'rendering' | 'encoding' | 'ready';

export interface ExportProgress {
  stage: ExportStage;
  progress: number;
  detail?: string;
}

export type ProgressFn = (progress: ExportProgress) => void;

export interface ExportResult {
  url: string;
  filename: string;
  mimeType: string;
  extension: string;
  note?: string;
}

export class ExportCancelledError extends Error {
  constructor() {
    super('Export cancelled.');
    this.name = 'ExportCancelledError';
  }
}

export function assertNotCancelled(signal?: AbortSignal): void {
  if (signal?.aborted) throw new ExportCancelledError();
}
