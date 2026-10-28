// lib/server/pdf/layout.ts
// Lays out the Bill of Supply top to bottom, like the bill on the booking
// page: header, the bill card (invoice band, bill to / trip, services table,
// notes and totals), bank details and payment QR code, then the terms.
//
// Text is measured exactly as render.ts draws it (fontkit's kerned layout),
// wraps where a browser would (after spaces and hyphens), and shrinks in
// 0.25 pt steps down to a field's minimum size. A value that still doesn't fit
// is reported as a problem on the booking field the user edits; it is never
// drawn outside its place, and the bill always stays on one page.

import "server-only";

import type { Font } from "@pdf-lib/fontkit";
import type { BookingInput } from "@/lib/domain/types";
import type { ImageKey } from "./assets";
import { BANK_DETAILS, COMPANY, TERMS, UPI_ID } from "./company";
import type { BillContent } from "./content";
import {
  BOTTOM_LIMIT,
  CARD,
  COLORS,
  EYEBROW,
  LOGO,
  MARGIN,
  PAGE_HEIGHT,
  PAGE_WIDTH,
  QR_QUIET,
  QR_SIZE,
  RULES,
  TYPE,
  UPI_APPS,
  FONT_FEATURES,
  type FontKey,
  type Rgb,
} from "./theme";

export type Faces = Record<FontKey, Font>;

export interface PlacedLine {
  text: string;
  /** Left edge of the text, in points. */
  x: number;
  /** Baseline, in points from the top of the page. */
  baseline: number;
  size: number;
  font: FontKey;
  color: Rgb;
  /** Extra space after each glyph but the last, in points. */
  letterSpacing: number;
}

/** Shapes in top-down coordinates (y grows down the page). */
export type Shape =
  | { kind: "path"; path: string; fill?: Rgb; stroke?: Rgb; strokeWidth?: number }
  | { kind: "line"; x1: number; y1: number; x2: number; y2: number; width: number; color: Rgb }
  | { kind: "image"; image: ImageKey; x: number; top: number; width: number; height: number };

/** Messages keyed by the booking field to edit (first problem per field). */
export type BillProblems = Partial<Record<keyof BookingInput, string>>;

interface BillLayout {
  lines: PlacedLine[];
  shapes: Shape[];
  problems: BillProblems;
  /** Where the content ends (must stay above BOTTOM_LIMIT). */
  bottom: number;
}

const SIZE_STEP = 0.25;
const EPSILON = 1e-6;

function textWidth(face: Font, text: string, size: number, letterSpacing = 0): number {
  const run = face.layout(text, { ...FONT_FEATURES });
  return (run.advanceWidth / face.unitsPerEm) * size + letterSpacing * Math.max(run.glyphs.length - 1, 0);
}

/** Characters the font can't draw (or control characters), each listed once. */
function unprintable(face: Font, text: string): string[] {
  const bad = new Set<string>();
  for (const char of text) {
    const code = char.codePointAt(0)!;
    if (code < 0x20 || (code >= 0x7f && code <= 0x9f) || !face.hasGlyphForCodePoint(code)) bad.add(char);
  }
  return [...bad];
}

/** Greedy wrap after spaces and hyphens. null if a word is wider than the field or lines run out. */
function wrap(face: Font, text: string, size: number, maxWidth: number, maxLines: number): string[] | null {
  const fits = (line: string) => textWidth(face, line.trimEnd(), size) <= maxWidth + EPSILON;
  if (fits(text)) return [text];
  if (maxLines === 1) return null;

  const lines: string[] = [];
  let line = "";
  for (const token of text.split(/(?<=[ -])/)) {
    if (line && !fits(line + token)) {
      lines.push(line.trimEnd());
      if (lines.length === maxLines) return null; // no room left for this token
      line = token;
    } else {
      line += token;
    }
    if (!fits(line)) return null;
  }
  lines.push(line.trimEnd());
  return lines.length <= maxLines ? lines : null;
}

