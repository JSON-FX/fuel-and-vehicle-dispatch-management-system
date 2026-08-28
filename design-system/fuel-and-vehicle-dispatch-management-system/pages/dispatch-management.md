# Vehicle dispatch management pages

This page contract inherits every rule in `../MASTER.md`. It preserves the saved tokens,
Lexend and Source Sans 3 typography, collapsible sidebar, data density, and low-motion direction.

## Information architecture

- Use `/dispatches` for the list, `/dispatches/new` for creation, and
  `/dispatches/:dispatchId` for detail and DRAFT editing.
- Keep search, status, requesting office, travel-date range, cursor, and page size in native GET
  parameters so every result view is deep-linkable.
- Keep list and detail pages as Server Components. Use client leaves only for filters, form
  controls, and lifecycle dialogs.
- Show Dispatch in the Operations sidebar group to users with `dispatch.read`. Render create,
  update, complete, and cancel controls only with the exact matching permission.
- FVD-008 availability and schedule-conflict warnings are intentionally absent from this slice.

## List and filtering contract

- Lead with the page title, operational description, result count, and New dispatch action.
- Filter by destination or related reference text, lifecycle status, requesting office, and an
  inclusive travel-date range. Keep Apply filters and Clear filters available at every width.
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

## Detail and lifecycle contract

- Put the text-and-icon status, destination, travel date, and vehicle plate at the top.
- Group dispatch facts, assigned resources, travel details, odometer evidence, passengers, and
  lifecycle history into readable definition lists.
- Show Edit and Dispatch only for DRAFT records. Show Complete only for DISPATCHED records.
- Show Cancel for DRAFT or DISPATCHED records. COMPLETED and CANCELLED records are terminal and
  display no mutation controls.
- Show the derived distance only after completion. Keep the exact one-decimal representation.

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
