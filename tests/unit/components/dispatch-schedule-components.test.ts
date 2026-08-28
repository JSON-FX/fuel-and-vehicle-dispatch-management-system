import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import type { DispatchScheduleEventDto } from '@/application/dispatch/dto/dispatch-dtos';
import { DispatchScheduleSettingsForm } from '@/components/admin/dispatch-schedule-settings-form';
import { DispatchAvailabilityGuidance } from '@/components/dispatches/dispatch-availability-guidance';
import { DispatchCalendar } from '@/components/dispatches/dispatch-calendar';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

const event: DispatchScheduleEventDto = {
  dispatchPublicId: '01900000-0000-7000-8000-000000000701',
  travelDate: '2026-08-29',
  status: 'DRAFT',
  destination: 'District Hospital',
  purpose: 'Official travel',
  driver: {
    publicId: '01900000-0000-7000-8000-000000000702',
    name: 'Juan Dela Cruz',
  },
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
};

describe('dispatch schedule components', () => {
  it('renders responsive week columns and an equivalent mobile agenda', () => {
    const html = renderToStaticMarkup(
      createElement(DispatchCalendar, {
        view: 'week',
        from: '2026-08-24',
        to: '2026-08-30',
        events: [event],
        occupancy: [],
        resourceSelected: false,
      }),
    );
    expect(html).toContain('aria-label="Weekly dispatch schedule"');
    expect(html).toContain('md:hidden');
    expect(html.match(/District Hospital/g)).toHaveLength(2);
    expect(html).not.toContain('Available');
  });

  it('shows waiting guidance until a complete candidate is selected', () => {
    const html = renderToStaticMarkup(
      createElement(DispatchAvailabilityGuidance, {
        travelDate: '',
        driverPublicId: '',
        vehiclePublicId: '',
      }),
    );
    expect(html).toContain('role="status"');
    expect(html).toContain('Select a travel date, driver, and vehicle');
  });

  it('shows the global policy and requires explicit BLOCK confirmation', () => {
    const html = renderToStaticMarkup(
      createElement(DispatchScheduleSettingsForm, {
        csrfToken: 'csrf-token',
        settings: {
          policy: 'WARN_AND_ACK',
          updatedByActorPublicId: null,
          updatedAt: '2026-08-29T00:00:00.000Z',
        },
      }),
    );
    expect(html).toContain('Global schedule policy');
    expect(html).toContain('Block conflicting dispatches');
    expect(html).toContain('Warn and require acknowledgment');
  });
});
