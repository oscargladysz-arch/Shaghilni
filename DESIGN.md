---
name: Shaghilni
description: Verified jobs and internships in Syria, in Arabic and English, on any phone.
colors:
  qasioun-pine: '#0E6B46'
  qasioun-pine-deep: '#0B5B3B'
  on-pine: '#FFFFFF'
  pine-soft: rgba(14,107,70,.09)
  pine-line: rgba(14,107,70,.26)
  amber-notice: '#9A5A00'
  amber-soft: rgba(168,97,0,.11)
  rose-alert: '#B42318'
  rose-soft: rgba(180,35,24,.08)
  noticeboard-paper: '#F4F4F2'
  card-white: '#FFFFFF'
  quiet-white: '#F8F8F6'
  pressed-grey: '#ECECE9'
  charcoal-ink: '#151718'
  slate-ink: '#44484C'
  muted-ink: '#63686D'
  faint-ink: '#9A9FA3'
  hairline: rgba(21,23,24,.08)
  hairline-strong: rgba(21,23,24,.13)
  scrim: rgba(12,13,14,.42)
  qasioun-pine-night: '#34C48A'
  qasioun-pine-night-ink: '#62D8A6'
  on-pine-night: '#04140D'
  amber-notice-night: '#F0A53A'
  rose-alert-night: '#F97066'
  night-ground: '#0D0E0F'
  night-surface: '#151718'
  night-surface-2: '#1A1C1E'
  night-sunk: '#0A0B0C'
  night-ink-1: '#EDEEEF'
  night-ink-2: '#BABFC4'
  night-ink-3: '#8C9298'
  night-ink-4: '#62686E'
typography:
  display:
    fontFamily: '"IBM Plex Sans Arabic", system-ui, -apple-system, "Segoe UI", Roboto, Tahoma, Arial, sans-serif'
    fontSize: 32px  # 28px under the phone media query (public/css/app.css)
    fontWeight: 600
    lineHeight: 1.1
    letterSpacing: -0.022em
  headline:
    fontFamily: '"IBM Plex Sans Arabic", system-ui, -apple-system, "Segoe UI", Roboto, Tahoma, Arial, sans-serif'
    fontSize: 22px
    fontWeight: 600
    lineHeight: 1.5
    letterSpacing: -0.01em
  title:
    fontFamily: '"IBM Plex Sans Arabic", system-ui, -apple-system, "Segoe UI", Roboto, Tahoma, Arial, sans-serif'
    fontSize: 20px
    fontWeight: 600
    lineHeight: 1.5
    letterSpacing: -0.01em
  title-small:
    fontFamily: '"IBM Plex Sans Arabic", system-ui, -apple-system, "Segoe UI", Roboto, Tahoma, Arial, sans-serif'
    fontSize: 17px
    fontWeight: 600
    lineHeight: 1.5
    letterSpacing: -0.01em
  subtitle:
    fontFamily: '"IBM Plex Sans Arabic", system-ui, -apple-system, "Segoe UI", Roboto, Tahoma, Arial, sans-serif'
    fontSize: 15px
    fontWeight: 600
    lineHeight: 1.5
  body:
    fontFamily: '"IBM Plex Sans Arabic", system-ui, -apple-system, "Segoe UI", Roboto, Tahoma, Arial, sans-serif'
    fontSize: 15px
    fontWeight: 400
    lineHeight: 1.5
  body-small:
    fontFamily: '"IBM Plex Sans Arabic", system-ui, -apple-system, "Segoe UI", Roboto, Tahoma, Arial, sans-serif'
    fontSize: 13px
    fontWeight: 400
    lineHeight: 1.5
  control:
    fontFamily: '"IBM Plex Sans Arabic", system-ui, -apple-system, "Segoe UI", Roboto, Tahoma, Arial, sans-serif'
    fontSize: 14px
    fontWeight: 600
    lineHeight: 1.5
  label:
    fontFamily: '"IBM Plex Sans Arabic", system-ui, -apple-system, "Segoe UI", Roboto, Tahoma, Arial, sans-serif'
    fontSize: 12px
    fontWeight: 600
    lineHeight: 1.5
    letterSpacing: 0.012em
rounded:
  sm: 8px
  control: 10px
  md: 12px
  lg: 20px
  pill: 999px
spacing:
  xs: 4px
  sm: 6px
  md: 8px
  md-plus: 10px
  lg: 12px
  xl: 16px
  2xl: 24px