/** A value with room to wrap and shrink, and the booking field that owns it. */
interface FieldSpec {
  font: FontKey;
  size: number;
  /** Smallest size the value may shrink to before it is refused. */
  minSize: number;
  maxWidth: number;
  maxLines: number;
  /** Line height as a multiple of the size. */
  leading: number;
  align: "left" | "right";
  color: Rgb;
  source: keyof BookingInput;
  label: string;
  /** Message when it doesn't fit (default: "<label> is too long to fit on the bill."). */
  problem?: string;
}

const field = (spec: Omit<FieldSpec, "minSize" | "maxLines" | "leading" | "align" | "color"> & Partial<FieldSpec>): FieldSpec => ({
  minSize: spec.size,
  maxLines: 1,
  leading: 1.3,
  align: "left",
  color: COLORS.ink,
  ...spec,
});

const tooLarge = (label: string) => `${label} is too large to fit on the bill.`;

/** One text piece of a line made of mixed fonts (the terms' "Payment:" lead). */
interface Piece {
  text: string;
  font: FontKey;
}

class BillPage {
  readonly lines: PlacedLine[] = [];
  readonly shapes: Shape[] = [];
  readonly problems: BillProblems = {};

  constructor(readonly faces: Faces) {}

  report(field: keyof BookingInput, message: string): void {
    this.problems[field] ??= message;
  }

  width(text: string, font: FontKey, size: number, letterSpacing = 0): number {
    return textWidth(this.faces[font], text, size, letterSpacing);
  }

  /** Draws one line; x is the left edge, or the right edge when right-aligned. Returns its width. */
  text(text: string, x: number, baseline: number, font: FontKey, size: number, color: Rgb, align: "left" | "right" = "left", letterSpacing = 0): number {
    const width = this.width(text, font, size, letterSpacing);
    if (text) this.lines.push({ text, x: align === "right" ? x - width : x, baseline, size, font, color, letterSpacing });
    return width;
  }

  /** A tracked uppercase label, like the app's `eyebrow`. */
  eyebrow(label: string, x: number, baseline: number, align: "left" | "right" = "left", color: Rgb = COLORS.muted): void {
    const size = EYEBROW.size;
    this.text(label.toUpperCase(), x, baseline, EYEBROW.font, size, color, align, size * EYEBROW.tracking);
  }

  /**
   * Fits a value (wrapping, then shrinking) and draws it from `baseline` down.
   * Returns the last baseline, or `baseline` when it doesn't fit (reported).
   */
  field(text: string, x: number, baseline: number, spec: FieldSpec): number {
    if (!text) return baseline;
    const face = this.faces[spec.font];
    for (let size = spec.size; size >= spec.minSize - EPSILON; size -= SIZE_STEP) {
      const lines = wrap(face, text, size, spec.maxWidth, spec.maxLines);
      if (!lines) continue;
      const lineHeight = size * spec.leading;
      lines.forEach((line, i) => this.text(line, x, baseline + i * lineHeight, spec.font, size, spec.color, spec.align));
      return baseline + (lines.length - 1) * lineHeight;
    }
    this.report(spec.source, spec.problem ?? `${spec.label} is too long to fit on the bill.`);
    return baseline;
  }

  /** "₹17,000" like the app's Money: a smaller, lighter ₹, then the figure. Shrinks to fit maxWidth. */
  money(amount: string, right: number, baseline: number, font: FontKey, size: number, maxWidth: number, source: keyof BookingInput, label: string, color: Rgb = COLORS.ink): void {
    const rupeeFont: FontKey = font === "serif" ? "serif" : "sans";
    const measure = (s: number) => this.width("₹", rupeeFont, s * 0.85) + s * 0.12 + this.width(amount, font, s);
    let s = size;
    while (measure(s) > maxWidth + EPSILON && s - SIZE_STEP >= size * 0.8 - EPSILON) s -= SIZE_STEP;
    if (measure(s) > maxWidth + EPSILON) return this.report(source, tooLarge(label));
    const figure = this.text(amount, right, baseline, font, s, color, "right");
    this.text("₹", right - figure - s * 0.12, baseline, rupeeFont, s * 0.85, COLORS.rupee, "right");
  }

