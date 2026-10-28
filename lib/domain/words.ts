// lib/domain/words.ts
// Indian numbering words (crore / lakh / thousand) for "Total Amount (in words)".
// Output matches the Bill of Supply: "Three Lakh Fifty Thousand Rupees".

const ONES = [
  "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
  "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
  "Seventeen", "Eighteen", "Nineteen",
];
const TENS = [
  "", "", "Twenty", "Thirty", "Forty", "Fifty",
  "Sixty", "Seventy", "Eighty", "Ninety",
];

function upTo99(n: number): string {
  if (n < 20) return ONES[n];
  const ones = n % 10;
  return ones === 0 ? TENS[Math.floor(n / 10)] : `${TENS[Math.floor(n / 10)]} ${ONES[ones]}`;
}

function upTo999(n: number): string {
  if (n < 100) return upTo99(n);
  const remainder = n % 100;
  const hundreds = `${ONES[Math.floor(n / 100)]} Hundred`;
  return remainder === 0 ? hundreds : `${hundreds} ${upTo99(remainder)}`;
}

/** Words for 1 … 99,99,999 (anything below one crore), without a unit. */
function belowCrore(n: number): string {
  const lakh = Math.floor(n / 1_00_000);
  const thousand = Math.floor((n % 1_00_000) / 1_000);
  const remainder = n % 1_000;

  const parts: string[] = [];
  if (lakh > 0) parts.push(`${upTo99(lakh)} Lakh`);
  if (thousand > 0) parts.push(`${upTo99(thousand)} Thousand`);
  if (remainder > 0) parts.push(upTo999(remainder));
  return parts.join(" ");
}

/**
 * Converts whole rupees to Indian numbering words.
 * e.g. 350000 → "Three Lakh Fifty Thousand Rupees"
 */
export function amountToWords(amount: number): string {
  const n = Math.round(Math.abs(amount));
  if (n === 0) return "Zero Rupees";

  const crore = Math.floor(n / 1_00_00_000);
  const rest = n % 1_00_00_000;

  const parts: string[] = [];
  if (crore > 0) parts.push(`${belowCrore(crore)} Crore`);
  if (rest > 0) parts.push(belowCrore(rest));

  return `${parts.join(" ")} ${n === 1 ? "Rupee" : "Rupees"}`;
}
