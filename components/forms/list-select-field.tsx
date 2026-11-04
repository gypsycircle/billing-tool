// components/forms/list-select-field.tsx
// A dropdown fed by a Settings list (the booking's package, destination and
// route; an expense's team member, package or channel), with a hint that
// links to that list for what isn't in it. An empty list is disabled and says
// to add some first.

"use client";

import Link from "next/link";
import type { FieldPath, FieldValues } from "react-hook-form";
import type { GeneralKind } from "@/lib/domain/general";
import { routes } from "@/lib/domain/routes";
import { SelectField } from "./fields";

const settingsHref = (list: GeneralKind | "team") => (list === "team" ? routes.settings.team : routes.settings.list(list));

export function ListSelectField<T extends FieldValues>({
  name,
  label,
  placeholder,
  choices,
  list,
  things,
  note,
  alternative,
  required,
  className,
}: {
  name: FieldPath<T>;
  label: string;
  /** Shown with nothing chosen (default: "Choose the package…"). */
  placeholder?: string;
  /** value → label. */
  choices: Readonly<Record<string, string>>;
  /** The Settings list it comes from. */
  list: GeneralKind | "team";
  /** What that list holds: "packages", "team members". */
  things: string;
  /** Said before the Settings hint: "Optional; shown in brackets after the dates." */
  note?: string;
  /** Another way out, before "add it in Settings": "Pick Other". */
  alternative?: string;
  /** The save refuses it empty: the label gets a red mark. */
  required?: boolean;
  className?: string;
}) {
  const empty = Object.keys(choices).length === 0;
  const link = (
    <Link href={settingsHref(list)} className="font-medium text-foreground underline underline-offset-4">
      Settings
    </Link>
  );
  return (
    <SelectField<T>
      name={name}
      label={label}
      options={choices}
      placeholder={empty ? `No ${things} yet` : (placeholder ?? `Choose the ${label.toLowerCase()}…`)}
      disabled={empty}
      required={required}
      className={className}
      hint={
        <>
          {note && `${note} `}
          {empty ? (
            <>Add {things} in {link} first.</>
          ) : (
            <>
              Not listed? {alternative ? `${alternative}, or add` : "Add"} {list === "team" ? "them" : "it"} in {link}.
            </>
          )}
        </>
      }
    />
  );
}