  /** Wraps pieces in mixed fonts into lines no wider than maxWidth. */
  rich(pieces: Piece[], size: number, maxWidth: number): Piece[][] {
    const tokens = pieces.flatMap((piece) => piece.text.split(/(?<=\s)/).filter(Boolean).map((text) => ({ text, font: piece.font })));
    const lines: Piece[][] = [];
    let line: Piece[] = [];
    let used = 0;
    for (const token of tokens) {
      const w = this.width(token.text.trimEnd(), token.font, size);
      if (line.length > 0 && used + w > maxWidth + EPSILON) {
        lines.push(line);
        line = [];
        used = 0;
      }
      line.push(token);
      used += this.width(token.text, token.font, size);
    }
    if (line.length > 0) lines.push(line);
    return lines;
  }

  /** Draws one wrapped line of pieces, merging neighbours in the same font. */
  richLine(line: Piece[], x: number, baseline: number, size: number, color: Rgb): void {
    const merged: Piece[] = [];
    for (const piece of line) {
      const last = merged.at(-1);
      if (last && last.font === piece.font) last.text += piece.text;
      else merged.push({ ...piece });
    }
    merged[merged.length - 1].text = merged[merged.length - 1].text.trimEnd();
    let cursor = x;
    for (const piece of merged) cursor += this.text(piece.text, cursor, baseline, piece.font, size, color);
  }

  line(x1: number, y: number, x2: number, width: number, color: Rgb): void {
    this.shapes.push({ kind: "line", x1, y1: y, x2, y2: y, width, color });
  }
}

/** A rectangle with rounded corners (top and/or bottom), as an SVG path in page coordinates. */
function roundedRect(x: number, y: number, w: number, h: number, r: number, corners: { top: boolean; bottom: boolean }): string {
  const t = corners.top ? r : 0;
  const b = corners.bottom ? r : 0;
  return [
    `M ${x + t} ${y}`,
    `H ${x + w - t}`,
    t ? `Q ${x + w} ${y} ${x + w} ${y + t}` : "",
    `V ${y + h - b}`,
    b ? `Q ${x + w} ${y + h} ${x + w - b} ${y + h}` : "",
    `H ${x + b}`,
    b ? `Q ${x} ${y + h} ${x} ${y + h - b}` : "",
    `V ${y + t}`,
    t ? `Q ${x} ${y} ${x + t} ${y}` : "",
    "Z",
  ]
    .filter(Boolean)
    .join(" ");
}

// ── Checks before layout ────────────────────────────────────────────────────

/** Each value checked against the fonts it is drawn in: shrinking can't fix a missing glyph. */
function checkPrintable(page: BillPage, faces: Faces, c: BillContent): boolean {
  const checks: [string, FontKey[], keyof BookingInput, string][] = [
    [c.invoiceNumber, ["sansMedium"], "invoiceNumber", "Invoice number"],
    [c.destination, ["sansMedium"], "destination", "Destination"],
    [c.customerName, ["serif"], "customerName", "Customer name"],
    [c.customerPhone, ["sans"], "customerPhone", "Mobile number"],
    [c.batchName, ["sans"], "batchName", "Batch name"],
    [c.packageName, ["sansMedium"], "packageName", "Package name"],
    [c.serviceDescription, ["sans"], "routeDescription", "Route"],
    [c.note.join(" "), ["sans"], "invoiceNote", "Invoice note"],
  ];
  let printable = true;
  for (const [text, fonts, source, label] of checks) {
    const bad = [...new Set(fonts.flatMap((font) => unprintable(faces[font], text)))];
    if (bad.length > 0) {
      printable = false;
      const shown = bad.slice(0, 3).map((ch) => `“${ch}”`).join(", ");
      page.report(source, `${label} has characters the bill can't print: ${shown}.`);
    }
  }
  return printable;
}

