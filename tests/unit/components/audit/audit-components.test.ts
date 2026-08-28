import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { AuditEventTable } from '@/components/audit/audit-event-table';
import { AuditFilterForm } from '@/components/audit/audit-filter-form';
import { AuditVerificationStatus } from '@/components/audit/audit-verification-status';

describe('audit interface components', () => {
  it('renders every audit summary field in desktop and mobile results', () => {
    const html = renderToStaticMarkup(
      createElement(AuditEventTable, {
        items: [
          {
            publicId: '019d3aa8-74a1-7000-8000-000000000001',
            sequence: '42',
            occurredAt: '2026-08-28T01:02:03.004Z',
            actorPublicId: null,
            action: 'auth.login.failed',
            entity: {
              type: 'user',
              publicId: '019d3aa8-74a1-7000-8000-000000000002',
            },
            requestId: '019d3aa8-74a1-7000-8000-000000000003',
          },
        ],
      }),
    );

    expect(html.match(/auth\.login\.failed/g)).toHaveLength(2);
    expect(html.match(/System/g)).toHaveLength(2);
    expect(html.match(/019d3aa8-74a1-7000-8000-000000000002/g)).toHaveLength(2);
    expect(html.match(/019d3aa8-74a1-7000-8000-000000000003/g)).toHaveLength(2);
    expect(html.match(/>42</g)).toHaveLength(2);
    expect(html).toContain('aria-label="Audit trail results"');
  });

  it('renders visible labels for every supported filter', () => {
    const html = renderToStaticMarkup(
      createElement(AuditFilterForm, {
        values: {
          action: 'auth.login.failed',
          actorPublicId: '',
          entityPublicId: '',
          entityType: '',
          from: '',
          requestId: '',
          to: '',
        },
      }),
    );

    for (const label of [
      'From',
      'To',
      'Action',
      'Entity type',
      'Entity public ID',
      'Actor public ID',
      'Request ID',
    ]) {
      expect(html).toContain(`>${label}</label>`);
    }
    expect(html).toContain('method="get"');
    expect(html).toContain('Clear filters');
  });

  it('pairs verification outcomes with text, icons, and context without controls', () => {
    const pass = renderToStaticMarkup(
      createElement(AuditVerificationStatus, {
        verification: {
          publicId: '019d3aa8-74a1-7000-8000-000000000004',
          status: 'PASS',
          highWaterSequence: '42',
          verifiedCount: '42',
          firstMismatchSequence: null,
          firstMismatchType: null,
          summary: 'Verified 42 records.',
          startedAt: '2026-08-28T01:02:03.004Z',
          completedAt: '2026-08-28T01:02:04.004Z',
        },
      }),
    );
    const unavailable = renderToStaticMarkup(
      createElement(AuditVerificationStatus, { verification: null }),
    );

    expect(pass).toContain('Passed');
    expect(pass).toContain('Verified through sequence 42');
    expect(pass).not.toContain('<button');
    expect(unavailable).toContain('Unavailable');
    expect(unavailable).toContain('No completed verification result is available yet.');
  });
});
