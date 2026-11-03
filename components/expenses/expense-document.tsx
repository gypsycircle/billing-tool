// components/expenses/expense-document.tsx
// A saved expense on its page (RecordDocument), laid out like a booking's
// bill: the band with its number, date, type and kind; what it paid for, and
// its type (like the bill's "Bill to"); then under a rule the note beside the amount,
// in figures and words.

import { MetaItem } from "@/components/shared/meta-item";
import { DocumentTotal, NotesAndFigures, PartyBlock, RecordDocument } from "@/components/shared/record-document";
import { formatDisplayDate } from "@/lib/domain/dates";
import { EXPENSE_KINDS, expenseTypeLabel, paidForLabel, type Expense } from "@/lib/domain/expenses";

export function ExpenseDocument({ expense: e }: { expense: Expense }) {
  return (
    <RecordDocument
      bandClassName="sm:grid-cols-4"
      band={
        <>
          <MetaItem label="Expense No." value={e.expenseNumber} />
          <MetaItem label="Expense date" value={formatDisplayDate(e.expenseDate)} />
          <MetaItem label="Type" value={expenseTypeLabel(e.expenseType)} />
          <MetaItem label="Kind" value={EXPENSE_KINDS[e.expenseKind]} />
        </>
      }
    >
      {/* Paid for, like the bill's Bill to: the name, then the type */}
      <PartyBlock label="Paid for" name={e.paidFor ? paidForLabel(e.expenseType, e.paidFor) : "Not recorded"} className="px-6 py-6">
        {expenseTypeLabel(e.expenseType)}
      </PartyBlock>

      {/* Notes + amount, under the bill's rule */}
      <div className="mx-3 border-t-2 border-foreground/80" aria-hidden />
      <NotesAndFigures note={e.note} noNote="No note." words={{ amount: e.amount }}>
        <DocumentTotal label="Amount" amount={e.amount} />
      </NotesAndFigures>
    </RecordDocument>
  );
}
