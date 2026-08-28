import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import type {
  DispatchDetailDto,
  DispatchPreparationOptionsDto,
} from '@/application/dispatch/dto/dispatch-dtos';
import { DispatchDetail } from '@/components/dispatches/dispatch-detail';
import {
  calculateDispatchDistance,
  DispatchDraftForm,
} from '@/components/dispatches/dispatch-draft-form';
import { DispatchFilterForm } from '@/components/dispatches/dispatch-filter-form';
import { DispatchResults } from '@/components/dispatches/dispatch-results';
import { DispatchStatusBadge } from '@/components/dispatches/dispatch-status-badge';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}));

const dispatch: DispatchDetailDto = {
  publicId: '01900000-0000-7000-8000-000000000701',
  entryDate: '2026-08-28',
  travelDate: '2026-08-29',
  driver: { publicId: '01900000-0000-7000-8000-000000000702', name: 'Juan Dela Cruz' },
  vehicle: {
    publicId: '01900000-0000-7000-8000-000000000703',
    plateNumber: 'ABC-123',
    modelBrand: 'Toyota Hiace',
    vehicleType: 'Passenger Van',
  },
  requestingOffice: {
    publicId: '01900000-0000-7000-8000-000000000704',
    name: 'Provincial Services Office',
    abbreviation: 'PSO',
  },
  destination: 'District Hospital',
  purpose: 'Transfer medical supplies',
  odoBefore: '1250.4',
  odoAfter: null,
  distance: null,
  passengerCount: 2,
  status: 'DRAFT',
  createdByActorPublicId: '01900000-0000-7000-8000-000000000705',
  dispatchedAt: null,
  completedAt: null,
  cancelledAt: null,
  cancelledByActorPublicId: null,
  cancellationReason: null,
  createdAt: '2026-08-28T00:00:00.000Z',
  updatedAt: '2026-08-28T00:00:00.000Z',
};
const options: DispatchPreparationOptionsDto = {
  offices: [dispatch.requestingOffice],
  drivers: [dispatch.driver],
  vehicles: [
    {
      ...dispatch.vehicle,
      label: 'ABC-123 · Toyota Hiace · Passenger Van',
    },
  ],
};

describe('dispatch interface components', () => {
  it('labels every lifecycle state with text and a distinct icon', () => {
    for (const [status, label] of [
      ['DRAFT', 'Draft'],
      ['DISPATCHED', 'Dispatched'],
      ['COMPLETED', 'Completed'],
      ['CANCELLED', 'Cancelled'],
    ] as const) {
      const html = renderToStaticMarkup(createElement(DispatchStatusBadge, { status }));
      expect(html).toContain(label);
      expect(html).toContain('aria-hidden="true"');
    }
  });

  it('renders native GET filters with every selected value', () => {
    const html = renderToStaticMarkup(
      createElement(DispatchFilterForm, {
        values: {
          query: 'hospital',
          status: 'DISPATCHED',
          requestingOfficePublicId: dispatch.requestingOffice.publicId,
          travelDateFrom: '2026-08-01',
          travelDateTo: '2026-08-31',
        },
        offices: options.offices,
      }),
    );
    for (const label of [
      'Search dispatches',
      'Status',
      'Requesting office',
      'Travel date from',
      'Travel date to',
    ]) {
      expect(html).toContain(`>${label}</label>`);
    }
    expect(html).toContain('method="get"');
    expect(html).toContain('<option value="DISPATCHED" selected="">Dispatched</option>');
    expect(html).toContain('value="hospital"');
    expect(html).toContain('placeholder="Destination, purpose, driver, vehicle, or office"');
  });

  it('renders complete desktop and mobile result content', () => {
    const html = renderToStaticMarkup(createElement(DispatchResults, { items: [dispatch] }));
    for (const value of [
      'District Hospital',
      'Juan Dela Cruz',
      'ABC-123',
      'Provincial Services Office',
      '2 passengers',
      '1,250.4 km',
      'Draft',
    ]) {
      expect(html.match(new RegExp(value.replace('.', '\\.').replace(',', ','), 'g'))).toHaveLength(
        2,
      );
    }
    expect(html).toContain('aria-label="Vehicle dispatch results"');
    expect(html).toContain('lg:block');
    expect(html).toContain('lg:hidden');
  });

  it('renders five labeled form sections and exact numeric input modes', () => {
    const html = renderToStaticMarkup(
      createElement(DispatchDraftForm, { csrfToken: 'csrf-token', options }),
    );
    for (const title of [
      'Dispatch information',
      'Vehicle and driver',
      'Travel details',
      'Odometer and passengers',
      'Review',
    ]) {
      expect(html).toContain(title);
    }
    expect(html).toContain('inputMode="decimal"');
    expect(html).toContain('inputMode="numeric"');
    expect(html).toContain('aria-describedby="dispatch-odo-before-error"');
  });

  it('calculates exact one-decimal distance without floating-point conversion', () => {
    expect(calculateDispatchDistance('1250.4', '1260.5')).toBe('10.1 km');
    expect(calculateDispatchDistance('90071992547.1', '90071992547.2')).toBe('0.1 km');
    expect(calculateDispatchDistance('1250.4', '1250.3')).toBeNull();
    expect(calculateDispatchDistance('1250.4', 'not-a-number')).toBeNull();
  });

  it('shows only actions allowed by the lifecycle and exact permissions', () => {
    const draft = renderToStaticMarkup(
      createElement(DispatchDetail, {
        dispatch,
        canUpdate: true,
        canComplete: true,
        canCancel: true,
      }),
    );
    const active = renderToStaticMarkup(
      createElement(DispatchDetail, {
        dispatch: { ...dispatch, status: 'DISPATCHED', dispatchedAt: dispatch.updatedAt },
        canUpdate: true,
        canComplete: true,
        canCancel: true,
      }),
    );
    const terminal = renderToStaticMarkup(
      createElement(DispatchDetail, {
        dispatch: {
          ...dispatch,
          status: 'COMPLETED',
          dispatchedAt: dispatch.updatedAt,
          completedAt: dispatch.updatedAt,
          odoAfter: '1260.5',
          distance: '10.1',
        },
        canUpdate: true,
        canComplete: true,
        canCancel: true,
      }),
    );
    expect(draft).toContain('Edit draft');
    expect(draft).toContain('Schedule conflict acknowledgments');
    expect(draft).toContain('No conflict acknowledgments');
    expect(draft).toContain('Dispatch vehicle');
    expect(draft).toContain('Cancel dispatch');
    expect(draft).not.toContain('Complete dispatch');
    expect(active).toContain('Complete dispatch');
    expect(active).toContain('Cancel dispatch');
    expect(active).not.toContain('Edit draft');
    expect(terminal).toContain('10.1 km');
    expect(terminal).not.toContain('Dispatch vehicle');
    expect(terminal).not.toContain('Complete dispatch');
    expect(terminal).not.toContain('Cancel dispatch');
  });
});
