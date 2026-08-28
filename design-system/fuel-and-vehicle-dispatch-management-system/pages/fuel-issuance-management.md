# Fuel issuance management pages

This page contract inherits every rule in `../MASTER.md`. It preserves the saved
tokens, Lexend and Source Sans 3 typography, application shell, density, and low-motion
direction.

## Information architecture

- Use `/fuel-issuances` for the list, `/fuel-issuances/new` for draft creation,
  `/fuel-issuances/:fuelIssuanceId` for detail, and `/fuel-issuances/balances` for balances.
- Keep search, status, fuel type, date range, cursor, and page size in native GET parameters.
- Use Server Components for authentication, authorization, reads, and result rendering.
- Use client leaves only for draft forms, posting, voiding, and filter interactions.
- Show one Fuel navigation link to users with `fuel.read`. Show create, post, and void
  controls only when the principal has that exact permission.

## List and filtering contract

- Lead with the title, short operational description, New fuel issuance action, and
  Balance summary link.
- Filter by RIS or purchase request text, lifecycle status, fuel type, and inclusive
  entry-date range. Keep Apply filters and Clear filters available at every width.
- Use a named horizontal scroll region with a sticky header from 640 pixels upward.
  Replace the table with complete definition-list cards below 640 pixels.
- Display RIS or `Pending`, entry date, purchase request, driver, plate number, fuel type,
  requested or full-tank mode, issued liters, total, and status.
- Show result count, loading, request error, denied, invalid-filter, empty, filtered-empty,
  populated, and cursor-end states explicitly.

## Draft form contract

Group the form into five visible sections followed by review actions:

1. Request details: purchase request number, entry date, and purpose.
2. Dispatch details: driver, destination, vehicle, and derived vehicle type.
3. Quantity: fuel type, standard or full-tank mode, requested liters, and optional actual liters.
4. Pricing: unit price and a clearly labeled provisional total when actual liters exist.
5. Budget: the operational allocation, PPMP number, office, fiscal year, and quarter.
6. Review actions: save draft, cancel, and contextual posting guidance.

- Default destination to AOR while keeping it editable in DRAFT.
- Hide and clear requested liters for full-tank drafts. Require requested liters for standard drafts.
- Keep decimal values as strings and use `inputMode="decimal"` without numeric coercion.
- When entry date changes, refresh eligible allocations and clear a now-invalid selection.
- Announce selector loading, empty results, validation errors, and submission outcomes.
- Preserve entered values after validation, conflict, or policy failures. Focus the first invalid field.

## Detail and lifecycle contract

- Put status and RIS at the top. Use `Pending RIS` for DRAFT and never reserve a number early.
- Group request, dispatch, quantity and pricing, budget, lifecycle, and ledger information.
- Use definition lists for record facts. Right-align quantities and monetary values with fixed precision.
- Allow edits only in DRAFT. Require explicit actual liters in the posting confirmation.
- Use an AlertDialog for posting. Explain that RIS, total, and ledger evidence become immutable.
- Use a destructive AlertDialog for voiding. Require a visible 10-to-500-character reason.
- Keep dialogs open on server errors. Move focus to the error summary or first invalid field.
- Disable repeated submission, announce pending work, and return focus when dialogs close.

## Ledger and balance contract

- Display the ledger as immutable evidence with effective date, type, reference, absolute quantity,
  signed quantity, and recorded time. Provide no edit or delete affordance.
- Distinguish issuance and adjustment with text labels and signed values, not color alone.
- The balance page uses inclusive start and end dates with an optional Diesel or Gasoline filter.
- Show one summary per fuel type when no type is selected. Present opening, receipts, adjustments,
  issuances, net movement, and closing in equation order.
- Show negative closing balances with a warning label. Do not block or hide them.
- Keep the balance page read-only and link each summary back to filtered issuance records where useful.

## Responsive and accessibility checks

- Preserve 44-pixel targets, visible labels, two-pixel focus rings, and logical DOM order.
- Verify 375, 768, 1024, and 1440 pixels without page-level horizontal overflow.
- Verify 200 percent browser zoom without hiding content or permitted actions.
- Preserve complete content and contrast in dark mode. Use semantic tokens instead of raw colors.
- Respect reduced motion. Use only short color or opacity feedback without layout movement.
- Keep one primary action per view. Separate destructive void controls from ordinary actions.
- Never use gradients, marketing imagery, OLED styling, Fira typography, or a second navigation shell.
