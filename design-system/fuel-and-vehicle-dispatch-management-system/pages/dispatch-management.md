# Vehicle dispatch management pages

This page contract inherits every rule in `../MASTER.md`. It preserves the saved tokens,
Lexend and Source Sans 3 typography, collapsible sidebar, data density, and low-motion direction.

## Information architecture

- Use `/dispatches` for the list, `/dispatches/new` for creation, and
  `/dispatches/:dispatchId` for detail and DRAFT editing. Use `/dispatches/schedule` for day,
  week, and month schedules.
- Keep search, status, requesting office, travel-date range, cursor, and page size in native GET
  parameters so every result view is deep-linkable.
- Keep list and detail pages as Server Components. Use client leaves only for filters, form
  controls, and lifecycle dialogs.
- Show Dispatch in the Operations sidebar group to users with `dispatch.read`. Render create,
  update, complete, and cancel controls only with the exact matching permission.
- Link Schedule from the dispatch-list header instead of adding a second Operations sidebar item.
- Keep schedule pages as Server Components. Limit client behavior to advisory availability and
  authoritative conflict acknowledgment.

## List and filtering contract

- Lead with the page title, operational description, result count, and New dispatch action.
- Filter by destination or related reference text, lifecycle status, requesting office, and an
  inclusive travel-date range. Keep Apply filters and Clear filters available at every width.
- Label the broad text field `Search dispatches`. Explain its destination, purpose, driver,
  vehicle, and office scope through concise placeholder or helper text.
- Align the search input with Status, Requesting office, Travel date from, and Travel date to at
  desktop widths. Preserve the stacked mobile layout and native GET behavior.
- Use a named horizontal scroll region with a sticky header from 640 pixels upward.
- Replace the table with complete definition-list cards below 640 pixels.
- Display travel date, destination and purpose, driver, vehicle plate, requesting office,
  passenger count, initial odometer, and status in both responsive presentations.
- Preserve active filters across cursor links. Show request error, denied, invalid-filter, empty,
  filtered-empty, populated, and cursor-end states explicitly.

## Dispatch form contract

Group the form into five visible fieldsets followed by review actions:

1. Dispatch information: entry date and travel date.
2. Vehicle and driver: eligible driver and vehicle selectors.
3. Travel details: requesting office, destination, and purpose.
4. Odometer and passengers: exact initial odometer string and nonnegative passenger count.
5. Review: lifecycle guidance, save action, and cancel navigation.

- Use current ACTIVE offices, drivers, and vehicles from server preparation options.
- Keep odometers as strings and use `inputMode="decimal"` without numeric coercion.
- Keep passenger count numeric while rejecting negative or fractional values.
- Preserve entered values after expected errors. Focus the first invalid field and associate its
  inline message through `aria-describedby`.
- Disable only the active submission. Announce pending, success, and error states through live
  regions without replacing the whole page with client-side loading behavior.

## Advisory availability contract

- Request advisory availability only after travel date, driver, and vehicle are complete and
  valid. Cancel obsolete requests whenever one value changes.
- Announce waiting, loading, available, conflicting, and recoverable failure states through a
  polite live region without moving focus.
- Keep Save available after advisory failure. The final server transaction remains authoritative.
- Show conflict type, status, destination, purpose, driver, and vehicle through text and Lucide
  icons. Never rely on warning color alone.
- Do not claim broad availability when no specific driver or vehicle has been selected.

## Detail and lifecycle contract

- Put the text-and-icon status, destination, travel date, and vehicle plate at the top.
- Group dispatch facts, assigned resources, travel details, odometer evidence, passengers, and
  lifecycle history into readable definition lists.
- Show Edit and Dispatch only for DRAFT records. Show Complete only for DISPATCHED records.
- Show Cancel for DRAFT or DISPATCHED records. COMPLETED and CANCELLED records are terminal and
  display no mutation controls.
- Show the derived distance only after completion. Keep the exact one-decimal representation.
- Add a read-only `Schedule conflict acknowledgments` section. Show historical conflict link,
  type, effective policy, reason, actor public ID, and acknowledgment time.
- Explain that historical acknowledgment does not mean a current conflict remains overridden.
- Never expose internal identifiers, driver contact details, network addresses, or user agents.

## Dialog behavior

- Use an ordinary confirmation Dialog or AlertDialog for Dispatch. Explain that the draft becomes
  operational and must be completed or cancelled afterward.
- Use a completion Dialog with a visible final-odometer field. Show live exact distance only after
  a valid reading at least equal to the initial reading.
- Use a destructive AlertDialog for cancellation. Require a visible 10-to-500-character reason.
- Keep dialogs open after validation, conflict, or policy errors. Focus the first invalid field or
  error summary, preserve entered values, and return focus to the trigger after closing.
- Disable only the dialog action whose request is pending. Use a text loading label or compact
  spinner and never a decorative continuous animation.
- Open a Radix Dialog after an authoritative `DISPATCH_SCHEDULE_CONFLICT` response. Preserve the
  underlying draft or transition values.
- Under `BLOCK`, explain that the global policy prevents continuation. Under `WARN_AND_ACK`,
  require override permission, an explicit reviewed checkbox, and a 10-to-500-character reason.
- When the server returns a changed fingerprint, replace the conflict summary, clear the reviewed
  checkbox, and move focus to the revised summary.
- Preserve Radix focus trapping, Escape dismissal, and focus return. Never submit when the dialog
  closes.

## Schedule contract

- Keep `view`, `date`, office, driver, vehicle, and status in native GET parameters.
- Render day as a grouped agenda. Render week as seven labeled columns from 768 pixels and an
  agenda below 768 pixels.
- Render month as a semantic table or seven-column date grid from 640 pixels and an agenda below
  640 pixels. Do not use drag-and-drop or a custom ARIA application grid.
- Provide Previous, Today, Next, Day, Week, and Month as ordinary links. Preserve current filters
  when changing dates or views.
- Cap displayed events at 200 and show a truncation notice. Derive occupancy independently so a
  truncated event list never produces a false `Available` state.
- Show selected-resource availability, occupied dates, conflict counts, lifecycle status, and
  authorization-aware dispatch links.
- Reserve space while loading. Show empty, filtered-empty, invalid-query, denied, failure, and
  truncated states explicitly.

## Status semantics

- DRAFT means editable preparation work and uses a document icon plus a neutral label.
- DISPATCHED means the trip is active and uses a route icon plus an informational label.
- COMPLETED means final odometer evidence is recorded and uses a check icon plus a success label.
- CANCELLED means the trip stopped before completion and uses an X icon plus a destructive label.
- Never rely on color alone. Every status includes its full text and a distinct Lucide icon.

## Responsive and accessibility checks

- Preserve 44-pixel targets, visible labels, two-pixel focus rings, and logical DOM order.
- Verify 375, 768, 1024, and 1440 pixels without page-level horizontal overflow.
- Verify browser zoom at 200 percent without hiding content or permitted actions.
- Preserve complete content and semantic contrast in dark mode.
- Respect `prefers-reduced-motion`. Use only short color or opacity feedback without layout motion.
- Keep one primary action per page. Separate destructive cancellation from ordinary actions.
- Retain Radix focus trapping, Escape handling, and focus return for every dialog.
- Verify the dispatch-list search label remains concise and its input aligns with neighboring
  desktop controls at 1024 and 1440 pixels.
