# FVDMS Master Design System

> When implementing a page, first check `pages/<page-name>.md` beside this file.
> A page file overrides this master only where it states a different rule.

**Project:** Fuel and Vehicle Dispatch Management System
**Product type:** Internal local-government operations application
**Direction:** Accessible and ethical, trustworthy, restrained, data-dense
**Design dials:** Variance 3/10, motion 2/10, density 8/10

This system was generated with UI/UX Pro Max, then refined using its government,
data-dashboard, accessibility, Next.js, and shadcn guidance. It replaces the
generator's marketing-page suggestions with rules suited to daily administrative work.

## Core principles

- Optimize for accuracy, scanning, and repeated daily use.
- Use a clear hierarchy without oversized marketing typography.
- Keep data dense, but preserve readable labels and 44-by-44-pixel touch targets.
- Never communicate state through color alone. Pair color with text or an icon.
- Use semantic HTML and shadcn/ui primitives before custom interactive controls.
- Keep Next.js pages as Server Components. Push client behavior to leaf components.

## Color tokens

Use semantic CSS variables in `src/app/globals.css`. Components must not use raw
palette classes such as `bg-blue-600` when a semantic token exists.

### Light scheme

| Role | Value | Purpose |
|---|---:|---|
| `--background` | `#F8FAFC` | Application canvas |
| `--foreground` | `#020617` | Primary text |
| `--card` | `#FFFFFF` | Panels and cards |
| `--card-foreground` | `#020617` | Text on panels |
| `--primary` | `#0F172A` | Primary actions and strong emphasis |
| `--primary-foreground` | `#FFFFFF` | Text on primary |
| `--secondary` | `#E2E8F0` | Secondary controls |
| `--secondary-foreground` | `#0F172A` | Text on secondary |
| `--accent` | `#0369A1` | Links, selection, and current context |
| `--accent-foreground` | `#FFFFFF` | Text on accent |
| `--muted` | `#E8ECF1` | Subdued surfaces |
| `--muted-foreground` | `#475569` | Secondary text |
| `--border` | `#CBD5E1` | Borders and dividers |
| `--input` | `#CBD5E1` | Input borders |
| `--ring` | `#0369A1` | Keyboard focus ring |
| `--destructive` | `#B91C1C` | Destructive actions and errors |
| `--destructive-foreground` | `#FFFFFF` | Text on destructive |
| `--success` | `#166534` | Successful or available state |
| `--success-foreground` | `#FFFFFF` | Text on success |
| `--warning` | `#B45309` | Warning or attention state |
| `--warning-foreground` | `#FFFFFF` | Text on warning |
| `--info` | `#0369A1` | Informational state |
| `--info-foreground` | `#FFFFFF` | Text on info |

### Dark scheme

| Role | Value | Purpose |
|---|---:|---|
| `--background` | `#020617` | Application canvas |
| `--foreground` | `#F8FAFC` | Primary text |
| `--card` | `#0F172A` | Panels and cards |
| `--card-foreground` | `#F8FAFC` | Text on panels |
| `--primary` | `#E2E8F0` | Primary actions and strong emphasis |
| `--primary-foreground` | `#0F172A` | Text on primary |
| `--secondary` | `#1E293B` | Secondary controls |
| `--secondary-foreground` | `#F8FAFC` | Text on secondary |
| `--accent` | `#38BDF8` | Links, selection, and current context |
| `--accent-foreground` | `#082F49` | Text on accent |
| `--muted` | `#1E293B` | Subdued surfaces |
| `--muted-foreground` | `#CBD5E1` | Secondary text |
| `--border` | `#334155` | Borders and dividers |
| `--input` | `#334155` | Input borders |
| `--ring` | `#7DD3FC` | Keyboard focus ring |
| `--destructive` | `#F87171` | Destructive actions and errors |
| `--destructive-foreground` | `#450A0A` | Text on destructive |
| `--success` | `#4ADE80` | Successful or available state |
| `--success-foreground` | `#052E16` | Text on success |
| `--warning` | `#FBBF24` | Warning or attention state |
| `--warning-foreground` | `#451A03` | Text on warning |
| `--info` | `#38BDF8` | Informational state |
| `--info-foreground` | `#082F49` | Text on info |

Validate normal text at 4.5:1 or better. Aim for 7:1 where practical. Never use
green and red without a text label or a distinct icon.

## Typography

- Use Lexend for headings and Source Sans 3 for body and interface text.
- Load both through `next/font/google` so production pages make no Google Fonts request.
- Use a system monospace stack only for identifiers, timestamps, and fixed-width data.
- Keep body text at 16 pixels. Use 14 pixels only for secondary table metadata.
- Use sentence case for headings, labels, buttons, and table headers.
- Keep page titles between 28 and 36 pixels. Do not use display-size hero text.

## Spacing, shape, and depth

| Token | Value | Typical use |
|---|---:|---|
| `--space-1` | `4px` | Tight inline gaps |
| `--space-2` | `8px` | Icon and label gaps |
| `--space-3` | `12px` | Compact control padding |
| `--space-4` | `16px` | Standard panel padding |
| `--space-6` | `24px` | Section separation |
| `--space-8` | `32px` | Page-level separation |

