// hooks/use-save-record.ts
// Saving a record's form: a create carries one idempotency key per form visit
// (a retried or double-sent create returns the first record); an edit carries
// the version it was opened at, so it can't overwrite a newer save.

"use client";

import { useCallback, useState } from "react";
import { IDEMPOTENCY_HEADER, RECORD_VERSION_HEADER } from "@/lib/domain/records";
import { useApiMutation } from "./use-api-mutation";

export type SaveTarget = { mode: "create"; url: string } | { mode: "edit"; url: string; version: string };

export function useSaveRecord<T>(target: SaveTarget) {
  const { mutate, pending } = useApiMutation<T>();
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const { mode, url } = target;
  const version = target.mode === "edit" ? target.version : "";

  const save = useCallback(
    (body: unknown) =>
      mode === "create"
        ? mutate(url, { method: "POST", body, headers: { [IDEMPOTENCY_HEADER]: idempotencyKey }, toastOnError: false })
        : mutate(url, { method: "PATCH", body, headers: { [RECORD_VERSION_HEADER]: version }, toastOnError: false }),
    [mutate, idempotencyKey, mode, url, version]
  );

  return { save, pending };
}
