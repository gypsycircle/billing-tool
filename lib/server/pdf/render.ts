// lib/server/pdf/render.ts
// Draws the Bill of Supply: a new A4 page laid out by layout.ts, in the app's
// own fonts (Geist and Fraunces) with the logo and UPI images.
//
// Text is drawn KERNED, exactly as layout.ts measured it (pdf-lib's drawText
// ignores kerning), so wrapped and right-aligned values sit where they were
// fitted.

import "server-only";

import fontkit from "@pdf-lib/fontkit";
import {
  beginText,
  endText,
  moveText,
  PDFArray,
  PDFDocument,
  PDFHexString,
  PDFNumber,
  PDFOperator,
  PDFOperatorNames,
  popGraphicsState,
  pushGraphicsState,
  rgb,
  setFillingRgbColor,
  setFontAndSize,
  type PDFFont,
  type PDFImage,
  type PDFName,
  type PDFPage,
} from "pdf-lib";
import { loadBillAssets, type BillAssets, type ImageKey } from "./assets";
import { billContent, type BillBooking } from "./content";
import { layoutBill, type BillProblems, type Faces, type PlacedLine, type Shape } from "./layout";
import { FONT_FEATURES, PAGE_HEIGHT, PAGE_WIDTH, type FontKey } from "./theme";

export class BillDoesNotFitError extends Error {
  constructor(readonly problems: BillProblems) {
    super("This booking doesn't fit on the bill.");
    this.name = "BillDoesNotFitError";
  }
}

const facesOf = (assets: BillAssets): Faces =>
  Object.fromEntries(Object.entries(assets.fonts).map(([key, font]) => [key, font.face])) as Faces;

interface EmbeddedFont {
  font: PDFFont;
  key: PDFName;
  face: Faces[FontKey];
}

/** One kerned text run: glyphs from fontkit's layout, gaps adjusted with TJ. */
function drawLine(page: PDFPage, doc: PDFDocument, { font, key, face }: EmbeddedFont, line: PlacedLine): void {
  const run = face.layout(line.text, { ...FONT_FEATURES });
  // encodeText lays the text out the same way and returns one 4-hex-digit
  // glyph id per glyph.
  const hex = font.encodeText(line.text).asString();
  if (hex.length !== run.glyphs.length * 4) throw new Error("Glyph layout mismatch while drawing the bill.");

  const scale = 1000 / face.unitsPerEm;
  const spacing = (line.letterSpacing * 1000) / line.size;
  const parts = PDFArray.withContext(doc.context);
  let chunk = "";
  run.glyphs.forEach((glyph, i) => {
    chunk += hex.slice(i * 4, i * 4 + 4);
    // TJ numbers move the next glyph LEFT by n/1000 em: negative = wider gap
    const gap = (run.positions[i].xAdvance - glyph.advanceWidth) * scale + spacing;
    if (Math.abs(gap) > 0.001 && i < run.glyphs.length - 1) {
      parts.push(PDFHexString.of(chunk));
      parts.push(PDFNumber.of(-gap));
      chunk = "";
    }
  });
  if (chunk) parts.push(PDFHexString.of(chunk));

  page.pushOperators(
    pushGraphicsState(),
    beginText(),
    setFillingRgbColor(...line.color),
    setFontAndSize(key, line.size),
    moveText(line.x, PAGE_HEIGHT - line.baseline),
    PDFOperator.of(PDFOperatorNames.ShowTextAdjusted, [parts]),
    endText(),
    popGraphicsState()
  );
}

function drawShape(page: PDFPage, images: Record<ImageKey, PDFImage>, shape: Shape): void {
  switch (shape.kind) {
    case "path":
      // SVG paths are drawn y-down from (x, y): the top-left corner of the page
      page.drawSvgPath(shape.path, {
        x: 0,
        y: PAGE_HEIGHT,
        color: shape.fill ? rgb(...shape.fill) : undefined,
        borderColor: shape.stroke ? rgb(...shape.stroke) : undefined,
        borderWidth: shape.strokeWidth ?? 0,
      });
      return;
    case "line":
      page.drawLine({
        start: { x: shape.x1, y: PAGE_HEIGHT - shape.y1 },
        end: { x: shape.x2, y: PAGE_HEIGHT - shape.y2 },
        thickness: shape.width,
        color: rgb(...shape.color),
      });
      return;
    case "image":
      page.drawImage(images[shape.image], {
        x: shape.x,
        y: PAGE_HEIGHT - shape.top - shape.height,
        width: shape.width,
        height: shape.height,
      });
      return;
  }
}

/**
 * A synchronous fit check (fonts loaded once), so the booking service can run
 * it on every save without waiting. Returns the problems, empty when the booking fits.
 */
export async function loadBillFitCheck(): Promise<(booking: BillBooking) => BillProblems> {
  const faces = facesOf(await loadBillAssets());
  return (booking) => layoutBill(billContent(booking), faces).problems;
}

/** Problems that would stop this booking printing (empty when it fits). */
export async function billProblems(booking: BillBooking): Promise<BillProblems> {
  return (await loadBillFitCheck())(booking);
}

/** The finished Bill of Supply. Throws BillDoesNotFitError instead of drawing outside its place. */
export async function renderBillOfSupply(booking: BillBooking): Promise<Uint8Array> {
  const assets = await loadBillAssets();
  const { lines, shapes, problems } = layoutBill(billContent(booking), facesOf(assets));
  if (Object.keys(problems).length > 0) throw new BillDoesNotFitError(problems);

  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);

  const fonts = {} as Record<FontKey, EmbeddedFont>;
  for (const key of Object.keys(assets.fonts) as FontKey[]) {
    // Whole font, never subset: pdf-lib's subsetter blanks glyphs. The files
    // are already small Latin instances (scripts/pdf/build_assets.py).
    const font = await doc.embedFont(assets.fonts[key].bytes, { subset: false, features: { ...FONT_FEATURES } });
    fonts[key] = { font, key: page.node.newFontDictionary(font.name, font.ref), face: assets.fonts[key].face };
  }

  const images = {} as Record<ImageKey, PDFImage>;
  for (const key of Object.keys(assets.images) as ImageKey[]) images[key] = await doc.embedPng(assets.images[key]);

  for (const shape of shapes) drawShape(page, images, shape);
  for (const line of lines) drawLine(page, doc, fonts[line.font], line);

  // Neutral metadata: nothing about the customer, the server or the tooling
  const now = new Date();
  doc.setTitle(`Bill of Supply ${booking.invoiceNumber}`);
  doc.setAuthor("Gypsycircle");
  doc.setCreator("Gypsycircle");
  doc.setProducer("Gypsycircle");
  doc.setSubject("");
  doc.setKeywords([]);
  doc.setCreationDate(now);
  doc.setModificationDate(now);

  return doc.save();
}
