// lib/utils.ts
// Tailwind class merging. shadcn/ui components import `cn` from this path.
// Booking formatting lives in lib/domain (money.ts, dates.ts, words.ts).

import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
