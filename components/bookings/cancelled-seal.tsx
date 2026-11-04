// components/bookings/cancelled-seal.tsx
// The stamp on a cancelled booking's bill, as the PDF prints it.

import { cancelledSealLines } from "@/lib/domain/bill-text";
import type { BillCancellation } from "@/lib/domain/refunds";

export function CancelledSeal({ cancellation }: { cancellation: BillCancellation }) {
  const { title, lines } = cancelledSealLines(cancellation);
  return (
    <div className="rounded-md border-[3px] border-double border-status-unpaid/80 px-3 py-1.5 text-center text-status-unpaid">
      <p className="text-sm font-semibold tracking-[0.12em]">{title}</p>
      {lines.map((line) => (
        <p key={line} className="text-xs font-medium tabular">
          {line}
        </p>
      ))}
    </div>
  );
}
