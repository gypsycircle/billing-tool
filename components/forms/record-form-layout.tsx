// components/forms/record-form-layout.tsx
// A record's form page (booking, expense): its numbered sections on the left,
// and on the right, sticky on wide screens, the summary of the record as it
// will be saved with the save and cancel buttons under it.

import Link from "next/link";
import { FormProvider, type FieldValues, type UseFormReturn } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { FORM_BUTTON, FORM_PAGE } from "@/components/shared/layout-classes";
import { cn } from "@/lib/utils";
import { SubmitButton } from "./submit-button";

export function RecordFormLayout<In extends FieldValues, Out extends FieldValues>({
  form,
  onSubmit,
  summary,
  submit,
  children,
}: {
  form: UseFormReturn<In, unknown, Out>;
  onSubmit: React.FormEventHandler<HTMLFormElement>;
  /** The live summary (live receipt, expense summary). */
  summary: React.ReactNode;
  submit: { label: string; pending: boolean; saved: boolean; canSubmit: boolean; cancelHref: string };
  /** The FormSections. */
  children: React.ReactNode;
}) {
  return (
    <FormProvider {...form}>
      <form onSubmit={onSubmit} noValidate className={FORM_PAGE}>
        <div className="space-y-8">{children}</div>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          {summary}
          <div className="mt-4 flex flex-col gap-2">
            <SubmitButton label={submit.label} pending={submit.pending} saved={submit.saved} disabled={!submit.canSubmit} size="lg" className={FORM_BUTTON} />
            <Button variant="ghost" size="lg" className={cn(FORM_BUTTON, "text-muted-foreground")} nativeButton={false} render={<Link href={submit.cancelHref} />}>
              Cancel
            </Button>
            <p className="mt-1 text-center text-xs text-muted-foreground">Saved straight to the database.</p>
          </div>
        </aside>
      </form>
    </FormProvider>
  );
}
