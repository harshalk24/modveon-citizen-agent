# Citizen Assist — UI Handoff Spec
**Scheme:** Bermuda Flag · Navy Rail  
**Date:** June 2026  
**For:** Claude Code implementation

---

## Overview

A calm, civic-grade AI assistant UI inspired by the Bermuda Red Ensign flag. Premium banking-app aesthetics with tropical restraint. Four primary screens built as clean HTML reference files in this folder.

---

## File Index

| File | Screen | Description |
|------|--------|-------------|
| `tokens.css` | — | All design tokens as CSS custom properties. Drop into your stack. |
| `shell.html` | App shell | Sidebar nav + topbar. Wrap every screen with this. |
| `chat.html` | Navigation Agent | Main chat screen with agent messages, activity cards, step cards, suggestion chips, composer. |
| `proactive.html` | Proactive Agent | Job match cards + live auto-fill form. |
| `plan.html` | My Plan | Arrival checklist with expandable steps, progress bar, documents, mark-done. |
| `index.html` | All screens | Visual overview of all four screens side by side. |

---

## Color System

```
--ca-canvas      #F8F6F1   Limestone white — main background
--ca-sidebar     #1E3550   Atlantic navy — left rail
--ca-accent      #B0524A   Ensign red — ALL primary actions
--ca-ok          #3C7D5A   Sea green — done / verified / complete
--ca-alert       #B58233   Amber — urgent / time-sensitive
--ca-info        #35618C   Sky blue — online status / upcoming phases
--ca-danger      #D64242   Coral — errors only (form validation, system errors)
```

### Color usage rules (important)
- **Red (`--ca-accent`)** = interactive. Buttons, links, agent mark, active nav.
- **Green (`--ca-ok`)** = done. Checkmarks, completed step borders, verified chips.
- **Amber (`--ca-alert`)** = urgent. "This week", "Time-sensitive" labels and step left-borders.
- **Sky (`--ca-info`)** = informational. "Online" status dot, upcoming (not yet active) phases.
- **Coral (`--ca-danger`)** = error only. Never use for urgency — amber owns that role.
- **Never put two reds on the same card.** Urgent steps use amber border + label; errors use coral.

---

## Typography

```
Display / headings : Space Grotesk 500–700
Body / UI text     : Hanken Grotesk 400–700
Mono (IDs, code)   : ui-monospace (Menlo, Consolas)
```

**Google Fonts import:**
```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Hanken+Grotesk:wght@400;500;600;700&display=swap" rel="stylesheet">
```

---

## Layout

### App shell
- **Sidebar**: 248px fixed, `--ca-sidebar` bg, always visible on desktop
- **Main area**: `flex:1`, `min-width:0`, `--ca-canvas` bg
- **Topbar**: `border-bottom: 1px solid var(--ca-line)`, height ~56px, contains page title + mode toggle

### Sidebar anatomy
```
Logo mark (34×34 rounded square, --ca-accent bg)  +  "Citizen Assist" wordmark
New conversation button
Nav links (Chat, Dashboard, My Plan, My Profile)
  Active state: --ca-sb-active bg, icon in --ca-accent color
  Inactive: --ca-sb-muted text, --ca-sb-faint icon
[divider + Recent conversations list]
User profile tile (avatar initials + name + status)
```

### Mode toggle (Navigation / Proactive)
```
Pill toggle in topbar, --ca-chip-bg background
Active tab: --ca-card bg + subtle shadow
```

### Layer badge
Small chip in topbar showing current agent layer:
- `Layer 1 · Navigate` = navigation agent
- `Layer 2 · Act` = proactive agent

---

## Chat screen

### Context pills (below topbar)
Chips showing active context: location, permit type, user name.  
Style: `--ca-chip-bg` bg, 5px 12px padding, 9px radius.

### Message layout
```
User messages  → right-aligned, --ca-sand-bg bubble, border-top-right-radius: 5px
Agent messages → left-aligned, preceded by agent mark (28×28 teal square) + "Citizen Agent" label + online dot
```

### Agent activity card
Shown before agent's first message when it runs checks. Structure:
```
[top progress bar — full width, --ca-ok color when complete]
[header row: check count + collapse arrow]
[rows: check result + monospace detail block]
  ✓ green icon = success
  ⚠ amber icon = dependency/warning
```

