// lib/domain/money.ts
// Rupee amounts with Indian digit grouping (e.g. 3,50,000).

/**
 * Groups a plain digit string the Indian way: last 3 digits, then pairs.
 * e.g. "350000" → "3,50,000"
 */
function formatIndianGrouping(digits: string): string {
  const cleaned = digits.replace(/,/g, "");
  if (cleaned.length <= 3) return cleaned;

  const last3 = cleaned.slice(-3);
  const rest = cleaned.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ",");
  return `${rest},${last3}`;
}

/** Formats whole rupees without the symbol. e.g. 350000 → "3,50,000" */
export function formatAmount(amount: number): string {
  if (!Number.isFinite(amount)) return "0";
  const grouped = formatIndianGrouping(Math.abs(Math.round(amount)).toString());
  return amount < 0 ? `-${grouped}` : grouped;
}

const COMPACT_UNITS = [
  { size: 1_00_00_000, suffix: "Cr" },
  { size: 1_00_000, suffix: "L" },
  { size: 1_000, suffix: "K" },
] as const;

/** Short rupees for chart axes, the Indian way: 950, 1.5K, 2.5L, 1.2Cr (no symbol). */
export function formatCompactAmount(amount: number): string {
  const size = Math.abs(amount);
  const unit = COMPACT_UNITS.find((u) => size >= u.size);
  if (!unit) return formatAmount(amount);
  const value = Math.round((size / unit.size) * 10) / 10;
  return `${amount < 0 ? "-" : ""}${value}${unit.suffix}`;
}
