import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, switchMap } from 'rxjs';
import { API_BASE_URL } from './api.config';

export interface Recording {
  id: string;
  call: string;
  lead: string;
  mimeType: string;
  sizeBytes: number;
  durationSec?: number;
  uploadStatus: 'pending' | 'uploaded' | 'failed';
  processingStatus: string;
  createdAt: string;
}

interface UploadUrlResponse {
  recording: Recording;
  upload: { method: 'PUT'; url: string; headers: Record<string, string>; expiresInSeconds: number };
}

export const MAX_RECORDING_MB = 50;
export const ALLOWED_AUDIO = [
  'audio/mpeg', 'audio/mp4', 'audio/x-m4a', 'audio/aac', 'audio/wav', 'audio/x-wav',
  'audio/ogg', 'audio/webm', 'audio/3gpp', 'audio/amr',
];

@Injectable({ providedIn: 'root' })
export class RecordingService {
  private readonly http = inject(HttpClient);
  private readonly base = `${inject(API_BASE_URL)}/recordings`;

  list(callId: string): Observable<{ items: Recording[] }> {
    return this.http.get<{ items: Recording[] }>(this.base, { params: { callId } });
  }

  /**
   * Uploads a recording in three steps:
   * 1. The server checks the call, consent and file, and returns a signed upload link.
   * 2. The file is sent straight to Backblaze with that link. The API token is not sent.
   * 3. The server confirms the upload arrived intact.
   */
  upload(params: { callId: string; file: File; consentConfirmed: boolean; durationSec?: number }): Observable<Recording> {
    return this.http
      .post<UploadUrlResponse>(`${this.base}/upload-url`, {
        callId: params.callId,
        mimeType: params.file.type,
        sizeBytes: params.file.size,
        originalName: params.file.name,
        consentConfirmed: params.consentConfirmed,
        durationSec: params.durationSec,
      })
      .pipe(
        switchMap(async (res) => {
          const put = await fetch(res.upload.url, {
            method: 'PUT',
            headers: { 'Content-Type': params.file.type },
            body: params.file,
          });
          if (!put.ok) {
            throw new Error(`Upload to storage failed (HTTP ${put.status}). Please try again.`);
          }
          return res.recording.id;
        }),
        switchMap((recordingId) => this.http.post<Recording>(`${this.base}/${recordingId}/complete`, {}))
      );
  }

  download(id: string): Observable<{ url: string }> {
    return this.http.get<{ url: string }>(`${this.base}/${id}/download`);
  }
}

