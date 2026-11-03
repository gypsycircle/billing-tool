// components/shared/status-notice.tsx
// A quiet note above a page's content: a record that isn't active (archived or
// cancelled), or a dashboard range that couldn't be used.

export function StatusNotice({ children }: { children: React.ReactNode }) {
  return <p className="mb-6 rounded-lg border bg-status-neutral-soft px-4 py-3 text-sm text-status-neutral">{children}</p>;
}
