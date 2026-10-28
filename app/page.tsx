// app/page.tsx
// Access-code screen at "/" — the only public page. Signed-in visitors are sent
// on to /bookings by proxy.ts.
// The `next` return path is validated here on the server; the form re-checks it.

import type { Metadata } from "next";
import { Lock } from "lucide-react";
import { BrandMark } from "@/components/brand/brand-mark";
import { RouteMotif } from "@/components/brand/route-motif";
import { safeRedirectPath } from "@/lib/domain/safe-redirect";
import { AccessForm } from "./access-form";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Enter the access code to use the GypsyCircle billing ledger.",
};

export default async function AccessPage({ searchParams }: PageProps<"/">) {
  const { next } = await searchParams;
  const redirectTo = safeRedirectPath(typeof next === "string" ? next : undefined);

  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      {/* Ink panel */}
      <aside className="relative isolate flex flex-col justify-between overflow-hidden bg-panel px-6 py-8 text-panel-foreground sm:px-10 lg:px-14 lg:py-12">
        <RouteMotif className="pointer-events-none absolute -right-48 -bottom-56 -z-10 size-[560px] text-panel-muted opacity-30 sm:size-[640px] lg:-right-28 lg:-bottom-28 lg:size-[680px] lg:opacity-40" />

        <BrandMark className="h-9 lg:h-11" />

        <div className="mt-10 max-w-md lg:mt-0">
          <p className="eyebrow text-panel-muted">Bookings · Payments · Bill of Supply</p>
          <p className="mt-4 font-heading text-[2.5rem] leading-[1.02] font-normal tracking-tight sm:text-5xl lg:text-[4rem]">
            Every journey,
            <br />
            <em className="font-light text-panel-muted">accounted for.</em>
          </p>
          <p className="mt-6 hidden max-w-sm text-pretty text-panel-muted sm:block">
            The private ledger for GypsyCircle trips — bookings, payments and invoices, kept in
            one place.
          </p>
        </div>

        <div className="mt-12 hidden items-center justify-between text-xs text-panel-muted lg:flex">
          <span>Kozhikode, Kerala</span>
          <span className="flex items-center gap-1.5">
            <Lock className="size-3.5" aria-hidden />
            Private · internal use only
          </span>
        </div>
      </aside>

      {/* Paper side */}
      <main className="flex items-center justify-center px-6 py-14 sm:px-10">
        <div className="w-full max-w-sm">
          <p className="eyebrow text-brand">Private access</p>
          <h1 className="mt-3 font-heading text-3xl font-medium tracking-tight sm:text-[2.25rem]">
            Sign in to the ledger
          </h1>
          <p className="mt-2 text-muted-foreground">Enter the shared access code to continue.</p>

          <div className="mt-9">
            <AccessForm redirectTo={redirectTo} />
          </div>

          <p className="mt-12 border-t pt-5 text-xs leading-relaxed text-muted-foreground">
            Sessions last 12 hours on this device. Don&apos;t have the code? Ask the GypsyCircle
            office.
          </p>
        </div>
      </main>
    </div>
  );
}
