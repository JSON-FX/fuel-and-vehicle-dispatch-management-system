import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import type { FuelIssuanceDto } from '@/application/fuel/dto/fuel-dtos';
import { FuelBalanceSummary } from '@/components/fuel-issuances/fuel-balance-summary';
import { FuelIssuanceResults } from '@/components/fuel-issuances/fuel-issuance-results';
import { FuelIssuanceStatusBadge } from '@/components/fuel-issuances/fuel-issuance-status-badge';

const issuance: FuelIssuanceDto = {
  publicId: '01900000-0000-7000-8000-000000000701',
  risNumber: null,
  purchaseRequestNumber: 'PR-2026-001',
  entryDate: '2026-08-28',
  driver: { publicId: '01900000-0000-7000-8000-000000000702', name: 'Juan Dela Cruz' },
  destination: 'AOR',
  purpose: 'Provincial operations',
  vehicle: {
    publicId: '01900000-0000-7000-8000-000000000703',
    plateNumber: 'ABC-123',
    modelBrand: 'Toyota Hiace',
    vehicleType: 'Passenger Van',
  },
  requestedLiters: '30',
  isFullTank: false,
  issuedLiters: null,
  unitPrice: '61.25',
  totalAmount: null,
  allocation: {
    publicId: '01900000-0000-7000-8000-000000000704',
    ppmpNumber: 'PPMP-2026-01',
    office: {
      publicId: '01900000-0000-7000-8000-000000000705',
      name: 'Provincial Services Office',
      abbreviation: 'PSO',
    },
    quarter: 3,
    fiscalYear: 2026,
  },
  fuelType: 'DIESEL',
  status: 'DRAFT',
  createdByActorPublicId: '01900000-0000-7000-8000-000000000706',
  postedAt: null,
  voidedAt: null,
  voidedByActorPublicId: null,
  voidReason: null,
  createdAt: '2026-08-28T00:00:00.000Z',
  updatedAt: '2026-08-28T00:00:00.000Z',
};

describe('fuel issuance components', () => {
  it('labels lifecycle states with text and an icon', () => {
    const html = renderToStaticMarkup(createElement(FuelIssuanceStatusBadge, { status: 'VOIDED' }));
    expect(html).toContain('Voided');
    expect(html).toContain('aria-hidden="true"');
  });

  it('renders complete desktop and mobile result content', () => {
    const html = renderToStaticMarkup(createElement(FuelIssuanceResults, { items: [issuance] }));
    expect(html).toContain('Fuel issuance results');
    expect(html).toContain('Pending RIS');
    expect(html).toContain('Juan Dela Cruz');
    expect(html).toContain('Passenger Van');
  });

  it('shows a text warning when the closing balance is negative', () => {
    const html = renderToStaticMarkup(
      createElement(FuelBalanceSummary, {
        balances: [
          {
            fuelType: 'DIESEL',
            startDate: '2026-08-01',
            endDate: '2026-08-31',
            opening: '0.000',
            receipts: '0.000',
            adjustments: '0.000',
            issuances: '30.000',
            netMovement: '-30.000',
            closing: '-30.000',
          },
        ],
      }),
    );
    expect(html).toContain('Negative closing balance requires review.');
    expect(html).toContain('-30.000 L');
  });
});