// ── Sections ────────────────────────────────────────────────────────────────

const LEFT = MARGIN;
const RIGHT = PAGE_WIDTH - MARGIN;
const INNER_LEFT = LEFT + CARD.padX;
const INNER_RIGHT = RIGHT - CARD.padX;
const INNER_WIDTH = INNER_RIGHT - INNER_LEFT;

/** The logo, a thin divider, then "Gypsycircle" with mobile and email beside it. Returns the bottom. */
function header(page: BillPage, top: number): number {
  page.shapes.push({ kind: "image", image: "logo", x: INNER_LEFT, top, width: LOGO.width, height: LOGO.height });
  const dividerX = INNER_LEFT + LOGO.width + 12;
  page.shapes.push({ kind: "line", x1: dividerX, y1: top + 1, x2: dividerX, y2: top + LOGO.height - 1, width: RULES.hairline, color: COLORS.hairline });
  const x = dividerX + 12;
  const nameBaseline = top + 14;
  page.text(COMPANY.name, x, nameBaseline, "serif", TYPE.companyName, COLORS.ink);

  // A clear gap under the name, then the contact line
  const contactBaseline = nameBaseline + 17;
  const parts = [["Mobile: ", COMPANY.mobile], ["Email: ", COMPANY.email]] as const;
  let cursor = x;
  parts.forEach(([label, value], i) => {
    cursor += page.text(label, cursor, contactBaseline, "sans", TYPE.body, COLORS.muted);
    cursor += page.text(value, cursor, contactBaseline, "sans", TYPE.body, COLORS.ink) + (i === 0 ? 10 : 0);
  });
  return Math.max(top + LOGO.height, contactBaseline + 4);
}

/** Grey band: Invoice No. · Invoice date · Due date · Destination. Returns the bottom. */
function invoiceBand(page: BillPage, c: BillContent, top: number): number {
  const columnWidth = INNER_WIDTH / 4;
  const labelBaseline = top + 15;
  const valueBaseline = labelBaseline + 14;
  const cells: [string, string, FieldSpec][] = [
    ["Invoice No.", c.invoiceNumber, field({ font: "sansMedium", size: 10, minSize: 8.5, maxWidth: columnWidth - 10, source: "invoiceNumber", label: "Invoice number" })],
    ["Invoice date", c.invoiceDate, field({ font: "sansMedium", size: 10, maxWidth: columnWidth - 10, source: "invoiceDate", label: "Invoice date" })],
    ["Due date", c.dueDate, field({ font: "sansMedium", size: 10, maxWidth: columnWidth - 10, source: "dueDate", label: "Due date" })],
    ["Destination", c.destination, field({ font: "sansMedium", size: 10, minSize: 8, maxLines: 3, leading: 1.25, maxWidth: columnWidth - 4, source: "destination", label: "Destination" })],
  ];
  let last = valueBaseline;
  cells.forEach(([label, value, spec], i) => {
    const x = INNER_LEFT + i * columnWidth;
    page.eyebrow(label, x, labelBaseline);
    last = Math.max(last, page.field(value, x, valueBaseline, spec));
  });
  return last + 11;
}

