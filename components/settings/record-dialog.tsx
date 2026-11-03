// components/settings/record-dialog.tsx
// Add or edit a small record (a team member, a list item) in a dialog, set up
// and submitted like every form (useRecordForm, useRecordFormSubmit): the
// API's Zod rules, only what changed on an edit, server field errors on their
// fields (a name already in use too). On save it closes and refreshes the page.

"use client";

import { FormProvider, type DefaultValues, type FieldValues } from "react-hook-form";
import type { z } from "zod";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SubmitButton } from "@/components/forms/submit-button";
import { useRecordForm } from "@/hooks/use-record-form";
import { useRecordFormSubmit } from "@/hooks/use-record-form-submit";
import type { SaveTarget } from "@/hooks/use-save-record";

export function RecordDialog<Values extends FieldValues>({
  open,
  onOpenChange,
  title,
  description,
  schema,
  defaultValues,
  target,
  saved,
  editBody,
  unchangedCanSave,
  submitLabel,
  dismissLabel,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  /** The API's own schema for this form (create or edit). */
  schema: z.ZodType<FieldValues, Partial<Values>>;
  defaultValues: DefaultValues<Values>;
  target: SaveTarget;
  /** The toast after a save. */
  saved: string;
  /** What it sends (default: the changed fields). */
  editBody?: (values: FieldValues) => Partial<FieldValues>;
  /** It can be saved as it opened (a confirmation with a pre-filled value). */
  unchangedCanSave?: boolean;
  /** The buttons (default: Save, Cancel). */
  submitLabel?: string;
  dismissLabel?: string;
  /** The fields (the shared form fields, bound by name). */
  children: React.ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {/* Mounted only while open, so every opening starts from the record as it is now */}
        {open && (
          <DialogForm
            schema={schema}
            defaultValues={defaultValues}
            target={target}
            saved={saved}
            editBody={editBody}
            unchangedCanSave={unchangedCanSave}
            submitLabel={submitLabel}
            dismissLabel={dismissLabel}
            onDone={() => onOpenChange(false)}
          >
            {children}
          </DialogForm>
        )}
      </DialogContent>
    </Dialog>
  );
}

function DialogForm<Values extends FieldValues>({
  schema,
  defaultValues,
  target,
  saved,
  editBody,
  unchangedCanSave,
  submitLabel = "Save",
  dismissLabel = "Cancel",
  onDone,
  children,
}: {
  schema: z.ZodType<FieldValues, Partial<Values>>;
  defaultValues: DefaultValues<Values>;
  target: SaveTarget;
  saved: string;
  editBody?: (values: FieldValues) => Partial<FieldValues>;
  unchangedCanSave?: boolean;
  submitLabel?: string;
  dismissLabel?: string;
  onDone: () => void;
  children: React.ReactNode;
}) {
  const { form, applyServerErrors } = useRecordForm<Values, FieldValues>({ schema, defaultValues });
  const submit = useRecordFormSubmit<Values, FieldValues, unknown>({
    form,
    target,
    applyServerErrors,
    editBody,
    // A name already in use (409) belongs on the Name field, like any other field error
    fieldErrorsOf: (result) => (result.status === 409 && result.error ? { name: result.error } : result.fieldErrors),
    onSaved: () => {
      onDone();
      return { message: saved };
    },
  });

  return (
    <FormProvider {...form}>
      <form onSubmit={submit.onSubmit} noValidate className="space-y-4">
        {children}
        <DialogFooter>
          <Button type="button" size="lg" variant="ghost" onClick={onDone} disabled={submit.pending}>
            {dismissLabel}
          </Button>
          <SubmitButton size="lg" label={submitLabel} pending={submit.pending} disabled={!(submit.canSubmit || (unchangedCanSave && !submit.pending && !submit.saved))} />
        </DialogFooter>
      </form>
    </FormProvider>
  );
}
