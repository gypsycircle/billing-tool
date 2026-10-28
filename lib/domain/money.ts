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