components:
  button:
    backgroundColor: '{colors.card-white}'
    textColor: '{colors.charcoal-ink}'
    typography: '{typography.control}'
    rounded: '{rounded.control}'
    padding: 0 16px
    height: 40px
  button-primary:
    backgroundColor: '{colors.qasioun-pine}'
    textColor: '{colors.on-pine}'
    typography: '{typography.control}'
    rounded: '{rounded.control}'
    padding: 0 16px
    height: 40px
  button-primary-hover:
    backgroundColor: '#0C5E3E'
  button-soft:
    backgroundColor: '{colors.pine-soft}'
    textColor: '{colors.qasioun-pine-deep}'
    typography: '{typography.control}'
    rounded: '{rounded.control}'
    padding: 0 16px
    height: 40px
  button-ghost:
    backgroundColor: transparent
    textColor: '{colors.slate-ink}'
    typography: '{typography.control}'
    rounded: '{rounded.control}'
    padding: 0 16px
    height: 40px
  input:
    backgroundColor: '{colors.card-white}'
    textColor: '{colors.charcoal-ink}'
    typography: '{typography.body}'
    rounded: '{rounded.control}'
    padding: 10px 12px
    height: 44px
  chip:
    backgroundColor: '{colors.pressed-grey}'
    textColor: '{colors.slate-ink}'
    rounded: '{rounded.pill}'
    padding: 4px 10px
    height: 28px
  chip-selected:
    backgroundColor: '{colors.qasioun-pine}'
    textColor: '{colors.on-pine}'
  pill:
    backgroundColor: '{colors.pressed-grey}'
    textColor: '{colors.slate-ink}'
    typography: '{typography.label}'
    rounded: '{rounded.pill}'
    padding: 2px 9px
    height: 22px
  pill-verified:
    backgroundColor: '{colors.pine-soft}'
    textColor: '{colors.qasioun-pine-deep}'
  pill-pending:
    backgroundColor: '{colors.amber-soft}'
    textColor: '{colors.amber-notice}'
  card:
    backgroundColor: '{colors.card-white}'
    rounded: '{rounded.lg}'
    padding: 18px
  job-row:
    rounded: '{rounded.md}'
    padding: 12px 10px
  job-row-selected:
    backgroundColor: '{colors.pine-soft}'
  company-tile:
    textColor: '{colors.card-white}'
    typography: '{typography.label}'
    rounded: '{rounded.control}'
    size: 40px
  nav-item:
    textColor: '{colors.slate-ink}'
    typography: '{typography.control}'
    rounded: '{rounded.sm}'
    padding: 0 10px
    height: 38px
  nav-item-current:
    backgroundColor: '{colors.card-white}'
    textColor: '{colors.charcoal-ink}'
  tab-item:
    textColor: '{colors.muted-ink}'
    typography: '{typography.label}'
  tab-item-current:
    textColor: '{colors.qasioun-pine}'
---

# Design System: Shaghilni

## Overview

**Creative North Star: "The Verified Noticeboard"**

Shaghilni looks like a public noticeboard that someone has already checked. Plain paper, notices pinned in clean rows, and a quiet green mark on everything that has been verified. The design recedes so that what people came for (the job, what it pays, who is hiring and where each application stands) is what they read first. The feel is calm, plain and trustworthy: nothing flashy competes with a stressful search, and nothing looks like an advertisement.

It is a working tool, built for a cheap Android phone held in one hand, often on a slow connection. Density is compact but never cramped: rows scan quickly, text never drops below 12px, and every state is spelled out in words as well as colour. Arabic comes first, so every layout mirrors cleanly from right to left, and light and dark mode come from the same set of tokens rather than separate designs.

One accent carries meaning. Qasioun Pine marks the primary action, the current selection and anything verified; amber marks what is pending or sponsored; rose marks errors and destructive actions. Everything else is ink on paper.

**Key Characteristics:**
- One family (IBM Plex Sans Arabic) for every role, in both scripts.
- One accent, Qasioun Pine, used only for action, selection and verified status.
- Layered depth: soft paper ground, white surfaces, hairline rings instead of borders.
- Gently rounded forms at five fixed sizes; pills for status and counts.
- Compact rows built for scanning on small phones; right-to-left first.

## Colors

A warm neutral paper-and-ink palette with a single deep green accent and two quiet state colours.

### Primary
- **Qasioun Pine**: the primary button, selected filter chips, the current tab, verified and positive status, and fit rings. Named after the mountain above Damascus. In dark mode it brightens to Qasioun Pine Night so it keeps its presence on a dark ground.
- **Deep Pine**: pine-coloured text and links on light surfaces (soft buttons, verified pills), where the brighter pine would be too light to read.
- **On Pine**: text and icons placed on Qasioun Pine. White in light mode, near-black in dark mode, because the night pine is bright.
- **Pine Soft / Pine Line**: tinted backgrounds for selected rows, verified badges and soft buttons, and their matching outlines.

