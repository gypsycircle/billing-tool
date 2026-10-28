// app/access-form.tsx
// Access-code form: show/hide toggle, inline error, lockout countdown,
// duplicate-submit guard. Redirects to the (server-validated) `next` path.
"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Eye, EyeOff, Loader2, CircleAlert, TimerReset } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { cn } from "@/lib/utils";
import { safeRedirectPath } from "@/lib/domain/safe-redirect";
import { formatCountdown, useCountdown } from "@/hooks/use-countdown";

interface AccessFormProps {
  /** Where to go after login — already validated on the server. */
  redirectTo: string;
}

export function AccessForm({ redirectTo }: AccessFormProps) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [showCode, setShowCode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [shake, setShake] = useState(false);
  const { secondsLeft: lockSeconds, start: startLockout } = useCountdown();
  const isLocked = lockSeconds > 0;
  const inputRef = useRef<HTMLInputElement>(null);
  const submittingRef = useRef(false);

  // Autofocus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  function triggerShake() {
    setShake(true);
    setTimeout(() => setShake(false), 500);
  }

  const handleSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();

      // Prevent duplicate submissions and attempts while locked out
      if (submittingRef.current || isLoading || isLocked) return;
      submittingRef.current = true;

      setError(null);
      setIsLoading(true);

      try {
        const response = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ code }),
        });

        if (response.ok) {
          router.replace(safeRedirectPath(redirectTo));
          router.refresh();
          return;
        }

        const data = await response.json().catch(() => null);

        if (response.status === 429) {
          // Locked out — the countdown below replaces the error message
          const retryAfter = Number.parseInt(response.headers.get("Retry-After") ?? "", 10);
          startLockout(Number.isFinite(retryAfter) ? retryAfter : 900);
        } else if (response.status === 401) {
          setError(data?.error ?? "Invalid access code.");
          triggerShake();
        } else {
          setError(data?.error ?? "Something went wrong. Please try again.");
        }
      } catch {
        setError("Network error. Please check your connection and try again.");
      } finally {
        setIsLoading(false);
        submittingRef.current = false;
      }
    },
    [code, redirectTo, router, isLoading, isLocked, startLockout]
  );

  const message = isLocked
    ? `Too many attempts. Try again in ${formatCountdown(lockSeconds)}.`
    : error;

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className={cn("w-full max-w-sm space-y-4", shake && "animate-shake")}
    >
      <div className="space-y-2">
        <InputGroup className="h-11 bg-card">
          <InputGroupInput
            ref={inputRef}
            id="access-code"
            name="code"
            type={showCode ? "text" : "password"}
            autoComplete="current-password"
            spellCheck={false}
            placeholder="Enter the shared code"
            value={code}
            onChange={(e) => {
              setCode(e.target.value);
              if (error) setError(null);
            }}
            disabled={isLoading}
            aria-invalid={Boolean(error) || undefined}
            aria-describedby={message ? "access-message" : undefined}
            className="text-base"
          />
          <InputGroupAddon align="inline-end">
            <InputGroupButton
              size="icon-xs"
              onClick={() => setShowCode((s) => !s)}
              disabled={isLoading}
              aria-label={showCode ? "Hide access code" : "Show access code"}
              aria-pressed={showCode}
            >
              {showCode ? <EyeOff /> : <Eye />}
            </InputGroupButton>
          </InputGroupAddon>
        </InputGroup>

         {message && ( <p
          id="access-message"
          role="status"
          aria-live="polite"
          className={cn(
            "flex min-h-5 items-start gap-2 pt-1 text-sm",
            isLocked ? "text-status-partial" : "text-destructive"
          )}
        >
            <>
              {isLocked ? (
                <TimerReset className="mt-0.5 size-4 shrink-0" aria-hidden />
              ) : (
                <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
              )}
              <span className="tabular">{message}</span>
            </>
        </p>
         )}
      </div>

      <Button
        type="submit"
        size="lg"
        disabled={isLoading || isLocked || !code.trim()}
        className="group h-11 w-full text-[0.9375rem]"
      >
        {isLoading ? (
          <>
            <Loader2 className="animate-spin" />
            Verifying…
          </>
        ) : (
          <>
            Continue
            <ArrowRight className="transition-transform group-hover:translate-x-0.5" />
          </>
        )}
      </Button>
    </form>
  );
}