### Step cards (inside agent message)
```
border-left: 3px solid --ca-alert  (urgent steps)
border-left: 3px solid --ca-ok     (done steps)
border-left: 3px solid --ca-sky    (upcoming steps)

Header: step title + urgency chip (amber) + cost chip (neutral)
Body:   description paragraph
Footer: location/channel chip  +  optional CTA button (--ca-accent)
```

### Suggestion chips (below agent message)
Primary suggestion: `--ca-accent` bg, white text  
Secondary: `--ca-card` bg, `--ca-border2` border

### Composer
Full-width at bottom, 18px left padding, send button `--ca-accent` bg.  
When agent is working: replace with "Agent is handling this step…" + 3-dot loader (--ca-accent dots).

---

## Proactive Agent screen

### Job match cards
Standard `.ca-card` with:
- Title + match % chip (green)
- Department subtitle
- 2×2 grid of metadata (location, salary, experience, deadline)
- "Select this role" CTA: primary for top match, ghost for others

### Auto-fill form card
Header bar uses `--ca-sidebar` bg (dark) with teal "Agent filling" pulse chip.  
Sections: collapsible with completion chips.  
Active field: `--ca-accent` border + `--ca-accent-soft` bg + glow ring.  
Empty pending field: dashed `--ca-border2` border.

---

## My Plan screen

### Progress header
Back link + page title (Space Grotesk) + "X / Y complete" chip (green).  
Full-width progress bar below (`--ca-ok` fill).

### Phase cards (collapsible)
```
Phase complete  → --ca-ok left-border,  green circle check icon
Phase urgent    → --ca-alert left-border, amber numbered circle, "This week" chip
Phase upcoming  → --ca-sky left-border,  sky numbered circle,   "Within N days" chip
```

**Expanded phase content:**
- Urgency chip + title + online/in-person chip
- Location line
- Cost + time metadata
- Documents needed box (`--ca-info-bg` bg, sky text)
- Employer note box (`--ca-raised` bg)
- "Apply now" primary button + "Mark as done" ghost button

---

## Interactions & states

### Hover states
- Cards: `border-color` shifts to `--ca-accent`, subtle box-shadow
- Nav items: `--ca-sb-active` bg
- Buttons: opacity 0.88

### Focus states
- Form fields: `1px solid --ca-accent` border + `0 0 0 3px rgba(176,82,74,.16)` ring
- Links/buttons: standard focus-visible outline in `--ca-accent`

### Agent typing / loading
- Composer disabled, replaced with "Agent is handling this step…" row
- Three dots animated: `ca-dot` keyframe, `--ca-accent` color
- Cursor blink in active form field: `ca-caret` keyframe

### Transitions
All transitions: `0.15s ease` for color/opacity, `0.3s ease` for layout shifts.  
Entry animation: `ca-fade` (opacity 0→1 + translateY 8px→0).

---

## Component map → your app

| Reference element | Map to your component |
|-------------------|-----------------------|
| Sidebar nav | Your existing nav / drawer |
| Mode toggle (Navigation / Proactive) | Tab or segment control |
| Agent mark (28×28 square avatar) | AgentAvatar |
| Activity card | ToolCallCard / AgentThinkingCard |
| Step card | ActionItem / StepCard |
| Suggestion chips | QuickReply / SuggestionChips |
| Composer | MessageInput |
| Job match card | ResultCard |
| Auto-fill form | FormFiller |
| Phase card | ChecklistItem |
| Progress bar | ProgressIndicator |

---

## Notes for Claude Code

1. **Replace all placeholder content** (Marcus Tavares, immigration steps, job listings) with your real app's data and use cases.
2. **`tokens.css`** uses the `--ca-*` prefix to avoid collisions. Rename if needed.
3. **The sidebar HTML** in `shell.html` is the single source of truth for nav structure — replicate active/inactive states from it.
4. **The form card** in `proactive.html` shows the agent-filling animation — apply the same active-field pattern to any form your agent fills.
5. **Fonts**: Space Grotesk is only used for headings and the agent mark. Hanken Grotesk covers everything else — safe to swap either if you have a brand font.
6. All markup uses **flexbox and grid with `gap`** — no margin-based spacing between siblings. Keep this pattern when porting.
