# Login page override

This page inherits `../MASTER.md`. The rules below only refine the authentication flow.

## Purpose and hierarchy

- Present one compact sign-in card centered within `min-h-dvh`.
- Keep the application name and government operations context visible without a marketing hero.
- Use one page heading, one short security explanation, and one primary submit action.
- Keep the card at `max-w-md`; use 16-pixel mobile gutters and 24-pixel card padding.

## Form behavior

- Show visible Username and Password labels with `username` and `current-password` autocomplete.
- Provide a 44-pixel password visibility control with a Lucide icon and an explicit accessible name.
- Disable the submit button while pending and keep its label descriptive.
- Associate field errors with their inputs. Focus the first invalid field after validation failure.
- Announce the generic credential failure through an assertive live region without revealing account state.
- Preserve a sanitized same-origin `returnTo` path when authentication completes.

## States and responsive behavior

- Reserve space for the error alert to avoid large layout shifts.
- Keep the full form available at 375 pixels and 200-percent zoom without horizontal scrolling.
- Use semantic tokens only. Do not add gradients, illustrations, decorative motion, or oversized text.
- Use only restrained color and opacity transitions. Disable them for reduced motion.
