// components/shared/new-record-button.tsx
// The "New …" / "Add …" button in a page's header, with its keyboard shortcut
// (SHORTCUTS): a link to the record's form (the command menu binds the key),
// or an action that opens a dialog (the page binds the key).

import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ButtonKbd } from "./button-kbd";

type NewRecordButtonProps = { label: string; shortcut: string } & ({ href: string; onClick?: never } | { onClick: () => void; href?: never });

export function NewRecordButton({ href, onClick, label, shortcut }: NewRecordButtonProps) {
  const content = (
    <>
      <Plus />
      {label}
      <ButtonKbd>{shortcut.toUpperCase()}</ButtonKbd>
    </>
  );
  return href ? (
    <Button size="lg" nativeButton={false} render={<Link href={href} />}>
      {content}
    </Button>
  ) : (
    <Button size="lg" onClick={onClick}>
      {content}
    </Button>
  );
}
