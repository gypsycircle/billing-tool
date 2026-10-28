// lib/server/pdf/theme.ts
// The Bill of Supply's page, type and colours: the booking page's bill
// ("Ledger & Ink") in print-friendly form, white page, light grey band, ink
// text and rules, grey labels. Units are PDF points; layout.ts works top-down
// (y grows down the page) and render.ts flips to PDF space.

import "server-only";

/** A4 */
export const PAGE_WIDTH = 595.28;
export const PAGE_HEIGHT = 841.89;
/** The same on all four sides: the card's border sits this far from each edge. */
export const MARGIN = 18;

export type FontKey = "sans" | "sansMedium" | "sansSemibold" | "serif" | "serifItalic";
export type Rgb = readonly [number, number, number];

const hex = (value: string): Rgb => [0, 2, 4].map((i) => parseInt(value.slice(i + 1, i + 3), 16) / 255) as unknown as Rgb;

export const COLORS = {
  /** The app's deep navy ink: prints as near-black. */
  ink: hex("#1b2230"),
  muted: hex("#5d6470"),
  /** The ₹ sign, like the app's Money (70% opacity on white). */
  rupee: hex("#767c86"),
  band: hex("#f1f1f0"),
  hairline: hex("#d8d8d6"),
  /** Table rules, like the app's border-foreground/80. */
  strongRule: hex("#3d4350"),
} as const;

/** Tracked uppercase label (the app's `eyebrow`): 0.14em letter-spacing. */
export const EYEBROW = { font: "sansSemibold" as FontKey, size: 6.75, tracking: 0.14 };

export const TYPE = {
  body: 9.25,
  small: 8,
  tiny: 7.25,
  companyName: 19,
  customerName: 17,
  words: 10.5,
} as const;

export const RULES = { hairline: 0.6, strong: 1.4 } as const;

/** private-templates/images/logo.png is 900 × 304 px (scripts/pdf/build_assets.py). */
export const LOGO = { width: 100, height: 100 * (304 / 900) } as const;
/** The QR code's drawn size, not counting its white quiet zone. */
export const QR_SIZE = 58;
/** upi-qr.png: 29 modules at 8 px plus a 4-module quiet zone each side (296 px). */
export const QR_QUIET = 32 / 232;
/** The PhonePe / GPay / Paytm / UPI strip, 766 × 50 px. */
export const UPI_APPS = { width: 124, height: 124 * (50 / 766) } as const;

/**
 * OpenType features for measuring AND drawing (they must agree). Kerning
 * stays on; ligatures and contextual alternates are off: Geist's "tt" and
 * Fraunces' "Th"/"sh" draw with gaps and extract wrongly in PDF viewers.
 */
export const FONT_FEATURES = { kern: true, liga: false, clig: false, calt: false, dlig: false } as const;

/** The card that holds the whole bill: radius and inner padding. */
export const CARD = { radius: 6, padX: 14, padY: 12 } as const;

/** Lowest point any content may reach: inside the card's bottom padding. */
export const BOTTOM_LIMIT = PAGE_HEIGHT - MARGIN - CARD.padY;
