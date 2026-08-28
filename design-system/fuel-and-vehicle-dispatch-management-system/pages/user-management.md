# User management override

This page inherits `../MASTER.md`. It refines dense account administration and recovery workflows.

## Information architecture

- Lead with the page title, result count, search/filter controls, and one Create user action.
- Render the desktop result set as a semantic table with Username, Name, Roles, Status, MFA, and Actions.
- Use explicit text badges for active, inactive, deleted, enrolled, and enrollment-required states.
- Keep row actions secondary. Put destructive and recovery actions behind named AlertDialog controls.

## Small screens

- Below 640 pixels, use a definition-list card per user instead of shrinking the table.
- Preserve every status and management action. Do not hide security actions on mobile.
- Keep filters above results and use full-width controls where needed.
- Maintain 44-pixel controls and prevent viewport-level horizontal scrolling.

## Forms and sensitive actions

- Group identity, account status, and role assignment with fieldsets and legends.
- Require visible reason fields for deletion, password reset, and TOTP reset.
- Return focus to the initiating control when a dialog closes.
- Present a generated temporary password in a persistent one-time dialog.
- Include a copy action and require explicit acknowledgment before closing that dialog.
- Never place a temporary password in a toast, URL, log, or persistent browser storage.

## States

- Provide loading, empty, filtered-empty, permission-denied, validation-error, and request-error states.
- Preserve filter and pagination values in the URL for predictable back navigation.
- Use server-rendered account data. Client-side visibility never replaces permission checks.
