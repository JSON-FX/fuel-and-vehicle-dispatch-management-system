# Role management override

This page inherits `../MASTER.md`. It refines role and permission administration.

## Information architecture

- Show roles in a semantic table with Name, Code, Privileged, Active, Permissions, and Actions.
- Distinguish seeded and custom roles with text, not color alone.
- Keep role codes visually compact in the system monospace stack.
- Use one Create role action and direct links to role detail pages.

## Permission editor

- Group permissions by domain in fieldsets with clear legends.
- Show the stable permission code and a plain-language label for each item.
- Make every checkbox and label a 44-pixel interaction row.
- Explain privileged role effects before allowing that marker to change.
- Require a principal with the privileged-assignment permission before exposing the control.

## Confirmation and feedback

- Confirm role deactivation, privileged-state changes, and permission replacement when users are affected.
- State that affected sessions will be revoked.
- Return dialog focus to its trigger and announce success without moving focus unexpectedly.
- Provide explicit denied, stale-conflict, empty, and retry states.

## Responsive behavior

- Use a card or definition-list role summary below 640 pixels.
- Stack permission groups in one column by default and two columns from 768 pixels.
- Keep primary actions reachable without hover and usable at 200-percent zoom.
- Use semantic tokens, Lucide icons, and reduced-motion-safe transitions only.
