// components/shared/meta-item.tsx
// A label over its value, as in the grey band at the top of a record's page
// (booking, expense).

export function MetaItem({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <dt className="eyebrow text-muted-foreground">{label}</dt>
      <dd className="font-medium break-words tabular">{value}</dd>
    </div>
  );
}
