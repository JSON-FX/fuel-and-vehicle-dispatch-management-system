# Audit trail override

This page inherits `../MASTER.md`. It defines a read-only record of security and operational activity.

## Page goal and tone

- Help authorized staff trace who did what, when, and to which record.
- Present the trail as evidence, not as an editable activity feed.
- Use restrained language and dense, scannable data suitable for local-government review.
- Do not provide edit, delete, export, repair, verification-run, or replay controls.

## Information architecture

- Lead with the page title and a short explanation of the immutable audit trail.
- Follow with the latest completed verification status, then filters, results, and cursor pagination.
- Keep the verification summary compact. Show its completion time and verified sequence range.
- Render each result with time, action, actor, entity, request ID, and chain sequence.
- Link a result to its detail page through a descriptive action or its primary identifier.
- Start the detail page with a back link, title, verification context, event summary, and request context.
- Show sensitive request context only when the server grants the specific permission.

## Verification status

- Show only the latest completed verification result. Never imply that an in-progress run has passed.
- Pair `Passed`, `Failed`, and `Unavailable` text with `ShieldCheck`, `ShieldAlert`, or `Clock` icons.
- Pair semantic success, destructive, or warning colors with the text and icon.
- State the verified sequence range and completion time when they are available.
- Explain an unavailable status without weakening access to otherwise readable audit records.
- Do not expose a button that starts, retries, repairs, or changes verification.

## Filters and navigation

- Use a native `GET` form so filter state remains in the URL and survives back navigation.
- Give every control a visible label and keep the logical focus order aligned with the page layout.
- Provide From, To, Action, Entity type, Entity public ID, Actor public ID, and Request ID filters.
- Use a primary Search button and a clearly named Clear filters link.
- Keep pagination cursor-based. Label Previous and Next links with their destination meaning.
- Preserve active filters when following pagination links.
- Use the Lucide `Search` icon only as supporting decoration, never instead of button text.

## Results

- At 640 pixels and wider, use a semantic table with a compact 36-to-44-pixel row height.
- Place a sticky header only inside a bounded, named result region that can scroll horizontally.
- Give the region an accessible name such as `Audit trail results`.
- Below 640 pixels, replace the table with definition-list cards that contain every summary field.
- Use a monospace stack for timestamps, request IDs, public IDs, and sequence values.
- Wrap long identifiers within their cells or cards. Never cause viewport-level horizontal scrolling.
- Use sentence-case action labels while preserving the canonical action value for assistive context.
- Keep detail links at least 44 pixels tall on narrow screens.

## Detail page

- Use semantic sections for event summary, actor, entity, request, and chain evidence.
- Present labels and values as definition lists rather than disabled form controls.
- Show the event time, action, actor public ID, entity type, entity public ID, request ID, and sequence.
- Show the previous hash and record hash as wrapping monospace values.
- Mark absent actors or entities as `System` or `Not applicable` instead of leaving blank space.
- Render sensitive context only after a server-side permission check.
- Return a permission-denied state for the page itself when summary access is not granted.

## States

- Provide loading, empty, filtered-empty, invalid-filter, invalid-cursor, request-error, and permission-denied states.
- Provide an unavailable verification state separately from audit-query errors.
- Keep the current filters visible after invalid input or a request error.
- Explain the next useful action in plain language without exposing internal database details.
- Reserve space for delayed status and result content to avoid layout shifts.
- Announce validation and request errors through an appropriate live region.

## Responsive and accessibility checks

- Verify the summary, filters, results, and detail layout at 375, 768, 1024, and 1440 pixels.
- Stack filters and make controls full width on narrow screens. Maintain 44-by-44-pixel targets.
- Preserve every audit field and navigation action at 200 percent browser zoom.
- Use visible two-pixel focus rings and keyboard-operable native links, inputs, and buttons.
- Keep light and dark schemes within Web Content Accessibility Guidelines AA contrast targets.
- Respect reduced-motion preferences. Use only short color or opacity transitions for direct feedback.
- Do not add gradients, marketing imagery, hover lifts, or decorative motion.
