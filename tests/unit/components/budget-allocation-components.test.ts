import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import type { BudgetAllocationAdminDto } from '@/application/budget/dto/budget-allocation-dtos';
import {
  BudgetAllocationEditForm,
  QUARTER_OPTIONS,
} from '@/components/budget-allocations/budget-allocation-form';
import { BudgetAllocationFilterForm } from '@/components/budget-allocations/budget-allocation-filter-form';
import { BudgetAllocationResults } from '@/components/budget-allocations/budget-allocation-results';
import { BudgetAllocationStatusBadge } from '@/components/budget-allocations/budget-allocation-status-badge';
import { BudgetAllocationDetailActions } from '@/components/budget-allocations/budget-allocation-transition-dialog';
import { ReferencePagination } from '@/components/master-data/reference-pagination';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

const allocation: BudgetAllocationAdminDto = {
  publicId: '019d3aa8-74a1-7000-8000-000000000001',
  ppmpNumber: 'PPMP-001',
  office: {
    publicId: '019d3aa8-74a1-7000-8000-000000000002',
    name: 'General Services Office',
    abbreviation: 'GSO',
  },
  quarter: 3,
  fiscalYear: 2026,
  status: 'DRAFT',
  operationalState: false,
  eligible: false,
  createdAt: '2026-08-28T01:02:03.004Z',
  updatedAt: '2026-08-28T02:03:04.005Z',
  deletedAt: null,
  deletedByActorPublicId: null,
  deleteReason: null,
};

const offices = [allocation.office];

describe('budget allocation interface components', () => {
  it('renders visible native GET filters and preserves every selected value', () => {
    const html = renderToStaticMarkup(
      createElement(BudgetAllocationFilterForm, {
        values: {
          query: 'GSO',
          fiscalYear: '2026',
          quarter: '3',
          status: 'ACTIVE',
          lifecycle: 'deleted',
        },
      }),
    );

    for (const label of [
      'PPMP or office',
      'Fiscal year',
      'Quarter',
      'Allocation status',
      'Record lifecycle',
    ]) {
      expect(html).toContain(`>${label}</label>`);
    }
    expect(html).toContain('method="get"');
    expect(html).toContain('value="GSO"');
    expect(html).toContain('<option value="3" selected="">Quarter 3</option>');
    expect(html).toContain('<option value="ACTIVE" selected="">Active</option>');
    expect(html).toContain('<option value="deleted" selected="">Deleted records</option>');
  });

  it('renders exactly four quarter choices and labeled draft fields', () => {
    const html = renderToStaticMarkup(
      createElement(BudgetAllocationEditForm, {
        allocation,
        offices,
        csrfToken: 'csrf-token',
      }),
    );

    expect(QUARTER_OPTIONS).toEqual([
      { value: 1, label: 'Quarter 1' },
      { value: 2, label: 'Quarter 2' },
      { value: 3, label: 'Quarter 3' },
      { value: 4, label: 'Quarter 4' },
    ]);
    for (const label of ['PPMP number', 'Office', 'Fiscal year', 'Quarter']) {
      expect(html).toContain(`>${label}</label>`);
    }
    expect(html).toContain('inputMode="numeric"');
    expect(html).toContain('aria-describedby="budget-ppmp-help"');
  });

  it('keeps filter and editor control IDs unique when both render on one page', () => {
    const html = renderToStaticMarkup(
      createElement(
        'main',
        null,
        createElement(BudgetAllocationFilterForm, {
          values: { query: '', fiscalYear: '', quarter: '', status: '', lifecycle: 'current' },
        }),
        createElement(BudgetAllocationEditForm, {
          allocation,
          offices,
          csrfToken: 'csrf-token',
        }),
      ),
    );
    const ids = [...html.matchAll(/ id="([^"]+)"/g)].map((match) => match[1]);

    expect(new Set(ids).size).toBe(ids.length);
  });

  it('pairs status and eligibility with explicit text and icons', () => {
    const active = renderToStaticMarkup(
      createElement(BudgetAllocationStatusBadge, {
        status: 'ACTIVE',
        deleted: false,
        eligible: true,
      }),
    );
    const deleted = renderToStaticMarkup(
      createElement(BudgetAllocationStatusBadge, {
        status: 'ACTIVE',
        deleted: true,
        eligible: false,
      }),
    );

    expect(active).toContain('Active');
    expect(active).toContain('Eligible now');
    expect(active.match(/<svg/g)).toHaveLength(2);
    expect(deleted).toContain('Deleted');
    expect(deleted).not.toContain('Eligible now');
  });

  it('renders every important field and an appropriate action in desktop and mobile results', () => {
    const html = renderToStaticMarkup(
      createElement(BudgetAllocationResults, { items: [allocation], canManage: false }),
    );

    for (const value of [
      'PPMP-001',
      'General Services Office',
      'FY 2026 · Quarter 3',
      'Draft',
      'Not eligible now',
      'Current',
    ]) {
      expect(html.match(new RegExp(value, 'g'))).toHaveLength(2);
    }
    expect(html.match(/View allocation/g)).toHaveLength(2);
    expect(html).not.toContain('Manage allocation');
    expect(html).toContain('aria-label="Budget allocation results"');
  });

  it('renders cursor ends as non-links', () => {
    const html = renderToStaticMarkup(
      createElement(ReferencePagination, {
        previousHref: null,
        nextHref: '/budget-allocations?cursor=next',
      }),
    );

    expect(html).toContain('aria-disabled="true"');
    expect(html.match(/<a /g)).toHaveLength(1);
  });

  it('offers only valid lifecycle actions and requests reasons for destructive actions', () => {
    const draft = renderToStaticMarkup(
      createElement(BudgetAllocationDetailActions, {
        allocation,
        csrfToken: 'csrf-token',
      }),
    );
    const terminal = renderToStaticMarkup(
      createElement(BudgetAllocationDetailActions, {
        allocation: { ...allocation, status: 'CLOSED' },
        csrfToken: 'csrf-token',
      }),
    );

    expect(draft).toContain('Activate allocation');
    expect(draft).toContain('Cancel allocation');
    expect(draft).toContain('Delete allocation');
    expect(draft).not.toContain('Close allocation');
    expect(terminal).toContain('Delete allocation');
    expect(terminal).not.toContain('Activate allocation');
    expect(terminal).not.toContain('Cancel allocation');
  });
});
