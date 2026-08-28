# Master-data management pages

This page contract inherits every rule in `../MASTER.md`. It overrides no color, typography,
spacing, focus, motion, or responsive token.

## Information architecture

- Expose three direct manage-only navigation links: Offices, Drivers, and Vehicles.
- Keep list state in native GET parameters so filtered views and cursor pages remain deep-linkable.
- Use Server Components for authorization, reads, page-state decisions, and result rendering.
- Use client leaves only for create, update, status, deletion, and restoration interactions.

## Interaction contract

- Create records in an ordinary Radix Dialog. Return focus to its trigger when it closes.
- Edit details and status on opaque public-ID detail pages with a predictable back link.
- Confirm status changes before submission. Require a written reason only for soft deletion.
- Keep dialogs open after validation or conflict failures. Focus the first invalid field.
- Disable repeated submission and expose pending and error messages through live regions.

## Data display

- Use a named horizontal scroll region with a sticky header from 640 pixels upward.
- Replace tables with complete definition-list cards below 640 pixels.
- Keep every important field, lifecycle state, and detail action available in both layouts.
- Show status through text and a Lucide icon. Deleted lifecycle state visually takes precedence.
- Render loading, request error, denied, empty, filtered-empty, and cursor-end states explicitly.

## Field order

- Office: name, abbreviation, operational status, lifecycle, updated time, action.
- Driver: name, contact number, operational status, lifecycle, updated time, action.
- Vehicle: plate number, model or brand, type, serviceability, lifecycle, updated time, action.
- Vehicle remarks appear on detail pages and remain associated with their Textarea control.

## Responsive and accessibility checks

- Preserve 44-pixel targets, visible labels, two-pixel focus rings, and logical DOM order.
- Verify 375, 768, 1024, and 1440 pixels, 200-percent zoom, and no page-level overflow.
- Preserve complete content in dark mode and when reduced motion is requested.
- Use one primary action per page. Keep destructive actions separated and explicitly labeled.
