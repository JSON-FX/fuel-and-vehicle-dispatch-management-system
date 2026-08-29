# Operational reporting dashboard

This page contract inherits every rule in `../MASTER.md`. It preserves the saved tokens,
Lexend and Source Sans 3 typography, collapsible sidebar, dense government-console direction,
dark mode, and low-motion behavior.

## Information architecture

- Use `/reports` as the single reporting destination under the Oversight sidebar group.
- Keep report type, office, period, reference date, custom dates, detail status, cursor, and page
  size in native GET parameters so every result view is deep-linkable.
- Keep the page, report reads, authorization, filter normalization, and result rendering in Server
  Components. Use client leaves only for export submission, bounded job polling, and download-link
  issuance.
- Default to an Overview that renders only report families allowed by `fuel.read` or
  `dispatch.read`. Never fetch restricted data and hide it afterward.
- Keep one primary Export action in the page header. Render it only when the selected report's
  read and export permissions are both present.

## Page hierarchy

1. Page title, concise operational description, and permitted Export action.
2. Filter card with visible labels and aligned 44-pixel controls.
3. Resolved-period banner with inclusive dates, office, generation time, and data-as-of time.
4. Overview cards or one selected report's responsive results.
5. Cursor pagination and any bounded-result notice.
6. Recent exports with current job state and permitted download actions.

Do not add marketing metrics, decorative charts, gradients, oversized hero copy, or raw color
classes. Summary cards provide scannable totals, while semantic tables remain the complete source.

## Filter contract

- Label controls `Report`, `Office`, `Period`, `Reference date`, `Start date`, `End date`, and
  `Status` where applicable. Never use placeholder-only labels.
- Show Reference date for weekly, monthly, quarterly, and annual periods. Show Start date and End
  date only for Custom.
- Show Status only for fuel issuance detail or dispatch detail.
- Keep Apply filters and Clear filters available at every width.
- Stack controls in one column by default, use two columns from 640 pixels, and use a compact
  multi-column row where space permits from 1024 pixels.
- Align control top edges and heights at desktop widths. Allow labels and helper text to wrap
  without moving the controls out of alignment.
- Associate errors with the affected control. Move focus to the first invalid field after a failed
  client submission and announce server failures through a suitable live region.

## Overview and summary contract

- Use compact bordered summary cards for headline quantities, amounts, trip counts, and completed
  distance. Cards are not links unless they have an explicit navigation affordance.
- Follow cards with semantic ranked tables for office, vehicle, fuel type, period, and budget
  allocation groupings.
- Right-align measures and use tabular figures. Show units and fixed precision consistently.
- Never call budget-allocation activity a percentage, remaining balance, or ceiling.
- Never communicate an increase, warning, success, failure, or job state through color alone.

## Detail and summary results

- Use a named horizontal-scroll region with a sticky header from 640 pixels upward.
- Replace wide tables with complete definition-list cards below 640 pixels.
- Keep every required field and permitted action in both presentations. Mobile cards may reorder
  fields for scanning but cannot omit them.
- Allow long destinations, purposes, driver names, vehicle labels, offices, and allocations to wrap.
  Do not truncate accessible names.
- Keep cursor controls as ordinary links with preserved normalized filters.
- Show request error, denied, invalid-filter, initial, empty, filtered-empty, populated, truncated,
  and cursor-end states explicitly.

## Export interaction

- Use a Radix Dialog for export confirmation and selected-filter review.
- Show report label, resolved period, office, expected mode when known, and the hard 100,000-row and
  50-MiB limits before submission.
- Disable only the active submit action and change its visible label while pending.
- Announce synchronous completion, queued acceptance, validation failure, permission failure, and
  recoverable server failure without stealing focus.
- Keep the dialog open after a correctable failure. Preserve Radix focus trapping, Escape dismissal,
  and focus return.
- Do not store or display raw download tokens.

## Recent export jobs

- Show report label, requested time, resolved period, mode, status, current attempt, expiry, and safe
  failure guidance.
- Use text plus a Lucide icon for `QUEUED`, `RUNNING`, `COMPLETED`, `FAILED`, and `EXPIRED`.
- Poll only while an owned job is queued or running. Cancel on unmount and slow polling while the
  document is hidden.
- Reserve stable space for status updates to avoid layout shift.
- Show Download only for completed, unexpired, owned jobs with current permissions.
- Mint a one-time link only after the user activates Download. Navigate immediately and never save
  the link in browser storage.
- Explain that expired files can be regenerated from the current filters.

## Loading and failure states

- Use reserved skeleton blocks for page loading longer than 300 milliseconds.
- Use a concise initial state before a report is selected when Overview is unavailable.
- Use a helpful filtered-empty state that offers Clear filters.
- Use an invalid-filter state that names the incorrect field and provides a recovery path.
- Use a denied state without leaking report or job data.
- Use a query-failure state with Retry navigation.
- Use a truncated state that states the enforced bound and recommends a narrower period or office.
- Use queued and running states with plain-language expectations and no indefinite decorative motion.
- Use failed and cleanup-failure states with a safe retry or regeneration path.
- Use expired state text instead of silently removing the job row.

## Responsive and accessibility checks

- Preserve at least 44-by-44-pixel targets, visible labels, two-pixel focus rings, semantic headings,
  and logical DOM order.
- Verify 375, 768, 1024, and 1440 pixels without page-level horizontal overflow.
- Verify landscape layout and browser zoom at 200 percent without hiding data or permitted actions.
- Keep table and card content complete in both light and dark mode with Web Content Accessibility
  Guidelines AA contrast.
- Respect `prefers-reduced-motion`. Limit feedback to short color or opacity transitions and avoid
  layout animation.
- Keep one primary action per page. Separate Clear filters, pagination, and download actions through
  hierarchy rather than reduced touch size.
- Use polite live regions for normal job progress and an alert only for actionable failures.
- Preserve the application skip link, main landmark, collapsible desktop sidebar, mobile drawer,
  active-route state, Escape behavior, and focus return.

## Forbidden patterns

- No chart-only presentation or new chart dependency.
- No client-only page shell or client-side authorization.
- No placeholder-only fields, icon-only job states, or color-only meaning.
- No page-level horizontal scrolling on mobile.
- No arbitrary z-index values, hover scaling, or layout-shifting animation.
- No raw download token in local storage, session storage, logs, or visible page content.
- No generated file path or storage key in the interface.
