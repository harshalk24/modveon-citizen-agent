# Handoff: Citizen Agent — Mobile Landing Screen

## Overview
A single mobile screen (iPhone, portrait) introducing "Citizen Agent" — the action layer of Modveon's Verified Operating System. It is a marketing/onboarding splash: brand lockup, hero, a verified-access assurance, three capability rows, and a primary CTA. One screen, no scroll.

## About the Design Files
The files in this bundle are **design references created in HTML** — a prototype showing the intended look and behavior, **not production code to copy directly**. The task is to **recreate this design in the target codebase's existing environment** (React, SwiftUI, Flutter, etc.) using its established components, theming, and patterns. If no environment exists yet, pick the most appropriate framework for the project and implement it there.

The prototype is authored as a "Design Component" (`.dc.html`) — a custom streaming-HTML format. **Ignore the `<x-dc>`, `<helmet>`, `{{ }}` holes, and `data-dc-script` wrappers** — they are specific to the prototype runtime. Everything you need (markup structure, inline styles, logic) is readable inside it; the tokens and measurements below are the source of truth.

## Fidelity
**High-fidelity (hifi).** Final colors, typography, spacing, and layout. Recreate pixel-faithfully using the codebase's libraries. Exact hex values, font, and measurements are given below.

## Screens / Views

### Citizen Agent (single screen)
- **Purpose:** Brand intro + launch entry point. User reads the value prop and taps "Launch Citizen Agent".
- **Canvas:** 390 × 844 px (iPhone 14/15 logical points), dark theme.
- **Layout:** Vertical flex column, `justify-content: space-between`, `padding: 64px 24px 30px`. The 64px top padding clears the status bar / Dynamic Island. Content fills the screen height exactly — **no scrolling**. Six top-level blocks, evenly distributed:

1. **Brand lockup** (centered, column, gap 7px)
   - Modveon logo image, 172px wide (see Assets for the technique)
   - Eyebrow: "THE VERIFIED OPERATING SYSTEM" — 10px, weight 500, `letter-spacing:0.12em`, uppercase, color `#7C8B9E`, `white-space:nowrap`

2. **Badge + Hero** (centered, column, gap 14px)
   - Pill badge "THE NEXT LAYER": 11px / 600 uppercase, `letter-spacing:0.1em`, `padding:6px 18px`, `border-radius:999px`, border `1px solid rgba(176,82,74,0.6)`, text `#C46E5E`, transparent fill
   - H1 "Citizen Agent": 44px / 800, `letter-spacing:-0.03em`, `line-height:1.05`, `#FFFFFF`, margin-bottom 12px
   - Sub: "The action layer of Modveon's Verified Operating System." — 16px / 1.5, `#AEB9C8`

3. **Verified Access card**
   - Container: `border-radius:18px`, `padding:17px 18px`, flex row, gap 15px, fill `rgba(44,67,99,0.28)`, border `1px solid rgba(124,139,158,0.22)`
   - Icon badge: 52×52 circle, gradient `linear-gradient(145deg,#3C7D5A,#2C5F43)`, outer ring `box-shadow:0 0 0 5px rgba(60,125,90,0.14)`, white shield-check icon (25px)
   - Label "VERIFIED ACCESS": 11px / 700 uppercase, `letter-spacing:0.12em`, `#4FA77B`
   - Body "We verify every citizen's identity at onboarding.": 15px / 1.4, `#E6EAF0`

4. **Capabilities** (column, gap 10px)
   - Divider eyebrow "UNDERSTAND · REASON · ACT": 11px uppercase, `letter-spacing:0.14em`, `#7C8B9E`, centered
   - Three identical rows: fill `rgba(44,67,99,0.38)`, border `1px solid rgba(124,139,158,0.16)`, `border-radius:16px`, `padding:14px 18px`, flex row gap 14px
     - Icon well: 44×44, `border-radius:11px`, fill `rgba(127,168,201,0.1)`, icon stroke `#9FB3C9` (1.6 width, 21px)
     - Label: 15px / 500, `#E6EAF0`
   - Icons (Lucide): row 1 `user`, row 2 `align-justify`/list (+ a small `#4FA77B` status dot bottom-right of the well, 8px, 1.5px border `#213750`), row 3 `share-2`
   - Copy: "Understands your situation" · "Reasons over verified government information" · "Acts across government on your behalf"

5. **Tagline:** "Answers found. Benefits surfaced. Processes completed." — 13.5px / 1.5, `#7C8B9E`, centered

6. **CTA + Footer** (column, gap 18px)
   - Button: full width, `padding:18px`, `border-radius:16px`, 18px / 700, white text, fill `linear-gradient(180deg,#BA5A50,#A84A42)`, shadow `0 6px 22px rgba(176,82,74,0.34)`. Label: "Launch Citizen Agent →"
   - Footer line 1 "CITIZEN AGENT BY MODVEON": 10px / 600 uppercase, `letter-spacing:0.16em`, `#6A7B8E`
   - Footer line 2 "Part of the Verified Operating System": 13px, `#6A7B8E`

