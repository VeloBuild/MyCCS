---
name: MyCCS
description: Centralized College of Information Technology and Computer Science (CCS — IT, CS, and LIS) mobile & admin design system derived from the official CCS department crest (Deep Crest Navy, Circuit Royal Blue, Shield Cyan, and Laurel Gold).
colors:
  crest-navy: "#0B2E59"
  circuit-blue: "#0052CC"
  circuit-blue-deep: "#003E9E"
  circuit-tint: "#EBF3FF"
  circuit-border: "#ADC9FA"
  shield-cyan: "#0EA5E9"
  laurel-gold: "#D4A500"
  laurel-gold-ink: "#856404"
  laurel-gold-soft: "#FEF9E2"
  laurel-gold-border: "#EDD477"
  present-emerald: "#067647"
  present-emerald-soft: "#ECFDF3"
  absent-crimson: "#B42318"
  absent-crimson-soft: "#FEF3F2"
  crest-canvas: "#F6F9FD"
  paper-white: "#FFFFFF"
  slate-well: "#EDF2F9"
  studio-blue: "#E4ECF7"
  crest-rule: "#DCE5F2"
  crest-rule-strong: "#C2D1E5"
  ink-primary: "#0B192C"
  ink-secondary: "#415166"
  ink-muted: "#5C6D82"
  auditorium-navy: "#0B2545"
  auditorium-elevated: "#133561"
  dark-ink: "#F4F8FD"
  dark-ink-muted: "#9DB7D8"
typography:
  display:
    fontFamily: "Public Sans, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.025em"
  headline:
    fontFamily: "Public Sans, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "-0.015em"
  title:
    fontFamily: "Public Sans, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: "normal"
  body:
    fontFamily: "Public Sans, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.48
    letterSpacing: "normal"
  label:
    fontFamily: "Public Sans, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "0.02em"
  data-mono:
    fontFamily: "JetBrains Mono, ui-monospace, SFMono-Regular, Menlo, monospace"
    fontSize: "0.8125rem"
    fontWeight: 600
    lineHeight: 1.35
    letterSpacing: "0.04em"
rounded:
  sm: "8px"
  md: "12px"
  lg: "18px"
  deck: "20px"
  pill: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "20px"
  xxl: "24px"
components:
  button-primary:
    backgroundColor: "{colors.crest-navy}"
    textColor: "{colors.paper-white}"
    rounded: "{rounded.pill}"
    padding: "0 16px"
    height: "44px"
  button-primary-hover:
    backgroundColor: "{colors.circuit-blue}"
    textColor: "{colors.paper-white}"
  button-secondary:
    backgroundColor: "{colors.paper-white}"
    textColor: "{colors.ink-primary}"
    rounded: "{rounded.pill}"
    padding: "0 16px"
    height: "44px"
  button-dark:
    backgroundColor: "{colors.auditorium-navy}"
    textColor: "{colors.dark-ink}"
    rounded: "{rounded.pill}"
    padding: "0 16px"
    height: "44px"
  input-field:
    backgroundColor: "{colors.paper-white}"
    textColor: "{colors.ink-primary}"
    rounded: "{rounded.md}"
    padding: "10px 12px"
    height: "44px"
  passbook-sheet:
    backgroundColor: "{colors.paper-white}"
    textColor: "{colors.ink-primary}"
    rounded: "{rounded.lg}"
    padding: "14px 16px"
  bottom-nav:
    backgroundColor: "{colors.paper-white}"
    textColor: "{colors.ink-muted}"
    height: "64px"
    padding: "4px 6px 8px"
---

# Design System: MyCCS

## Overview

**Creative North Star: "The CCS Crest & Editorial Lanyard"** *(Locked Default — CCS Crest)*

