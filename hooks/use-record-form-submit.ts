// hooks/use-record-form-submit.ts
// Submitting a record's form, the same way everywhere (booking, expense, the
// Settings dialogs): an idempotent create or a versioned edit of only what
// changed (useSaveRecord); a confirmation before leaving with unsaved changes;
// on success a toast, then the record's page or a refresh; on failure the
// server's field errors back on the fields. `canSubmit` holds while saving,
// after a save, and until an edit changes something.

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { FieldNamesMarkedBoolean, FieldValues, UseFormReturn } from "react-hook-form";
import type { ApiResult } from "@/lib/client/api-client";
import { changedFields } from "@/lib/client/changed-fields";
import { useSaveRecord, type SaveTarget } from "./use-save-record";
import { useUnsavedChanges } from "./use-unsaved-changes";

export function useRecordFormSubmit<In extends FieldValues, Out extends FieldValues, Data>({
  form,
  target,
  applyServerErrors,
  editBody = changedFields,
  fieldErrorsOf = (result) => result.fieldErrors,
  onSaved,
}: {
  form: UseFormReturn<In, unknown, Out>;
  target: SaveTarget;
  /** From useRecordForm. */
  applyServerErrors: (status: number | null, error: string | null, fieldErrors: Record<string, string>) => void;
  /** What an edit sends (default: the changed fields). */
  editBody?: (values: Out, dirty: Partial<Readonly<FieldNamesMarkedBoolean<FieldValues>>>) => Partial<Out>;
  /** The field errors a refused save carries (e.g. a 409 duplicate name on the Name field). */
  fieldErrorsOf?: (result: ApiResult<Data>) => Record<string, string>;
  /** After a save: the toast, and the page to go to (none: stay and refresh). */
  onSaved: (data: Data) => { message: string; href?: string };
}) {
  const router = useRouter();
  const { save, pending } = useSaveRecord<Data>(target);
  const [saved, setSaved] = useState(false);
  // Read while rendering, so React Hook Form keeps them up to date
  const { isDirty, dirtyFields } = form.formState;
  const editing = target.mode === "edit";

  useUnsavedChanges(isDirty && !saved);

  const onSubmit = form.handleSubmit(async (values) => {
    const result = await save(editing ? editBody(values, dirtyFields) : values);
    if (!result) return; // a submit was already in flight
    if (!result.data) return applyServerErrors(result.status, result.error, fieldErrorsOf(result));
    setSaved(true);
    const { message, href } = onSaved(result.data);
    toast.success(message);
    if (href) router.push(href);
    router.refresh();
  });

  return { onSubmit, pending, saved, canSubmit: !pending && !saved && (!editing || isDirty) };
}