/** Bill to (left) and Trip (right). Returns the bottom. */
function billToAndTrip(page: BillPage, c: BillContent, top: number): number {
  const half = INNER_WIDTH / 2 - 12;
  const labelBaseline = top + 7;

  page.eyebrow("Bill to", INNER_LEFT, labelBaseline);
  const nameLast = page.field(c.customerName, INNER_LEFT, labelBaseline + 21, field({
    font: "serif", size: TYPE.customerName, minSize: 11, maxLines: 2, leading: 1.18, maxWidth: half, source: "customerName", label: "Customer name",
  }));
  const mobileBaseline = nameLast + 16;
  const mobileLabel = page.text("Mobile: ", INNER_LEFT, mobileBaseline, "sans", TYPE.body, COLORS.muted);
  page.field(c.customerPhone, INNER_LEFT + mobileLabel, mobileBaseline, field({ font: "sans", size: TYPE.body, maxWidth: half - mobileLabel, source: "customerPhone", label: "Mobile number" }));

  page.eyebrow("Trip", INNER_RIGHT, labelBaseline, "right");
  const datesBaseline = labelBaseline + 19;
  page.text(c.tripDates, INNER_RIGHT, datesBaseline, "sansMedium", 10, COLORS.ink, "right");
  const batchLast = page.field(c.batchName, INNER_RIGHT, datesBaseline + 15, field({
    font: "sans", size: TYPE.body, minSize: 8, maxLines: 3, align: "right", color: COLORS.muted, maxWidth: half, source: "batchName", label: "Batch name",
  }));

  return Math.max(mobileBaseline, batchLast) + 12;
}

// Services table columns, inset like the app's table (px-3 inside the card)
const TABLE_LEFT = LEFT + 8;
const TABLE_RIGHT = RIGHT - 8;
const CELL_PAD = 6;
const COLUMNS = (() => {
  const widths = { services: 178, batch: 86, qty: 62, rate: 56, disc: 56 };
  const services = { x: TABLE_LEFT, w: widths.services };
  const batch = { x: services.x + services.w, w: widths.batch };
  const qty = { x: batch.x + batch.w, w: widths.qty };
  const rate = { x: qty.x + qty.w, w: widths.rate };
  const disc = { x: rate.x + rate.w, w: widths.disc };
  const amount = { x: disc.x + disc.w, w: TABLE_RIGHT - (disc.x + disc.w) };
  return { services, batch, qty, rate, disc, amount };
})();
const textLeft = (col: { x: number }) => col.x + CELL_PAD;
const textRight = (col: { x: number; w: number }) => col.x + col.w - CELL_PAD;
const textWidthOf = (col: { w: number }) => col.w - 2 * CELL_PAD;

/** Header row, the service row and the subtotal, between strong rules. Returns the bottom. */
function servicesTable(page: BillPage, c: BillContent, top: number): number {
  const strong = (y: number) => page.line(TABLE_LEFT, y, TABLE_RIGHT, RULES.strong, COLORS.strongRule);

  // Header
  strong(top);
  const headBaseline = top + 16.5;
  page.eyebrow("Services", textLeft(COLUMNS.services), headBaseline);
  page.eyebrow("Batch", textLeft(COLUMNS.batch), headBaseline);
  page.eyebrow("Qty.", textRight(COLUMNS.qty), headBaseline, "right");
  page.eyebrow("Rate", textRight(COLUMNS.rate), headBaseline, "right");
  page.eyebrow("Disc.", textRight(COLUMNS.disc), headBaseline, "right");
  page.eyebrow("Amount", textRight(COLUMNS.amount), headBaseline, "right");
  const rowTop = top + 26;
  strong(rowTop);

  // The service row
  const b = rowTop + 16;
  const packageLast = page.field(c.packageName, textLeft(COLUMNS.services), b, field({
    font: "sansMedium", size: TYPE.body, minSize: 8, maxLines: 3, maxWidth: textWidthOf(COLUMNS.services), source: "packageName", label: "Package name",
  }));
  const descriptionLast = page.field(c.serviceDescription, textLeft(COLUMNS.services), packageLast + 12.5, field({
    font: "sans", size: TYPE.small, minSize: 7, maxLines: 5, leading: 1.35, color: COLORS.muted, maxWidth: textWidthOf(COLUMNS.services),
    source: "routeDescription", label: "Route",
  }));
  const batchLast = page.field(c.batchName.toUpperCase(), textLeft(COLUMNS.batch), b, field({
    font: "sans", size: TYPE.body, minSize: 7.5, maxLines: 5, maxWidth: textWidthOf(COLUMNS.batch), source: "batchName", label: "Batch name",
  }));
  const amountCell = (text: string, col: { x: number; w: number }, source: keyof BookingInput, label: string, font: FontKey = "sans") =>
    page.field(text, textRight(col), b, field({ font, size: TYPE.body, minSize: 7.5, align: "right", maxWidth: textWidthOf(col), source, label, problem: tooLarge(label) }));
  amountCell(c.quantity, COLUMNS.qty, "travellers", "Travellers");
  amountCell(c.rate, COLUMNS.rate, "ratePerPerson", "Rate per person");
  amountCell(c.discount, COLUMNS.disc, "discountAmount", "Discount");
  const percentBaseline = b + 11;
  page.text(c.discountPercent, textRight(COLUMNS.disc), percentBaseline, "sans", TYPE.tiny, COLORS.muted, "right");
  amountCell(c.amount, COLUMNS.amount, "ratePerPerson", "The total", "sansMedium");

  // Subtotal
  const subtotalTop = Math.max(descriptionLast, batchLast, percentBaseline) + 11;
  strong(subtotalTop);
  const s = subtotalTop + 17;
  page.eyebrow("Subtotal", textLeft(COLUMNS.services), s, "left", COLORS.ink);
  page.field(c.subtotalQuantity, textRight(COLUMNS.qty), s, field({
    font: "sansSemibold", size: TYPE.body, minSize: 7.5, align: "right", maxWidth: textWidthOf(COLUMNS.qty), source: "travellers", label: "Travellers", problem: tooLarge("Travellers"),
  }));
  page.money(c.discount, textRight(COLUMNS.disc), s, "sansSemibold", TYPE.body, textWidthOf(COLUMNS.disc), "discountAmount", "Discount");
  page.money(c.amount, textRight(COLUMNS.amount), s, "sansSemibold", TYPE.body, textWidthOf(COLUMNS.amount), "ratePerPerson", "The total");
  const bottom = subtotalTop + 26;
  strong(bottom);
  return bottom;
}