MyCCS translates the official College of Information Technology and Computer Science (CCS — IT, CS, and LIS) crest—Deep Crest Navy, Circuit Royal Blue, Shield Cyan, and Laurel Gold—into a crisp, high-contrast academic utility built for sunlit hallways and zero-connectivity auditorium doors. Every screen follows a strict **60:30:10 color ratio**: 60% calm ice-white and white surfaces, 30% Deep Crest Navy structure and slate typography, and ≤10% Circuit Royal Blue, Shield Cyan, and Laurel Gold focal accents.

Calm daylight workflows sit on cool ice-white surfaces (`#F6F9FD` canvas, `#FFFFFF` ruled sheets) with crisp hairline dividers (`#DCE5F2`) and underline category tabs. When officers open the offline QR door scanner, the interface switches cleanly into Auditorium Navy (`#0B2545`) with a `#38BDF8` cyan scan beam and gold offline-queue pill (`#FDE047` on translucent gold) for glare-free legibility in dim venues.

**Key Characteristics:**
- Official CCS crest color grammar: Deep Crest Navy (`#0B2E59`), Circuit Royal Blue (`#0052CC`), Shield Cyan (`#0EA5E9`), and Laurel Gold (`#D4A500`).
- Full-pill primary and secondary buttons (`999px`) paired with editorial underline category tabs and stacked color-block hero decks (`20px`).
- ISO-strict semantic status hues where Present (`#067647`), Late/Pending (`#856404` on `#FEF9E2`), and Absent/Rejected (`#B42318`) each own one unshared hue + text label.
- Identical `64px` bottom tab registration across all post-auth Student and Org Officer screens.
- Monospace typography reserved strictly for verifiable data: 6-digit OTPs, opaque signed QR tokens, masked GMetrix keys, and server clock offsets.

## Colors

A disciplined cool-white neutral ground powered by the four-color CCS department crest palette.

### Primary
- **Deep Crest Navy** (`crest-navy`): Primary full-pill CTAs, lanyard woven strap, hero deck anchor, and org cover depth.
- **Circuit Royal Blue** (`circuit-blue` / `circuit-blue-deep`): Primary CTA hover, active bottom tab indicator, underline tab accent, student ID footer band, and evaluation bar fills.
- **Circuit Tint** (`circuit-tint`) & **Circuit Border** (`circuit-border`): Soft blue wells for conditional `visibleIf` form fields, selected choice tiles, and active focus halos.

### Secondary
- **Shield Cyan** (`shield-cyan`): Mid-layer stacked deck peek, org cover highlight, and dark scanner beam (`#38BDF8` on navy).
- **Laurel Gold** (`laurel-gold`, `laurel-gold-ink`, `laurel-gold-soft`, `laurel-gold-border`): Back-layer stacked deck peek, key-ready icon badge (`#0B192C` icon on `#D4A500`), lanyard gold weave lettering, offline queue dot, and Late/Pending badges (`#856404` ink on `#FEF9E2` for ≥4.5:1 AA contrast).
- **Present Emerald** (`present-emerald` / `present-emerald-soft`): Present attendance windows, verified `@lpunetwork.edu.ph` checks, offline readiness cards, and approved applicants.
- **Absent Crimson** (`absent-crimson` / `absent-crimson-soft`): Absent attendance windows, rejected applicants, invalid QR scans, and destructive outline actions.

### Neutral
- **Crest Canvas** (`crest-canvas`), **Paper White** (`paper-white`), and **Slate Well** (`slate-well`): Three-step daylight surface hierarchy.
- **Crest Rule** (`crest-rule` / `crest-rule-strong`): `1px` cool-blue structural dividers and input borders.
- **Ink Primary** (`ink-primary`), **Ink Secondary** (`ink-secondary`), and **Ink Muted** (`ink-muted`): High-contrast navy-tinted slate inks (≥4.5:1 AA).
- **Auditorium Navy** (`auditorium-navy` / `auditorium-elevated`) with **Dark Ink** (`dark-ink` / `dark-ink-muted`): Dedicated dark auditorium scanner and lanyard credential header.