### Secondary
- **Amber Notice**: pending states (a verification waiting, a request sent), sponsored labels and demo notices, always on Amber Soft.
- **Rose Alert**: errors, failed payments and destructive actions such as deleting an account, on Rose Soft where a background is needed.

### Neutral
- **Noticeboard Paper**: the ground behind everything.
- **Card White**: cards, sheets, inputs and the current navigation item.
- **Quiet White**: secondary panels and row hover.
- **Pressed Grey**: filter tracks, chips and pills at rest.
- **Charcoal Ink**: headings and primary text.
- **Slate Ink**: body text, the default text colour.
- **Muted Ink**: secondary text such as company and place lines, captions and tab labels.
- **Faint Ink**: disabled controls and decorative marks only, never text.
- **Hairline / Hairline Strong**: the rings that separate surfaces and the outlines of inputs.

### Named Rules
**The One Pine Rule.** Qasioun Pine means "act here", "you are here" or "this is verified". It is never decoration, and a screen has at most one primary pine button per area.

**The Ink Floor Rule.** No text is lighter than Muted Ink, in either mode. Faint Ink is for disabled controls and decoration only, so every piece of text clears 4.5:1 on every surface it sits on.

**The Same Tokens, Both Lights Rule.** Dark mode is the same tokens with night values, never hand-picked colours. Text on pine always uses On Pine, and nothing hard-codes white or a fallback colour. (Stage 0 counted 28 hex colours outside the token block in the shipped CSS, the ticket QR background among them, which must stay white for scanners, plus a handful of fallback colours in the scripts; the Stage 2 ratchet test records those counts and only lets them fall.)

## Typography

**Display Font:** IBM Plex Sans Arabic (with system-ui, Segoe UI, Roboto, Tahoma, Arial)
**Body Font:** IBM Plex Sans Arabic

**Character:** One self-hosted family carries Arabic and Latin with equal care. Weight does the work (600 for anything you scan for, 400 for reading), so there is no second typeface to compete with the content.