const TOTALS_WIDTH = 190;

/** Notes (left) and the totals with the amount in words (right). Returns the bottom. */
function notesAndTotals(page: BillPage, c: BillContent, top: number): number {
  const left = INNER_RIGHT - TOTALS_WIDTH;

  // Totals: three figures at one size; Total and Balance stand out by weight
  const total = top + 12;
  page.text("Total Amount", left, total, "sansSemibold", TYPE.body, COLORS.ink);
  page.money(c.totalAmount, INNER_RIGHT, total, "sansSemibold", TYPE.body, TOTALS_WIDTH - 90, "ratePerPerson", "The total");
  const received = total + 16;
  page.text("Received Amount", left, received, "sans", TYPE.body, COLORS.muted);
  page.money(c.receivedAmount, INNER_RIGHT, received, "sans", TYPE.body, TOTALS_WIDTH - 90, "amountPaid", "Amount paid");
  const balance = received + 16;
  page.text("Balance", left, balance, "sansSemibold", TYPE.body, COLORS.ink);
  page.money(c.balance, INNER_RIGHT, balance, "sansSemibold", TYPE.body, TOTALS_WIDTH - 90, "amountPaid", "The balance");
  const wordsLabel = balance + 19;
  page.eyebrow("Total amount (in words)", INNER_RIGHT, wordsLabel, "right");
  const wordsLast = page.field(c.amountInWords, INNER_RIGHT, wordsLabel + 15, field({
    font: "serifItalic", size: TYPE.words, minSize: 9, maxLines: 3, align: "right", maxWidth: TOTALS_WIDTH,
    source: "ratePerPerson", label: "The total in words", problem: tooLarge("The total"),
  }));

  // Notes: left out entirely when there is no note
  let notesLast = top;
  if (c.note.length > 0) {
    const width = left - 28 - INNER_LEFT;
    page.eyebrow("Notes", INNER_LEFT, top + 6);
    notesLast = note(page, c.note, top + 22, width);
  }

  return Math.max(wordsLast + 4, notesLast) + 10;
}

const NOTE_MAX_LINES = 9;