### Named Rules
**The 60:30:10 Proportion Rule.** Every screen allocates visual area strictly as:
- **60% Dominant (Calm Ground):** Crest Canvas (`#F6F9FD`) and Paper White (`#FFFFFF`) on light screens; Auditorium Navy (`#0B2545`) on the dark offline QR scanner.
- **30% Secondary (Structure & Ink):** Deep Crest Navy (`#0B2E59`) primary pills/headers/lanyard straps, Slate Wells (`#EDF2F9`), `1px` Crest Rules (`#DCE5F2`), and navy-slate ink hierarchy (`#0B192C`, `#415166`, `#5C6D82`) — or Elevated Navy (`#133561`) + crisp white result sheet in dark scanner mode.
- **10% Accent (Signal & Focal Points):** Circuit Royal Blue (`#0052CC`) active states/bars, Shield Cyan (`#0EA5E9` / `#38BDF8`) deck peeks & scanner beam, Laurel Gold (`#D4A500` / `#856404`) crest highlights & offline indicators, and semantic status pills (`#067647`, `#B42318`). Accents never exceed 10% of a viewport.

**The Laurel Gold Contrast Rule.** Bright Laurel Gold (`#D4A500`) is reserved for graphic accents, peek decks, dark-background highlights, and icon badges with dark `#0B192C` ink—never as body text on white. On light surfaces, use Laurel Gold Ink (`#856404`) over `#FEF9E2`.

**The Unshared Status Rule.** Present Emerald (`#067647`), Laurel Gold Ink (`#856404`), and Absent Crimson (`#B42318`) always pair with explicit text labels (`Present`, `Late`, `Absent`, `Pending`, `Approved`, `Rejected`).

## Typography

**Display Font:** Public Sans (with `-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif` fallback)
**Body Font:** Public Sans (with `-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif` fallback)
**Label/Mono Font:** JetBrains Mono (with `ui-monospace, SFMono-Regular, Menlo, monospace` fallback)

**Character:** Utilitarian neo-grotesque clarity for all UI headings and controls paired with JetBrains Mono strictly for verifiable cryptographic and timing data.

### Hierarchy
- **Display** (700, `1.5rem` / 24px, line-height `1.2`, tracking `-0.025em`): Primary screen headings.
- **Headline** (700, `1.0625rem` / 17px, line-height `1.25`, tracking `-0.015em`): Sheet headers and panel titles.
- **Title** (700, `0.9375rem` / 15px, line-height `1.3`): Announcement titles, org names, event rows, top bar titles.
- **Body** (400, `0.875rem` / 14px, line-height `1.48`, max measure 65–75ch): Descriptions, notices, and form copy.
- **Label** (600, `0.75rem` / 12px, line-height `1.3`): Form labels, timestamps, badges, and bottom tab labels.
- **Data Mono** (600, `0.8125rem` / 13px, line-height `1.35`, `tabular-nums`): OTP digits, signed QR tokens, masked GMetrix keys, and clock offsets.

### Named Rules
**The Self-Hosted Fonts Rule (GDPR & RA 10173).** Never load fonts from Google Fonts CDN or any third-party font CDN. Bundle `Public Sans` and `JetBrains Mono` locally inside the application (`expo-font` / local `.ttf`/`.otf` assets in the Expo mobile app; self-hosted `.woff2` or `@fontsource/*` packages in `web-admin/` and static web surfaces) so zero student or faculty IP addresses are sent to external servers and offline rendering is guaranteed.

**The Honest Mono Rule.** Monospace is used strictly for code, tokens, OTP digits, keys, and measurements—never as decorative heading styling.

## Layout

Mobile screens target `390×844` with `20px` horizontal padding, `16px` section spacing, `44px` minimum touch targets, and fixed `64px` bottom tab registration across all post-auth Student and Org Officer screens.

## Elevation & Depth

