import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { NativeSelect } from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
import { ReferenceFilterForm } from '@/components/master-data/reference-filter-form';
import { ReferencePageHeader } from '@/components/master-data/reference-page-header';
import { ReferencePagination } from '@/components/master-data/reference-pagination';
import { ReferenceStatusBadge } from '@/components/master-data/reference-status-badge';
import { ResponsiveReferenceResults } from '@/components/master-data/responsive-reference-results';

describe('master-data component primitives', () => {
  it('renders native labeled form controls with touch-sized styles', () => {
    const select = renderToStaticMarkup(
      createElement(
        'label',
        { htmlFor: 'status' },
        'Status',
        createElement(
          NativeSelect,
          { id: 'status', defaultValue: 'ACTIVE' },
          createElement('option', { value: 'ACTIVE' }, 'Active'),
        ),
      ),
    );
    const textarea = renderToStaticMarkup(createElement(Textarea, { 'aria-label': 'Remarks' }));
    expect(select).toContain('min-h-11');
    expect(select).toContain('Status');
    expect(textarea).toContain('min-h-28');
  });

  it('renders semantic page headings and visible filter labels', () => {
    const html = renderToStaticMarkup(
      createElement(
        'main',
        null,
        createElement(ReferencePageHeader, {
          title: 'Offices',
          description: 'Maintain office reference records.',
        }),
        createElement(ReferenceFilterForm, {
          action: '/admin/offices',
          query: '',
          lifecycle: 'current',
          status: '',
          statuses: [
            { value: 'ACTIVE', label: 'Active' },
            { value: 'INACTIVE', label: 'Inactive' },
          ],
        }),
      ),
    );
    expect(html).toContain('<h1');
    expect(html).toContain('Operational status');
    expect(html).toContain('Record lifecycle');
  });

  it('renders status with text and an icon', () => {
    const html = renderToStaticMarkup(
      createElement(ReferenceStatusBadge, { label: 'Active', tone: 'positive' }),
    );
    expect(html).toContain('Active');
    expect(html).toContain('<svg');
  });

  it('renders unavailable pagination controls as non-links', () => {
    const html = renderToStaticMarkup(
      createElement(ReferencePagination, {
        previousHref: null,
        nextHref: '/admin/offices?cursor=x',
      }),
    );
    expect(html).toContain('aria-disabled="true"');
    expect(html.match(/<a /g)).toHaveLength(1);
  });

  it('provides named desktop and mobile result regions', () => {
    const html = renderToStaticMarkup(
      createElement(ResponsiveReferenceResults, {
        label: 'Office results',
        table: createElement('table', null),
        cards: createElement('article', null, 'Office card'),
      }),
    );
    expect(html.match(/aria-label="Office results"/g)).toHaveLength(2);
    expect(html).toContain('tabindex="0"');
  });
});
