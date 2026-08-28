# Budget allocation management pages

This page contract inherits every rule in `../MASTER.md`. It does not change the saved
tokens, typography, application shell, density, or motion direction.

## Information architecture

- Use `/budget-allocations` for the top-level list and opaque public IDs for detail routes.
- Keep PPMP or office query, fiscal year, quarter, allocation status, record lifecycle,
  cursor, and page size in native GET parameters so every result view is deep-linkable.
- Use Server Components for authentication, authorization, reads, page-state decisions,
  and result rendering.
- Use client leaves only for create, draft update, status transition, deletion, and
  restoration interactions.
- Show the protected navigation link to users with `budget.read`. Render management
  controls only for users with `budget.manage`.

## Interaction contract

- Create a DRAFT allocation in an ordinary Radix Dialog. Navigate directly to its detail
  page after success and avoid an overlapping refresh request.
- Allow PPMP, office, fiscal year, and quarter edits only while an allocation is DRAFT.
- Confirm activation and closure. Require a visible reason field for cancellation and
  soft deletion, with the error associated directly with that field.
- Keep dialogs open after validation, conflict, or policy failures. Preserve entered
  values and focus the first invalid field.
- Disable repeated submission. Announce pending, success, and error states through live
  regions. Return focus to the invoking control when a dialog closes.
- Treat deletion as a record lifecycle action. Treat DRAFT, ACTIVE, CLOSED, and CANCELLED
  as allocation statuses with separate transition rules.

## Data display

- Display fields in this order: PPMP number, office, fiscal period, allocation status,
  fiscal eligibility, record lifecycle, updated time, and action.
- Show allocation status and fiscal eligibility as separate text-and-icon indicators.
  Never use color alone. Deleted lifecycle state takes visual precedence.
- Eligibility means the allocation is current, ACTIVE, in the effective fiscal period,
  and linked to a current ACTIVE office. It is not an amount or utilization measure.
- Use a named horizontal scroll region with a sticky header from 640 pixels upward.
  Replace the table with complete definition-list cards below 640 pixels.
- Keep every field and permitted detail action available in both table and card layouts.
- Show loading, request error, denied, invalid-filter, empty, filtered-empty, populated,
  deleted, terminal, and cursor-end states explicitly.

## Form field order

- PPMP number.
- Office, limited to current ACTIVE office options.
- Fiscal year, as a numeric input for values from 2000 through 9999.
- Quarter, with exactly Quarter 1 through Quarter 4.
- Reason, shown only for cancellation and soft deletion.

Do not render an allocation amount, budget ceiling, utilization percentage, or financial
summary. Those concepts are outside this feature contract.

## Responsive and accessibility checks

- Preserve 44-pixel targets, visible labels, two-pixel focus rings, and logical DOM order.
- Verify 375, 768, 1024, and 1440 pixels with no page-level horizontal overflow.
- Verify browser zoom at 200 percent without hiding content or permitted actions.
- Preserve complete content and contrast in dark mode.
- Respect reduced motion and avoid layout-shifting or scroll-triggered animation.
- Keep one primary action per page. Separate destructive actions and label them clearly.
