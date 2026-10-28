// Renders real bills and reads them back with pdf.js: content, order, the
// one-page fit, fonts and metadata.
//
// GOLDEN_OUT=<dir> npx vitest run lib/server/pdf  → also writes the renders.

import { writeFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import fontkit from "@pdf-lib/fontkit";
import { decodePDFRawStream, PDFDict, PDFDocument, PDFName, PDFRawStream } from "pdf-lib";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import type { TextItem } from "pdfjs-dist/types/src/display/api";
import { calculateBookingAmounts } from "@/lib/domain/calculations";
import { billContent, type BillBooking } from "./content";
import { TERMS } from "./company";
import { loadBillAssets } from "./assets";
import { layoutBill, type Faces } from "./layout";
import { BillDoesNotFitError, billProblems, renderBillOfSupply } from "./render";
import { BOTTOM_LIMIT, CARD, LOGO, MARGIN, PAGE_HEIGHT, PAGE_WIDTH, QR_SIZE } from "./theme";

const INNER_LEFT = MARGIN + CARD.padX;
const INNER_RIGHT = PAGE_WIDTH - MARGIN - CARD.padX;

// ── Fixtures ────────────────────────────────────────────────────────────────
function bill(input: Omit<BillBooking, "discountPercentage" | "totalAmount" | "balanceAmount">): BillBooking {
  return { ...input, ...calculateBookingAmounts(input) };
}

const SAMPLE = bill({
  invoiceNumber: "INV_20260143",
  invoiceDate: "13/01/2026",
  dueDate: "12/02/2026",
  destination: "Delhi",
  customerName: "Adarsh",
  customerPhone: "9633569936",
  packageName: "Delhi - Agra Package",
  batchName: "19th Jan Delhi",
  tripStartDate: "19/01/2026",
  tripEndDate: "24/01/2026",
  routeDescription: "Agra-delhi-Manali-Kasol",
  travellers: 40,
  ratePerPerson: 10_000,
  discountAmount: 50_000,
  amountPaid: 40_000,
  invoiceNote: "COMPLIMENTARY FOR 5 PAX HAS BEEN ADDED.",
});

const PLAIN = bill({
  invoiceNumber: "INV_20260150",
  invoiceDate: "01/12/2026",
  dueDate: "01/12/2026",
  destination: "Wayanad",
  customerName: "Mia",
  customerPhone: "9000000000",
  packageName: "Wayanad",
  batchName: "Dec",
  tripStartDate: "05/12/2026",
  tripEndDate: "05/12/2026",
  routeDescription: "",
  travellers: 1,
  ratePerPerson: 4_999,
  discountAmount: 0,
  amountPaid: 0,
  invoiceNote: "",
});

/** Long in every field at once: still one page. */
const LONGEST = bill({
  invoiceNumber: "INV_202610000",
  invoiceDate: "28/02/2026",
  dueDate: "31/03/2026",
  destination: "Kashmir and Ladakh",
  customerName: "Anantha Padmanabhan Iyer",
  customerPhone: "+91 98470 12345",
  packageName: "Kashmir Great Lakes Trek",
  batchName: "22nd March Kochi Group B",
  tripStartDate: "22/03/2026",
  tripEndDate: "02/04/2026",
  routeDescription: "Kochi-Delhi-Srinagar-Sonamarg-Gulmarg-Pahalgam",
  travellers: 125,
  ratePerPerson: 1_85_500,
  discountAmount: 12_34_567,
  amountPaid: 1_00_00_000,
  invoiceNote: [
    "Includes airport transfers, all meals on trek days and a dedicated trek leader for the group.",
    "Ponies for luggage are booked from Sonamarg.",
  ].join("\n"),
});

// ── Reading a PDF back ──────────────────────────────────────────────────────
interface Run {
  text: string;
  x0: number;
  x1: number;
  /** Baseline in top-down coordinates, like layout.ts. */
  baseline: number;
  size: number;
  font: string;
}

/** Text runs: neighbouring items on one baseline in one font, joined. */
async function readRuns(bytes: Uint8Array): Promise<{ runs: Run[]; pages: number }> {
  const doc = await getDocument({ data: bytes.slice(), useSystemFonts: false }).promise;
  const page = await doc.getPage(1);
  const content = await page.getTextContent();
  const items = (content.items as TextItem[])
    .filter((item) => item.str.trim() !== "")
    .map((item) => ({
      text: item.str,
      x0: item.transform[4],
      x1: item.transform[4] + item.width,
      baseline: Math.round((PAGE_HEIGHT - item.transform[5]) * 100) / 100,
      size: Math.abs(item.transform[3]),
      font: item.fontName,
    }))
    .sort((a, b) => a.baseline - b.baseline || a.x0 - b.x0);

  const runs: Run[] = [];
  for (const item of items) {
    const last = runs.at(-1);
    if (last && last.font === item.font && Math.abs(last.baseline - item.baseline) < 0.01 && item.x0 - last.x1 < 3.5) {
      last.text += (item.x0 - last.x1 > 1 ? " " : "") + item.text;
      last.x1 = item.x1;
    } else {
      runs.push({ ...item });
    }
  }
  return { runs, pages: doc.numPages };
}

async function render(booking: BillBooking, name: string) {
  const bytes = await renderBillOfSupply(booking);
  if (process.env.GOLDEN_OUT) await writeFile(path.join(process.env.GOLDEN_OUT, `bill-${name}.pdf`), bytes);
  const read = await readRuns(bytes);
  return { bytes, ...read, all: read.runs.map((r) => r.text).join("\n"), squeezed: squeeze(read.runs.map((r) => r.text).join("")) };
}

/** Letter-spaced labels extract with gaps ("DU E DATE"): compare without spaces. */
const squeeze = (text: string) => text.replace(/\s+/g, "");

const first = (runs: Run[], text: string) => {
  const run = runs.find((r) => squeeze(r.text) === squeeze(text));
  expect(run, text).toBeDefined();
  return run!;
};

/** Text boxes from the baseline: ascent ~0.75 em above, descent ~0.22 em below. */
const box = (r: Run) => ({ x0: r.x0, x1: r.x1, top: r.baseline - r.size * 0.75, bottom: r.baseline + r.size * 0.22 });

// ── Layout ──────────────────────────────────────────────────────────────────
describe("renderBillOfSupply — layout", () => {
  it.each([
    ["sample", SAMPLE],
    ["plain", PLAIN],
    ["longest", LONGEST],
  ])("keeps the %s bill on one page, inside the card, with no text overlapping", async (name, booking) => {
    const { runs, pages } = await render(booking, name);
    expect(pages).toBe(1);
    for (const r of runs) {
      expect(r.x0, r.text).toBeGreaterThanOrEqual(INNER_LEFT - 0.5);
      expect(r.x1, r.text).toBeLessThanOrEqual(INNER_RIGHT + 0.5);
      expect(box(r).top, r.text).toBeGreaterThanOrEqual(MARGIN + CARD.padY - 0.5);
      expect(box(r).bottom, r.text).toBeLessThanOrEqual(BOTTOM_LIMIT);
    }
    for (let i = 0; i < runs.length; i++) {
      for (let j = i + 1; j < runs.length; j++) {
        const a = box(runs[i]);
        const b = box(runs[j]);
        const overlap = a.x0 < b.x1 - 0.3 && b.x0 < a.x1 - 0.3 && a.top < b.bottom - 0.3 && b.top < a.bottom - 0.3;
        expect(overlap, `“${runs[i].text}” overlaps “${runs[j].text}”`).toBe(false);
      }
    }
  });

  it("prints the header, bill, payment details and terms in that order", async () => {
    const { runs } = await render(SAMPLE, "sample");
    const order = [
      "Gypsycircle",
      "INVOICE NO.",
      "BILL TO",
      "SERVICES",
      "SUBTOTAL",
      "Total Amount",
      "TOTAL AMOUNT (IN WORDS)",
      "BANK DETAILS",
      "TERMS AND CONDITIONS",
    ].map((label) => first(runs, label).baseline);
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });

  it("draws one card with the same margin on all four sides", async () => {
    const assets = await loadBillAssets();
    const faces = Object.fromEntries(Object.entries(assets.fonts).map(([key, font]) => [key, font.face])) as Faces;
    const card = layoutBill(billContent(SAMPLE), faces).shapes.find((shape) => shape.kind === "path" && shape.stroke);
    expect(card?.kind === "path" && card.path).toBe(
      [
        `M ${MARGIN + CARD.radius} ${MARGIN}`,
        `H ${PAGE_WIDTH - MARGIN - CARD.radius}`,
        `Q ${PAGE_WIDTH - MARGIN} ${MARGIN} ${PAGE_WIDTH - MARGIN} ${MARGIN + CARD.radius}`,
        `V ${PAGE_HEIGHT - MARGIN - CARD.radius}`,
        `Q ${PAGE_WIDTH - MARGIN} ${PAGE_HEIGHT - MARGIN} ${PAGE_WIDTH - MARGIN - CARD.radius} ${PAGE_HEIGHT - MARGIN}`,
        `H ${MARGIN + CARD.radius}`,
        `Q ${MARGIN} ${PAGE_HEIGHT - MARGIN} ${MARGIN} ${PAGE_HEIGHT - MARGIN - CARD.radius}`,
        `V ${MARGIN + CARD.radius}`,
        `Q ${MARGIN} ${MARGIN} ${MARGIN + CARD.radius} ${MARGIN}`,
        "Z",
      ].join(" ")
    );
    expect(MARGIN).toBe(18);
  });

  it("puts the name beside the logo, with mobile and email below it", async () => {
    const { runs } = await render(SAMPLE, "sample");
    const name = first(runs, "Gypsycircle");
    // Logo, a divider, then the name: all on the left, starting after the logo
    expect(name.x0).toBeCloseTo(INNER_LEFT + LOGO.width + 24, 0);
    expect(name.baseline).toBeGreaterThan(MARGIN + CARD.padY);
    const mobile = runs.find((r) => r.text.startsWith("Mobile:") && r.baseline < first(runs, "INVOICE NO.").baseline)!;
    expect(mobile.x0).toBeCloseTo(name.x0, 0);
    const contact = runs.find((r) => r.text.includes("info@gypsycircle.in"))!;
    expect(contact.baseline).toBeCloseTo(mobile.baseline, 1);
    expect(contact.baseline - name.baseline).toBeGreaterThanOrEqual(15);
    expect(first(runs, "INVOICE NO.").baseline).toBeGreaterThan(contact.baseline);
  });

  it("embeds the UPI QR code from the payment card (29 modules, with its quiet zone)", async () => {
    const doc = await PDFDocument.load(await renderBillOfSupply(SAMPLE));
    const sizes = doc.context
      .enumerateIndirectObjects()
      .map(([, object]) => object)
      .filter((object): object is PDFRawStream => object instanceof PDFRawStream && object.dict.get(PDFName.of("Subtype")) === PDFName.of("Image"))
      .map((image) => `${image.dict.get(PDFName.of("Width"))}x${image.dict.get(PDFName.of("Height"))}`);
    expect(sizes).toContain("296x296");
  });

  it("embeds the logo sharp enough to print", async () => {
    const doc = await PDFDocument.load(await renderBillOfSupply(SAMPLE));
    const widths = doc.context
      .enumerateIndirectObjects()
      .map(([, object]) => object)
      .filter((object): object is PDFRawStream => object instanceof PDFRawStream && object.dict.get(PDFName.of("Subtype")) === PDFName.of("Image"))
      .map((image) => Number(image.dict.get(PDFName.of("Width"))?.toString()));
    expect(Math.max(...widths)).toBeGreaterThanOrEqual(600);
  });

  it("shows the company as Gypsycircle with mobile and email only", async () => {
    const { all } = await render(SAMPLE, "sample");
    expect(all).toContain("Gypsycircle");
    expect(all).toContain("8075759455");
    expect(all).toContain("info@gypsycircle.in");
    for (const gone of ["BILL OF SUPPLY", "ORIGINAL FOR RECIPIENT", "GYPSYCIRCLE", "Mavoor Road Junction", "PAN", "ABCFG3759P"]) {
      expect(all).not.toContain(gone);
    }
  });
});

// ── Content ─────────────────────────────────────────────────────────────────
describe("renderBillOfSupply — content", () => {
  it("prints every value of the booking, like the booking page", async () => {
    const { runs, all, squeezed } = await render(SAMPLE, "sample");
    void runs;
    for (const value of [
      "INV_20260143", "13/01/2026", "12/02/2026", "Delhi",
      "Adarsh", "9633569936", "19 Jan 2026 – 24 Jan 2026", "19th Jan Delhi",
      "DELHI - AGRA PACKAGE", "19TH JAN DELHI", "40 PERSON", "10,000", "50,000", "(12.5%)", "3,50,000",
      "40", "Three Lakh Fifty Thousand Rupees", "COMPLIMENTARY FOR 5 PAX HAS BEEN ADDED.",
    ]) {
      expect(all, value).toContain(value);
    }
    // The description wraps in the services column
    expect(all.replace(/\n/g, " ")).toContain("Starts from 19th jan 2026 and ends at 24th jan 2026 ( Agra-delhi-Manali-Kasol )");
    // Amounts with ₹: subtotal discount and total, total, received and balance
    for (const amount of ["50,000", "3,50,000", "40,000", "3,10,000"]) {
      expect(squeezed, amount).toContain(`₹${amount}`);
    }
    expect(squeezed.match(/₹/g)?.length).toBe(5);
  });

  it("prints the customer name as typed, not in capitals", async () => {
    const { all } = await render(SAMPLE, "sample");
    expect(all).toContain("Adarsh");
    expect(all).not.toContain("ADARSH");
  });

  it("puts the note beside the totals, above the bank details", async () => {
    const { runs } = await render(SAMPLE, "sample");
    const notes = first(runs, "NOTES");
    const note = first(runs, "COMPLIMENTARY FOR 5 PAX HAS BEEN ADDED.");
    const total = first(runs, "Total Amount");
    expect(Math.abs(notes.baseline - total.baseline)).toBeLessThan(10);
    expect(note.x1).toBeLessThan(total.x0);
    expect(note.baseline).toBeLessThan(first(runs, "BANK DETAILS").baseline);
  });

  it("leaves the notes block out when there is no note", async () => {
    const { all } = await render(PLAIN, "plain");
    expect(all.replace(/\s/g, "")).not.toContain("NOTES");
    expect(all).not.toContain("No note");
  });

  it("prints a zero discount as 0 and (0%)", async () => {
    const { all } = await render(PLAIN, "plain");
    expect(all).toContain("(0%)");
    expect(all).toContain("Four Thousand Nine Hundred Ninety Nine Rupees".split(" ")[0]);
  });

  it("never prints statuses, internal notes or the customer email", async () => {
    const booking = { ...SAMPLE, bookingStatus: "Active", paymentStatus: "Partial", internalNotes: "Secret staff note", customerEmail: "adarsh@example.com" } as BillBooking;
    const { all } = await render(booking, "sample");
    for (const hidden of ["Secret staff note", "Partial", "Active", "adarsh@example.com"]) expect(all).not.toContain(hidden);
  });

  it("prints the three totals at one size, and the terms at the bank details' size", async () => {
    const { runs } = await render(SAMPLE, "sample");
    const sizeOf = (text: string) => runs.find((r) => r.text.replace(/₹\s*/, "") === text)!.size;
    expect(new Set(["3,50,000", "40,000", "3,10,000"].map((amount) => runs.filter((r) => r.text === amount && r.baseline > first(runs, "SUBTOTAL").baseline + 5).map((r) => r.size)).flat()).size).toBe(1);
    expect(sizeOf("FDRL0001413")).toBeCloseTo(runs.find((r) => r.text.startsWith("Refunds will be credited"))!.size, 2);
  });

  it("leaves the same gap under Bank details, Payment QR code and Terms and conditions", async () => {
    const assets = await loadBillAssets();
    const faces = Object.fromEntries(Object.entries(assets.fonts).map(([key, font]) => [key, font.face])) as Faces;
    const { lines, shapes } = layoutBill(billContent(SAMPLE), faces);
    const line = (text: string) => lines.find((l) => l.text === text)!;
    const capTop = (text: string) => line(text).baseline - 0.71 * line(text).size;
    const bank = capTop("Name") - line("BANK DETAILS").baseline;
    const terms = capTop("1.") - line("TERMS AND CONDITIONS").baseline;
    const qr = shapes.find((shape) => shape.kind === "image" && shape.image === "upiQr");
    const quiet = qr?.kind === "image" ? (qr.width - QR_SIZE) / 2 : 0;
    const qrGap = (qr?.kind === "image" ? qr.top + quiet : 0) - line("PAYMENT QR CODE").baseline;
    expect(terms).toBeCloseTo(bank, 1);
    expect(qrGap).toBeCloseTo(bank, 1);
  });

  it("lists the bank details and the UPI ID", async () => {
    const { squeezed } = await render(SAMPLE, "sample");
    for (const value of ["GYPSY CIRCLE", "FDRL0001413", "14130200026234", "Federal Bank, Kozhikode Mavoor Road", "gypsycircle123@fbl", "PAYMENT QR CODE"]) {
      expect(squeezed).toContain(squeeze(value));
    }
  });

  it("numbers the terms 1–6 with lettered points and the postponement note, across the full width", async () => {
    const { runs } = await render(SAMPLE, "sample");
    const heading = first(runs, "TERMS AND CONDITIONS");
    const below = runs.filter((r) => r.baseline > heading.baseline);
    const numbers = below.filter((r) => /^\d\.$/.test(r.text)).map((r) => r.text);
    expect(numbers).toEqual(TERMS.map((_, i) => `${i + 1}.`));
    const letters = below.filter((r) => /^[a-d]\.$/.test(r.text)).map((r) => r.text);
    expect(letters).toEqual(["a.", "b.", "c.", "d.", "a.", "b.", "c.", "d."]);
    // Point 6: the postponement policy, then "Important:" with two bullets
    expect(first(runs, "Postponement policy:").baseline).toBeGreaterThan(first(runs, "Cancellation policy:").baseline);
    const important = first(runs, "Important:");
    expect(below.filter((r) => r.text === "•" && r.baseline > important.baseline)).toHaveLength(2);
    // Lines run well past the middle of the page (the old bill used half the width)
    expect(Math.max(...below.map((r) => r.x1))).toBeGreaterThan(PAGE_WIDTH - MARGIN - 80);
    // A little space between points: more than between the lines of one point
    const baselines = below.filter((r) => /^\d\.$/.test(r.text)).map((r) => r.baseline);
    for (let i = 1; i < baselines.length; i++) expect(baselines[i] - baselines[i - 1]).toBeGreaterThan(11.5 + 3);
  });
});

// ── Fonts and metadata ──────────────────────────────────────────────────────
describe("renderBillOfSupply — fonts and metadata", () => {
  it("embeds the app's fonts whole, drawing every character it prints (₹ included)", async () => {
    // pdf-lib's own subsetter once produced blank glyphs while the text still
    // extracted fine, so check the embedded font programs themselves.
    const doc = await PDFDocument.load(await renderBillOfSupply(LONGEST));
    const programs = doc.context
      .enumerateIndirectObjects()
      .map(([, object]) => object)
      .filter((object): object is PDFDict => object instanceof PDFDict && object.get(PDFName.of("Type")) === PDFName.of("FontDescriptor"))
      .map((descriptor) => descriptor.lookup(PDFName.of("FontFile2")))
      .filter((stream) => stream instanceof PDFRawStream)
      .map((stream) => fontkit.create(decodePDFRawStream(stream).decode()));
    expect(programs).toHaveLength(5);
    expect(new Set(programs.map((font) => font.familyName))).toEqual(new Set(["Geist", "Fraunces"]));

    const content = billContent(LONGEST);
    const printed = new Set(
      [...Object.values(content).flat(), "₹", ...TERMS.flatMap((t) => [t.lead, t.text, ...(t.points ?? [])])].join("").replace(/\s/g, "")
    );
    for (const font of programs) {
      for (const char of printed) {
        expect(font.glyphForCodePoint(char.codePointAt(0)!).path.toSVG(), `${font.familyName} ${char}`).not.toBe("");
      }
    }
  });

  it("strips identifying metadata", async () => {
    const bytes = await renderBillOfSupply(SAMPLE);
    const doc = await getDocument({ data: bytes.slice() }).promise;
    const { info } = (await doc.getMetadata()) as { info: Record<string, unknown> };
    expect(info.Title).toBe("Bill of Supply INV_20260143");
    expect(JSON.stringify(info)).not.toMatch(/HeadlessChrome|pdf-lib|Skia/i);
  });
});

// ── Fit check ───────────────────────────────────────────────────────────────
describe("billProblems", () => {
  it("is empty for bookings that fit, including the longest", async () => {
    expect(await billProblems(SAMPLE)).toEqual({});
    expect(await billProblems(PLAIN)).toEqual({});
    expect(await billProblems(LONGEST)).toEqual({});
  });

  it("refuses a route that can't fit, naming the field", async () => {
    const problems = await billProblems({ ...SAMPLE, routeDescription: "Kochi-".repeat(30) + "Delhi ".repeat(20) });
    expect(problems).toEqual({ routeDescription: "Route is too long to fit on the bill." });
    await expect(renderBillOfSupply({ ...SAMPLE, routeDescription: "x".repeat(200) })).rejects.toBeInstanceOf(BillDoesNotFitError);
  });

  it("refuses characters the fonts can't print", async () => {
    const problems = await billProblems({ ...SAMPLE, customerName: "Adarsh 😀", packageName: "മൂന്നാർ" });
    expect(problems.customerName).toBe("Customer name has characters the bill can't print: “😀”.");
    expect(problems.packageName).toMatch(/^Package name has characters the bill can't print/);
  });

  it("refuses a booking too long overall for one page, naming the note or route, instead of running off the page", async () => {
    const huge = {
      ...LONGEST,
      customerName: "Anantha Padmanabhan Venkataraghavan Subramaniam Iyer Krishnamurthy",
      packageName: "Kashmir Great Lakes Trek with Sonamarg, Gulmarg and Pahalgam Extension for the Kochi Group",
      routeDescription: "Kochi-Delhi-Srinagar-Sonamarg-Gulmarg-Pahalgam-Srinagar-Delhi-Kochi with a stopover in Amritsar for the Golden Temple and Wagah",
      batchName: "22nd March Kochi Group B with the Bengaluru and Chennai Joiners",
    };
    expect(await billProblems(huge)).toEqual({ invoiceNote: "Invoice note is too long to fit on the bill with the other details. Shorten it." });
    // Without a note, the route is the value to shorten
    expect(await billProblems({ ...huge, invoiceNote: "" })).toEqual({
      routeDescription: "Route is too long to fit on the bill with the other details. Shorten it.",
    });
  });

  it("refuses notes that are too long and amounts too large for their column", async () => {
    const problems = await billProblems({
      ...SAMPLE,
      invoiceNote: "A very long note ".repeat(70),
      ...calculateBookingAmounts({ travellers: 1, ratePerPerson: 1_00_00_00_000, discountAmount: 0, amountPaid: 0 }),
      travellers: 1,
      ratePerPerson: 1_00_00_00_000,
    });
    expect(problems.invoiceNote).toBe("Invoice note is too long to fit on the bill.");
    expect(problems.ratePerPerson).toBe("Rate per person is too large to fit on the bill.");
  });
});
