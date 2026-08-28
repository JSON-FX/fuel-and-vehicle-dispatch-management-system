# Security settings page override

This page inherits `../MASTER.md`. It controls the global privileged MFA requirement.

## Structure

- Use one focused settings card beneath the page title and global-scope badge.
- Keep the control label, operational effect, and current state visible together.
- Explain that password controls remain active in both modes.
- Show the last-change timestamp without exposing the administrator identity.

## Interaction

- Use a native checkbox with switch semantics and a 44-pixel interaction target.
- Require an explicit save action after the switch changes.
- Warn that enabling MFA immediately revokes active privileged sessions.
- Redirect the acting administrator to sign in again after enabling MFA.
- Preserve existing authenticator enrollments when the setting is disabled.

## Feedback and access

- Announce save success and failure through the shared live status component.
- Render an explicit denied state for users without `auth.settings.manage`.
- Keep the page readable at 200-percent zoom and without viewport overflow.
