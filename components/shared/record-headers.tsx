// components/shared/record-headers.tsx
// The headers of a record's pages (bookings, expenses), built on PageHeader:
//   RecordPageHeader  its page: back to the list, "Booking No. …", its title,
//                     badges, one detail and when it was last updated, actions
//   NewRecordHeader   its new form: back to the list, "New entry"
//   EditRecordHeader  its edit form: back to the record, "Edit · No. …"
// and ArchivedNotice, the note on an archived record's page.

import { formatTimestampIST } from "@/lib/domain/dates";
import { PageHeader } from "./page-header";
import { StatusNotice } from "./status-notice";

type Back = { href: string; label: string };

export function RecordPageHeader({
  back,
  eyebrow,
  title,
  badges,
  detail,
  updatedAt,
  actions,
}: {
  back: Back;
  eyebrow: string;
  title: string;
  badges: React.ReactNode;
  /** One fact after the badges (the package, what an expense was for), if there is one. */
  detail: React.ReactNode;
  updatedAt: string;
  actions: React.ReactNode;
}) {
  const updated = formatTimestampIST(updatedAt);
  return (
    <PageHeader
      back={back}
      eyebrow={eyebrow}
      title={title}
      description={
        <span className="flex flex-wrap items-center gap-x-3 gap-y-2">
          {badges}
          {detail && <span className="text-sm">{detail}</span>}
          {updated && <span className="text-xs">· Last updated {updated}</span>}
        </span>
      }
      actions={actions}
    />
  );
}

export function NewRecordHeader({ back, title, description }: { back: Back; title: string; description: string }) {
  return <PageHeader back={back} eyebrow="New entry" title={title} description={description} />;
}

export function EditRecordHeader({ back, number, title, description }: { back: Back; number: string; title: string; description: string }) {
  return <PageHeader back={back} eyebrow={`Edit · No. ${number}`} title={title} description={description} />;
}

/** "This booking is archived: hidden from the ledger, but kept, ready to restore. Restore it from More." */
export function ArchivedNotice({ what, hidden }: { what: string; hidden: string }) {
  return (
    <StatusNotice>
      This {what} is archived: {hidden}, but kept, ready to restore. Restore it from More.
    </StatusNotice>
  );
}
