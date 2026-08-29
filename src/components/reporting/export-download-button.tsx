'use client';

import { Download } from 'lucide-react';
import { useState } from 'react';

import type { IssuedExportDownloadLink } from '@/application/reporting/dto/export-job-dtos';
import { Button } from '@/components/ui/button';
import { readApiResponse } from '@/components/forms/auth-form-utils';

export function ExportDownloadButton({
  exportJobPublicId,
  csrfToken,
}: {
  readonly exportJobPublicId: string;
  readonly csrfToken: string;
}) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');

  async function download(): Promise<void> {
    setPending(true);
    setMessage('');
    try {
      const response = await fetch(`/api/report-exports/${exportJobPublicId}/download-link`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-csrf-token': csrfToken },
        body: '{}',
      });
      const link = await readApiResponse<IssuedExportDownloadLink>(response);
      window.location.assign(link.url);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'The download could not be started.');
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <Button type="button" variant="outline" onClick={download} disabled={pending}>
        <Download aria-hidden="true" /> {pending ? 'Preparing…' : 'Download'}
      </Button>
      <span className="sr-only" aria-live="polite">
        {message}
      </span>
    </div>
  );
}