Flat by default (`1px solid #DCE5F2` rules and tonal contrast). Shadows appear strictly on the hanging physical QR lanyard badge (`0 12px 28px rgba(15, 23, 42, 0.12)`), stacked color-block deck offset layers (`0 -6px 0 -2px #0EA5E9, 0 -11px 0 -5px #D4A500`), and transient toasts.

### Named Rules
**The Flat Ledger Rule.** Standard lists, forms, announcements, and metric sheets carry zero drop shadow and zero nested cards—separate rows with `1px solid #DCE5F2` horizontal rules inside one container.

## Shapes

- **Buttons:** Full pill (`999px`, `44px` height)
- **Inputs & choice tiles:** Rounded `12px` (`rounded.md`)
- **Ruled sheets:** Rounded `18px` (`rounded.lg`)
- **Stacked color-block hero decks:** Rounded `20px` (`rounded.deck`)
- **Status badges & checkboxes:** Rounded `8px` (`rounded.sm`)

## Components

### Buttons
- **Shape:** Full pill (`999px`), `44px` minimum height.
- **Primary:** Deep Crest Navy (`#0B2E59`) with white text, shifting to Circuit Royal Blue (`#0052CC`) on hover.
- **Secondary:** Paper White (`#FFFFFF`) with `#0B192C` text and `1px solid #C2D1E5` border.
- **Focus:** `2px solid #0052CC` outline with `2px` offset.

### Navigation
- **Category Tabs:** Horizontal underline tabs with `2.5px` Circuit Royal Blue (`#0052CC`) active indicator and `#0B2E59` active label.
- **Bottom Tab Bar:** Fixed `64px` height, 5 equal columns, `1.8px`-stroke inline SVGs, active Circuit Royal Blue (`#0052CC`) icon + centered `26×3px` top bar.

### Stacked Crest Deck & Lanyard QR Badge
- **Stacked Crest Deck:** Deep Crest Navy → Circuit Royal Blue card (`20px` radius) with offset Shield Cyan (`#0EA5E9`) and Laurel Gold (`#D4A500`) peek layers behind the top edge.
- **Lanyard QR Badge:** Deep Crest Navy lanyard strap with Laurel Gold (`#F4D03F`) weave text, dark navy ID header, crisp zero-PII SVG QR code, Circuit Royal Blue `STUDENT · Works offline` band, and 3D Y-axis flip to recent attendance.

## Do's and Don'ts

### Do:
- **Do** enforce the **60:30:10** visual budget on every screen (60% `#F6F9FD`/`#FFFFFF` ground, 30% `#0B2E59`/slate structure, ≤10% `#0052CC`/`#0EA5E9`/`#D4A500` accents).
- **Do** pair Laurel Gold (`#D4A500`) graphic accents with dark `#0B192C` foregrounds and use `#856404` on `#FEF9E2` for text badges.
- **Do** maintain ≥4.5:1 contrast across all daylight (`#F6F9FD`/`#FFFFFF`) and dark auditorium (`#0B2545`) surfaces.
- **Do** use flat `1px` rules (`#DCE5F2`) inside single white sheets instead of nested cards.
- **Do** self-host and bundle `Public Sans` and `JetBrains Mono` locally in the app (`expo-font` / `@fontsource/*` / local `.woff2`) for GDPR and RA 10173 compliance and offline reliability.
- **Do** reserve `JetBrains Mono` strictly for verifiable data and `tabular-nums` for live counts.

### Don't:
- **Don't** flood full screens or multiple stacked sections with saturated `#0052CC`, `#0EA5E9`, or `#D4A500` fills—keep accents within the 10% budget.
- **Don't** set light yellow/gold text directly on white backgrounds.
- **Don't** place marketing eyebrows above headings or add zero-offset glowing shadows on dark scanner elements.
- **Don't** use Unicode emoji as UI icons—use `1.8px`-stroke inline SVGs.
- **Don't** load fonts from Google Fonts CDN or any external third-party CDN (violates GDPR IP-disclosure rules and breaks offline venues).
- **Don't** expose raw PII in QR codes or raw GMetrix keys in push alerts.
