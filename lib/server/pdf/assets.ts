// lib/server/pdf/assets.ts
// The Bill of Supply's fonts (the app's Geist and Fraunces) and images (logo,
// UPI QR code, payment-app logos), read once per server process from
// private-templates/ (outside public/, so never served directly).
// next.config.ts bundles them via outputFileTracingIncludes.

import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";
import fontkit from "@pdf-lib/fontkit";
import type { FontKey } from "./theme";

/** The fontkit font (the same parser pdf-lib embeds with), used for measuring. */
type FontFace = ReturnType<typeof fontkit.create>;

interface BillFont {
  bytes: Uint8Array;
  face: FontFace;
}

export type ImageKey = "logo" | "upiQr" | "upiApps";

export interface BillAssets {
  fonts: Record<FontKey, BillFont>;
  images: Record<ImageKey, Uint8Array>;
}

// Literal paths, so the build traces exactly these files into each route
const FONTS: Record<FontKey, string> = {
  sans: path.join(process.cwd(), "private-templates", "fonts", "latin", "Geist-Regular.ttf"),
  sansMedium: path.join(process.cwd(), "private-templates", "fonts", "latin", "Geist-Medium.ttf"),
  sansSemibold: path.join(process.cwd(), "private-templates", "fonts", "latin", "Geist-SemiBold.ttf"),
  serif: path.join(process.cwd(), "private-templates", "fonts", "latin", "Fraunces-Medium.ttf"),
  serifItalic: path.join(process.cwd(), "private-templates", "fonts", "latin", "Fraunces-Italic.ttf"),
};

const IMAGES: Record<ImageKey, string> = {
  logo: path.join(process.cwd(), "private-templates", "images", "logo.png"),
  upiQr: path.join(process.cwd(), "private-templates", "images", "upi-qr.png"),
  upiApps: path.join(process.cwd(), "private-templates", "images", "upi-apps.png"),
};

async function readFont(file: string): Promise<BillFont> {
  const bytes = new Uint8Array(await readFile(file));
  return { bytes, face: fontkit.create(bytes) };
}

async function readAll<K extends string, T>(files: Record<K, string>, read: (file: string) => Promise<T>): Promise<Record<K, T>> {
  const keys = Object.keys(files) as K[];
  const values = await Promise.all(keys.map((key) => read(files[key])));
  return Object.fromEntries(keys.map((key, i) => [key, values[i]])) as Record<K, T>;
}

async function readAssets(): Promise<BillAssets> {
  try {
    const [fonts, images] = await Promise.all([
      readAll(FONTS, readFont),
      readAll(IMAGES, async (file) => new Uint8Array(await readFile(file))),
    ]);
    return { fonts, images };
  } catch {
    // The fs error names server paths: don't let it reach a log or response
    throw new Error("The bill template could not be loaded.");
  }
}

let cached: Promise<BillAssets> | undefined;

export function loadBillAssets(): Promise<BillAssets> {
  cached ??= readAssets().catch((err) => {
    cached = undefined; // try again on the next request
    throw err;
  });
  return cached;
}