/** The invoice note, paragraph by paragraph, shrinking until it fits NOTE_MAX_LINES. Returns the last baseline. */
function note(page: BillPage, paragraphs: string[], baseline: number, width: number): number {
  for (let size = TYPE.body; size >= 8 - EPSILON; size -= SIZE_STEP) {
    const wrapped = paragraphs.map((p) => wrap(page.faces.sans, p, size, width, NOTE_MAX_LINES));
    if (wrapped.some((w) => !w) || wrapped.reduce((n, w) => n + w!.length, 0) > NOTE_MAX_LINES) continue;
    const lineHeight = size * 1.4;
    let y = baseline;
    wrapped.forEach((lines, p) => {
      if (p > 0) y += 4;
      lines!.forEach((line, i) => {
        if (i > 0 || p > 0) y += lineHeight;
        page.text(line, INNER_LEFT, y, "sans", size, COLORS.ink);
      });
    });
    return y;
  }
  page.report("invoiceNote", "Invoice note is too long to fit on the bill.");
  return baseline;
}

/**
 * Space between a section heading's baseline and the top of the content under
 * it (capital-letter tops for text, the edge for the QR code): the same under
 * Bank details, Payment QR code and Terms and conditions.
 */
const HEADING_GAP = 10.5;
/** Geist's capital height (OS/2 sCapHeight / unitsPerEm). */
const CAP_HEIGHT = 0.71;
/** Baseline of the first text line under a heading at `headingBaseline`. */
const firstLineUnder = (headingBaseline: number, size: number) => headingBaseline + HEADING_GAP + CAP_HEIGHT * size;

/** Bank details (left) and the payment QR code with the UPI ID (right). Returns the bottom. */
function payment(page: BillPage, top: number): number {
  const headingBaseline = top + 6;
  page.eyebrow("Bank details", INNER_LEFT, headingBaseline);
  let baseline = firstLineUnder(headingBaseline, TYPE.body);
  for (const [label, value] of BANK_DETAILS) {
    page.text(label, INNER_LEFT, baseline, "sans", TYPE.body, COLORS.muted);
    const lines = page.rich([{ text: value, font: "sans" }], TYPE.body, 190);
    lines.forEach((line, i) => page.richLine(line, INNER_LEFT + 76, baseline + i * 12.5, TYPE.body, COLORS.ink));
    baseline += (lines.length - 1) * 12.5 + 14;
  }
  const bankBottom = baseline - 14 + 4;

  const x = PAGE_WIDTH / 2 + 24;
  page.eyebrow("Payment QR code", x, headingBaseline);
  const qrTop = headingBaseline + HEADING_GAP;
  // The PNG carries a white quiet zone: let it overlap the whitespace around the code
  const quiet = QR_SIZE * QR_QUIET;
  page.shapes.push({ kind: "image", image: "upiQr", x: x - quiet, top: qrTop - quiet, width: QR_SIZE + 2 * quiet, height: QR_SIZE + 2 * quiet });
  const textX = x + QR_SIZE + 14;
  page.eyebrow("UPI ID", textX, qrTop + 17);
  page.text(UPI_ID, textX, qrTop + 32, "sansMedium", TYPE.body, COLORS.ink);
  page.shapes.push({ kind: "image", image: "upiApps", x: textX, top: qrTop + 43, width: UPI_APPS.width, height: UPI_APPS.height });

  return Math.max(bankBottom, qrTop + QR_SIZE);
}