- Use a 6-pixel base radius and one-pixel borders.
- Prefer borders and background contrast over heavy shadows.
- Use a small shadow only for menus, dialogs, and elevated overlays.
- Do not lift, scale, or animate ordinary cards on hover.
- Add `cursor-pointer` only to elements that perform an action.

## Component rules

- Use shadcn/ui's `new-york` style with CSS variables and Lucide icons.
- Keep components local so variants remain reviewable and accessible.
- Use `Button` for actions and a styled link for navigation.
- Use `Card` only as a content container. Cards are not interactive by default.
- Use `Dialog`, `AlertDialog`, `Select`, and related Radix-based components.
- Do not replace their focus management or Accessible Rich Internet Applications attributes.
- Give every form control a visible label. Associate errors and descriptions explicitly.
- Give icon-only buttons an accessible name and a tooltip when the action is unclear.
- Use skeletons or reserved space for delayed content to avoid layout shifts.

## Data-display rules

- Use 36-to-44-pixel table rows and sticky headers for long operational tables.
- Put wide tables in an `overflow-x-auto` region with an accessible name.
- Consider a card or definition-list view below 640 pixels when horizontal scrolling harms use.
- Keep sorting, filtering, and pagination behavior consistent across modules.
- Use TanStack Table with shadcn/ui for complex tables. Do not hand-roll these behaviors.
- Right-align numeric values and use consistent precision for money and quantities.
- Show loading, empty, error, filtered-empty, and permission-denied states explicitly.

## Application shell navigation

- Use a 272-pixel sidebar at 1024 pixels and wider, with a toggle beside the FVDMS title.
- Collapse the desktop sidebar into a 72-pixel icon rail when the user requests more space.
- Use the same navigation inside a left-side modal drawer below 1024 pixels.
- Keep Operations and Oversight destinations visible when the user has access.
- Put Master data and Administration destinations in collapsible disclosure groups.
- Open the disclosure group containing the current route and mark its link with
  `aria-current="page"`.
- Keep Account and Sign out separated from application destinations at the bottom.
- Filter destinations from server-derived permissions. Navigation visibility never replaces
  page or API authorization.
- Use an icon and text label for every expanded destination.
- In the compact rail, keep every permitted destination directly clickable. Preserve accessible
  text, a title tooltip, group separators, and active-route emphasis.
- Preserve 44-by-44-pixel targets, visible focus, Escape dismissal, and focus return in the
  mobile drawer.

## Responsive rules

- Start with mobile styles, then enhance at 640, 768, and 1024 pixels.
- Verify every page at 375, 768, 1024, and 1440 pixels.
- Keep core actions usable without hover.
- Maintain 44-by-44-pixel touch targets on narrow screens.
- Do not hide required actions or information on smaller viewports.
- Avoid fixed widths for content regions and prevent viewport-level horizontal scroll.

## Accessibility rules

- Include a skip link and a semantic `main` landmark in the application shell.
- Preserve visible `focus-visible` rings with at least a two-pixel outline.
- Support keyboard-only operation with a logical tab order.
- Use native elements before adding Accessible Rich Internet Applications attributes.
- Announce dynamic success and error messages with suitable live regions.
- Respect browser zoom up to 200 percent.
- Respect `prefers-reduced-motion` for every transition and animation.
- Test contrast, keyboard flow, labels, focus return, and screen-reader names.

## Motion

- Use 150-to-200-millisecond color and opacity transitions for direct feedback.
- Animate no more than one or two meaningful elements in a view.
- Do not add GSAP or scroll effects to the application foundation.
- Avoid motion that changes layout or delays access to operational data.

## FVD-001 root page

The foundation page is a compact system-status view, not a dashboard or landing page.
It contains the application name, a short foundation-ready message, and a clear link
to `/api/health`. It uses the same tokens, typography, skip link, focus treatment,
and responsive rules that later pages inherit.

## Forbidden patterns

- No emojis as icons.
- No gradients, glass effects, decorative blobs, or marketing hero sections.
- No color-only status indicators.
- No placeholder-only form labels.
- No removed focus outlines.
- No layout-shifting hover transforms.
- No client component when static server rendering is sufficient.
- No raw colors inside feature components when semantic tokens exist.

## Pre-delivery checklist

- [ ] The relevant page override was checked before this master file.
- [ ] shadcn/ui primitives were used for interactive controls.
- [ ] All interactive elements work with a keyboard and show focus.
- [ ] Text and control contrast meets Web Content Accessibility Guidelines AA.
- [ ] Status uses text or an icon in addition to color.
- [ ] Reduced motion is respected.
- [ ] Loading, empty, error, and denied states are covered where applicable.
- [ ] The page works at 375, 768, 1024, and 1440 pixels.
- [ ] Browser zoom at 200 percent does not remove content or actions.
- [ ] No page-level horizontal scroll appears on mobile.
