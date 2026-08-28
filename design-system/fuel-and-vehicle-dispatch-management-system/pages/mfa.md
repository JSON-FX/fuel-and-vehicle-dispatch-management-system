# MFA pages override

These pages inherit `../MASTER.md`. They cover privileged TOTP enrollment and challenge steps.

## Shared structure

- Use the compact authentication shell and `max-w-lg` content width.
- Identify the current step in text. When global MFA is enabled, explain that enrollment is required to continue.
- Provide one primary action and one safe exit action when the flow permits it.
- Keep all challenge and enrollment responses uncached and absent from browser storage.

## Enrollment

- Render the QR code with a concise accessible description.
- Place the selectable manual secret directly below the QR as an equivalent fallback.
- Mark the manual secret as sensitive and explain that it appears only during enrollment.
- Use a six-digit, numeric, `one-time-code` input for confirmation.

## Challenge and errors

- Use one labeled six-digit input with tabular numerals and `one-time-code` autocomplete.
- Keep validation feedback adjacent to the input and announce terminal challenge errors assertively.
- Explain expiry and retry options without disclosing throttle counters.
- Move focus to the code field on ordinary failure and to the recovery action after terminal failure.

## Responsive behavior

- Stack the QR, fallback secret, and confirmation form at narrow widths.
- A two-column enrollment layout is allowed from 768 pixels when reading order remains logical.
- Never crop the QR or manual secret at 200-percent zoom.
- Use no decorative animation; preserve reduced-motion behavior from the master.
