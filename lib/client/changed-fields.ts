// lib/client/changed-fields.ts
// An edit sends only what the user changed (a minimal PATCH).

import type { FieldNamesMarkedBoolean, FieldValues } from "react-hook-form";

/** The values of the fields React Hook Form marks dirty. */
export function changedFields<T extends FieldValues>(
  values: T,
  dirty: Partial<Readonly<FieldNamesMarkedBoolean<FieldValues>>>
): Partial<T> {
  const changes: Partial<T> = {};
  for (const key of Object.keys(dirty) as (keyof T)[]) {
    if (dirty[key as string]) changes[key] = values[key];
  }
  return changes;
}