### Hierarchy
- **Display**: the welcome screen's headline only.
- **Headline**: page titles ("Jobs in Syria", "Your applications", a company's name).
- **Title**: titles of sheets and dialogs, and the main column heading on the resume page.
- **Title Small**: section and card headings.
- **Subtitle**: sub-headings inside a card or column, and job titles in lists.
- **Body**: reading text, at the default Slate Ink.
- **Body Small**: meta lines (company and place, dates), helper text and captions.
- **Control**: buttons and navigation items.
- **Label**: pills, badges, counts, tab-bar labels and fact labels; the smallest size in the system.

### Named Rules
**The Twelve-Pixel Floor.** Nothing is smaller than the Label size (12px), including badges, counts and tab labels.

**The Clear Step Rule.** Each heading level is visibly bigger than the next (28, 22, 20, 17, 15). Two roles never share a size and weight within one view.

## Layout

The layout is mobile-first and task-first. On phones, a bottom tab bar (64px high) holds the four or five main destinations, pages scroll in one column, and job details, quick apply and other focused tasks open as sheets that slide up from the bottom. From 900px wide, the tab bar becomes a side rail (232px), and the job board shows the list and the selected job side by side. Content columns stay readable (cards and reading pages run around 46 to 60rem at most), and wide tables scroll inside their own container rather than the page.

Spacing runs in small steps (4, 6, 8, 10, 12, 16 and 24px). Related items sit 6 to 8px apart, separate groups 12 to 16px, and sections 24px. Every layout is mirrored for Arabic: alignment uses start and end, never left and right.

## Elevation & Depth

Depth comes from layering, not shadows. The paper ground sits lowest, white surfaces sit on it, and each surface is outlined by a one-pixel hairline ring with only a whisper of shadow beneath. Stronger, softer shadows appear only on things that float above the page: popovers, sheets and dialogs, over a dimmed scrim. In dark mode the same layering holds, with the ground darkest and surfaces stepping lighter.

### Shadow Vocabulary
- **Resting** (`0 0 0 1px hairline, 0 1px 2px rgba(0,0,0,.04)`): cards, list cards, the current navigation item and the selected filter segment.
- **Raised** (`0 0 0 1px hairline, 0 6px 16px -4px rgba(0,0,0,.08), 0 2px 4px -2px rgba(0,0,0,.04)`): popovers and menus.
- **Floating** (`0 0 0 1px hairline, 0 28px 56px -16px rgba(0,0,0,.22), 0 10px 20px -10px rgba(0,0,0,.10)`): sheets and dialogs.

### Named Rules
**The Hairline Rule.** Surfaces are separated by a one-pixel hairline ring, never by heavy borders, coloured side stripes or hard offset shadows.

**The One Surface Rule.** Inside a card, a sheet or a column, content sits on that surface as rows divided by hairlines. A box never sits inside another box.

## Shapes

Forms are gently rounded at five fixed sizes: small (8px) for navigation items, control (10px) for buttons, inputs and company tiles, medium (12px) for list rows, large (20px) for cards and sheets, and fully rounded pills (999px) for status badges, filter chips and counts. Avatars and fit rings are circles. Sheets on phones round only their top corners.

## Components

### Buttons
Familiar, solid and unhurried: a button looks like a button and says exactly what it does.
- **Shape:** control radius (10px), 40px high (48px for the main action at the bottom of a sheet).
- **Primary:** Qasioun Pine with On Pine text, Control type, and a subtle inner highlight. One per area.
- **Soft:** Pine Soft with Deep Pine text, for the useful second action ("Tailor my resume for this job", "See plans").
- **Default:** Card White with a hairline ring, for neutral actions. **Ghost:** no background, Slate Ink text, for quiet actions in toolbars.
- **States:** hover darkens the fill by 12% (only on devices with a fine pointer); pressing scales to 97%; keyboard focus draws a 2px pine outline offset by 2px; disabled drops to half opacity.

### Chips and Pills
- **Filter chips:** Pressed Grey at rest, Qasioun Pine with On Pine text when selected, 28px high, with a count beside the label.
- **Pills:** 22px status badges in Label type: neutral on Pressed Grey, verified and positive on Pine Soft with Deep Pine, pending and sponsored on Amber Soft with Amber Notice.

### Cards and Containers
- **Corner Style:** large (20px).
- **Background:** Card White on Noticeboard Paper.
- **Shadow Strategy:** Resting (see Elevation & Depth).
- **Internal Padding:** 18px; lists inside a card become rows divided by hairlines.

### Inputs and Fields
- **Style:** Card White, control radius (10px), at least 44px high, outlined by an inset Hairline Strong ring; placeholders in Muted Ink.
- **Focus:** the ring becomes 1.5px Qasioun Pine with a 4px Pine Soft halo, and the text cursor is pine.
- **Error:** the message sits under the field in Rose Alert, naming the problem and how to fix it.

### Navigation
- **Phones:** a bottom tab bar of icon-over-label items in Label type, Muted Ink at rest and Qasioun Pine for the current tab, with a small pine count badge when something is new.
- **Wide screens:** a side rail of 38px items in Control type, with icons; the current item is Card White on the paper ground with the Resting shadow; hover (fine pointers only) tints the item Pressed Grey.

### Job Row (signature component)
The heart of the noticeboard. Each job is a row: a 40px company tile with the company's initials, the job title in Subtitle, a Body Small meta line (company and place), the monthly pay in the same small size at weight 600, a fit ring showing how well it suits you, and a bookmark. The selected row tints to Pine Soft; hover (fine pointers only) tints to Quiet White. Sponsored jobs carry a small amber "Sponsored" tag and appear first only for people they fit well.

### Fit Ring
A 22px circular gauge in Qasioun Pine on Pressed Grey, beside a percentage. The detailed version in a job's sheet explains the score in words, so the ring is never the only way the information is given.

## Do's and Don'ts

### Do:
- **Do** use Qasioun Pine only for the primary action, the current selection and verified status, with text on it in On Pine.
- **Do** keep every piece of text at 12px or more, and no lighter than Muted Ink.
- **Do** separate surfaces with hairline rings and, inside a surface, with hairline dividers between rows.
- **Do** step headings clearly: 28 (welcome), 22 (page), 20 (sheet), 17 (section), 15 (sub-heading and body).
- **Do** take every colour from the tokens, so light and dark mode stay correct automatically.
- **Do** lay out with start and end, so every screen mirrors for Arabic.
- **Do** draw icons from the app's single 24px stroke set, never with emoji or text symbols. (The job header's three category markers still use emoji today and are to be replaced: `public/js/app.js`, see `docs/agent/DOC_DRIFT.md`.)

### Don't:
- **Don't** put a card, tile or bordered box inside another card, sheet or column.
- **Don't** use a thick coloured stripe down one side of a card, message or alert.
- **Don't** stack an icon in a rounded tile above a heading; put the icon beside the words or leave it out.
- **Don't** put a small label above a heading; the heading speaks for itself, with any meta line underneath.
- **Don't** hard-code white, hex colours or fallback colours in component styles.
- **Don't** use Faint Ink for text, or set any text below 12px.
- **Don't** use hard offset shadows, coloured glows, glass effects or gradient text.
