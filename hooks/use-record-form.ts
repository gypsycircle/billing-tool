// hooks/use-record-form.ts
// React Hook Form set up the same way for every form (bookings, expenses, the
// Settings dialogs): validated with the API's own Zod schema, nothing checked
// until the first Submit, then each error clears as it's fixed; and server
// field errors (422) mapped back onto the fields.

"use client";

import { useMemo } from "react";
import { useForm, type DefaultValues, type FieldValues, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { useServerFieldErrors } from "./use-server-field-errors";

export function useRecordForm<In extends FieldValues, Out extends FieldValues = In>({
  schema,
  defaultValues,
  fields = Object.keys(defaultValues),
}: {
  /** The form's schema; keep it stable between renders (useMemo) when it is built. */
  schema: z.ZodType<unknown, unknown>;
  defaultValues: DefaultValues<In>;
  /** The fields a server error may name (default: those in `defaultValues`). */
  fields?: readonly string[];
}) {
  // The schema may type its input loosely (optional fields with defaults); the form holds every field
  const resolver = useMemo(() => zodResolver(schema as never) as unknown as Resolver<In, unknown, Out>, [schema]);
  const form = useForm<In, unknown, Out>({ resolver, defaultValues, mode: "onSubmit", reValidateMode: "onChange" });
  const applyServerErrors = useServerFieldErrors(form.setError, fields);
  return { form, applyServerErrors };
}
