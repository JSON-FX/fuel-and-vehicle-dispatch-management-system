import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import {
  NavigationPanel,
  type ProtectedNavigationAccess,
} from '@/components/navigation/protected-navigation';

const fullAccess: ProtectedNavigationAccess = {
  audit: true,
  budget: true,
  dispatch: true,
  drivers: true,
  fuel: true,
  offices: true,
  roles: true,
  security: true,
  users: true,
  vehicles: true,
};

describe('protected navigation', () => {
  it('groups permitted destinations and marks a nested route as current', () => {
    const html = renderToStaticMarkup(
      createElement(NavigationPanel, {
        access: fullAccess,
        pathname: '/admin/drivers/01900000-0000-7000-8000-000000000001',
      }),
    );

    expect(html).toContain('Operations');
    expect(html).toContain('Vehicle dispatches');
    expect(html).toContain('Master data');
    expect(html).toContain('Administration');
    expect(html).toContain('Oversight');
    expect(html).toMatch(/<a(?=[^>]*href="\/admin\/drivers")(?=[^>]*aria-current="page")[^>]*>/);
    expect(html).toMatch(/<details[^>]*open=""[^>]*>[\s\S]*?Master data/);
  });

  it('omits empty groups and destinations that the principal cannot access', () => {
    const html = renderToStaticMarkup(
      createElement(NavigationPanel, {
        access: {
          ...fullAccess,
          audit: false,
          budget: false,
          dispatch: false,
          drivers: false,
          offices: false,
          vehicles: false,
        },
        pathname: '/fuel-issuances',
      }),
    );

    expect(html).toContain('Fuel issuances');
    expect(html).toContain('Account');
    expect(html).not.toContain('Budget allocations');
    expect(html).not.toContain('Offices');
    expect(html).not.toContain('Drivers');
    expect(html).not.toContain('Master data');
    expect(html).not.toContain('Oversight');
  });

  it('keeps permitted destinations directly available in the collapsed rail', () => {
    const html = renderToStaticMarkup(
      createElement(NavigationPanel, {
        access: fullAccess,
        collapsed: true,
        pathname: '/admin/drivers',
      }),
    );

    expect(html).not.toContain('<details');
    expect(html).toMatch(/<a(?=[^>]*href="\/admin\/drivers")(?=[^>]*title="Drivers")[^>]*>/);
    expect(html).toMatch(/<a(?=[^>]*href="\/admin\/drivers")(?=[^>]*aria-current="page")[^>]*>/);
    expect(html).toContain('Master data');
    expect(html).toContain('Administration');
  });
});