/** Terms and conditions across the full width, numbered, with a little space between points. Returns the bottom. */
function terms(page: BillPage, top: number): number {
  const headingBaseline = top + 6;
  page.eyebrow("Terms and conditions", INNER_LEFT, headingBaseline);
  // The points at the bank details' size
  const size = TYPE.body;
  const lineHeight = 11.5;
  const numberX = INNER_LEFT;
  const textX = INNER_LEFT + 16;
  const width = INNER_RIGHT - textX;
  let baseline = firstLineUnder(headingBaseline, size);

  TERMS.forEach((term, i) => {
    if (i > 0) baseline += lineHeight + 3.5;
    page.text(`${i + 1}.`, numberX, baseline, "sansSemibold", size, COLORS.ink);
    const lines = page.rich([{ text: `${term.lead} `, font: "sansSemibold" }, { text: term.text, font: "sans" }], size, width);
    lines.forEach((line, l) => page.richLine(line, textX, baseline + l * lineHeight, size, COLORS.ink));
    baseline += (lines.length - 1) * lineHeight;

    (term.points ?? []).forEach((point, p) => {
      baseline += lineHeight + 1.5;
      const letterX = textX;
      const pointX = textX + 14;
      page.text(`${String.fromCharCode(97 + p)}.`, letterX, baseline, "sans", size, COLORS.muted);
      const pointLines = page.rich([{ text: point, font: "sans" }], size, INNER_RIGHT - pointX);
      pointLines.forEach((line, l) => page.richLine(line, pointX, baseline + l * lineHeight, size, COLORS.ink));
      baseline += (pointLines.length - 1) * lineHeight;
    });

    if (term.important?.length) {
      baseline += lineHeight + 1.5;
      page.text("Important:", textX, baseline, "sansSemibold", size, COLORS.ink);
      term.important.forEach((point) => {
        baseline += lineHeight + 1.5;
        const pointX = textX + 14;
        page.text("•", textX + 2, baseline, "sans", size, COLORS.muted);
        const pointLines = page.rich([{ text: point, font: "sans" }], size, INNER_RIGHT - pointX);
        pointLines.forEach((line, l) => page.richLine(line, pointX, baseline + l * lineHeight, size, COLORS.ink));
        baseline += (pointLines.length - 1) * lineHeight;
      });
    }
  });
  return baseline + 4;
}

export function layoutBill(content: BillContent, faces: Faces): BillLayout {
  const page = new BillPage(faces);
  if (!checkPrintable(page, faces, content)) return { lines: [], shapes: [], problems: page.problems, bottom: 0 };

  // One card holds the whole bill, its border the same distance from every edge
  const cardTop = MARGIN;
  const cardBottom = PAGE_HEIGHT - MARGIN;
  const divider = (y: number) => page.line(LEFT, y, RIGHT, RULES.hairline, COLORS.hairline);

  const headerBottom = header(page, cardTop + CARD.padY);

  // The invoice band runs the card's full width under the header
  const bandTop = headerBottom + 10;
  const bandBottom = invoiceBand(page, content, bandTop);
  page.shapes.unshift({ kind: "path", path: roundedRect(LEFT, bandTop, RIGHT - LEFT, bandBottom - bandTop, 0, { top: false, bottom: false }), fill: COLORS.band });
  divider(bandTop);
  const billToBottom = billToAndTrip(page, content, bandBottom + 14);
  const tableBottom = servicesTable(page, content, billToBottom);
  const totalsBottom = notesAndTotals(page, content, tableBottom + 12);

  divider(totalsBottom);
  const paymentBottom = payment(page, totalsBottom + 12);
  divider(paymentBottom + 10);
  const termsBottom = terms(page, paymentBottom + 18);

  page.shapes.push({ kind: "path", path: roundedRect(LEFT, cardTop, RIGHT - LEFT, cardBottom - cardTop, CARD.radius, { top: true, bottom: true }), stroke: COLORS.hairline, strokeWidth: RULES.hairline });

  // One page, always: the note and the route are the values that grow the most
  if (termsBottom > BOTTOM_LIMIT && Object.keys(page.problems).length === 0) {
    if (content.note.length > 0) page.report("invoiceNote", "Invoice note is too long to fit on the bill with the other details. Shorten it.");
    else page.report("routeDescription", "Route is too long to fit on the bill with the other details. Shorten it.");
  }

  return { lines: page.lines, shapes: page.shapes, problems: page.problems, bottom: termsBottom };
}
