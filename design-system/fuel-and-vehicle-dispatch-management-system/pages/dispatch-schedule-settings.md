# Dispatch schedule settings

This page contract inherits every rule in `../MASTER.md`. It uses the saved semantic tokens,
Lexend and Source Sans 3 typography, collapsible sidebar, restrained motion, and responsive rules.

## Information architecture

- Use `/admin/dispatch-settings` for the global scheduling policy.
- Show `Dispatch settings` in the Administration group only to users with
  `dispatch.settings.manage`.
- Keep the page as a Server Component. Use one client leaf for the protected settings mutation.
- Treat navigation visibility as convenience only. The page and API enforce the exact permission.

## Content hierarchy

- Lead with `Dispatch schedule settings` and a short explanation that the policy is global.
- Show a visible `Global policy` badge, current policy, operational effect, last updater, and last
  update time.
- Present only `WARN_AND_ACK` and `BLOCK`. Explain each option in plain language before a change.
- Explain that same-day matching remains conservative because time intervals are not yet exposed.

## Mutation behavior

- Require explicit confirmation before saving `BLOCK` because it prevents every conflicting
  dispatch mutation.
- Use the existing session Cross-Site Request Forgery token and protected settings API.
- Disable only the active Save action. Preserve the selected value after expected validation or
  server errors.
- Announce pending, success, validation, denial, and recoverable server states through accessible
  live feedback.
- Treat a no-op save as success without creating duplicate audit evidence.

## Permission and denied states

- Require `dispatch.settings.manage` for reading and updating the policy.
- Do not infer access from `auth.settings.manage`, role names, or navigation visibility.
- Render a clear denied state without disclosing current policy or updater information.

## Responsive and accessibility checks

- Use visible radio labels or an equivalent native-choice pattern with complete descriptions.
- Preserve 44-pixel targets, two-pixel focus rings, logical keyboard order, and explicit status
  text.
- Keep the form single-column at 375 pixels and constrain its readable measure on wider screens.
- Verify 375, 768, 1024, and 1440 pixels, dark mode, reduced motion, and 200 percent zoom.
- Use semantic warning text and an icon for `BLOCK`; never rely on color alone.