## Interactions & Behavior
- **CTA tap:** primary action — navigate to / launch the Citizen Agent experience (wire to your route).
- **No internal scroll:** the screen is sized to the device interior; content is distributed with `space-between`. If your target device is shorter, prefer scaling the frame or allowing scroll rather than cramming.
- **Hover/press (web):** add a subtle darken on the CTA (e.g. -6% lightness) and `active` scale `0.99`; not specified in the mock — match your design system.
- No loading/error/form states on this screen.

## Theming (the prototype exposes 3 "feel" controls — optional to port)
The prototype lets you reshape the whole composition from one base. Worth replicating as theme options:
- **Accent** (single base hex → derived shades): `#B0524A` Terracotta *(default)*, `#C42031` Ensign Red, `#B58233` Atlantic Gold, `#3E6E9C` Steel Cyan. Drives badge border/text, CTA gradient, and CTA glow. Dark = base −10% L, light (badge text) = base +30% toward white, glow = `rgba(base, .34)`.
- **Surface** (all four cards): **Outlined** *(default, above)* · **Glass** = fill `rgba(127,168,201,0.08)`, border `rgba(255,255,255,0.13)`, `backdrop-filter:blur(10px) saturate(150%)` · **Solid** = fill `#243B57`, border `rgba(124,139,158,0.07)`.
- **Backdrop** (screen background): **Spotlight** *(default)* `radial-gradient(ellipse 125% 72% at 50% 24%, #2C456A, #1E3550 48%, #15263C)` · **Flat** `#1E3550` · **Aurora** `radial-gradient(ellipse 120% 62% at 50% 8%, rgba(accent,0.30), #20395B 32%, #1A2E47 64%, #13233A)`.

## State Management
- `accent: string` (hex), `surface: 'Outlined'|'Glass'|'Solid'`, `backdrop: 'Spotlight'|'Flat'|'Aurora'` — only if you port the theming controls. Otherwise the screen is static (defaults above).

## Design Tokens

```
/* Navy base */
ink / primary navy     #1E3550
navy border            #2C435E
raised navy            #28425E
solid card             #243B57
card fill (outlined)   rgba(44,67,99,0.38)   /* #2C4763 */
card fill (verified)   rgba(44,67,99,0.28)
card border faint      rgba(124,139,158,0.16)
icon well fill         rgba(127,168,201,0.10)

/* Accent (terracotta = file's "ensign red") */
accent                 #B0524A
accent dark            #974640   (CTA bottom ~ #A84A42)
accent soft tint       #F4E4E0
badge text             #C46E5E
CTA gradient           linear-gradient(180deg,#BA5A50,#A84A42)
CTA glow               0 6px 22px rgba(176,82,74,0.34)

/* Verified green */
ok                     #3C7D5A
ok dark                #2C5F43 / #326B4D
label green            #4FA77B

/* Text */
heading                #FFFFFF
body / muted           #AEB9C8   (#A9B4C4)
faint                  #7C8B9E
footer                 #6A7B8E
icon stroke            #9FB3C9

/* Type — Hanken Grotesk (Google Fonts, 400/500/600/700/800) */
H1 44/800/-0.03em/1.05 · body 16/1.5 · card 15/500
eyebrow 10–11/500–700 uppercase, letter-spacing 0.12–0.16em

/* Radius */  cards 16–18px · icon well 11px · badge/CTA pill 999px/16px
/* Spacing */ screen padding 64/24/30 · section gaps 7–18px
```

## Assets
- **`modveon-logo-cropped.png`** — the Modveon wordmark+mark. Original was supplied on a 1280×720 black canvas; auto-cropped to a tight 535×101 PNG.
  - **Background removal is done in CSS, not in the file** — the PNG still has a black background. It is placed with `mix-blend-mode: screen`, which renders pure black as transparent on a darker background while keeping the white logo. For your codebase, **prefer exporting a real transparent-PNG/SVG** of the logo; `mix-blend-mode:screen` only works on dark backgrounds. If you must reuse this asset on light surfaces, get a transparent version instead.
- **Icons:** `lucide` set — `shield-check`, `user`, list/`align-justify`, `share-2`. Use your existing icon library's equivalents.

## Files
- `Citizen Agent.dc.html` — the prototype (markup + inline styles + theming logic). Read it for exact structure.
- `modveon-logo-cropped.png` — logo asset.
- `ios-frame.jsx` — the device-bezel wrapper used only for presentation (status bar, Dynamic Island, home indicator). **Not part of the product UI** — your app renders inside a real device, so drop the bezel and build only the screen content.
