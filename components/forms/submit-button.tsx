// components/forms/submit-button.tsx
// A form's submit button: a check, or a spinner while saving (and after,
// while it goes to the saved record), "Saving…" meanwhile.

import { Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function SubmitButton({
  label,
  pending,
  saved = false,
  disabled,
  size,
  className,
}: {
  label: string;
  pending: boolean;
  /** Saved and on its way to the record's page: keep the spinner. */
  saved?: boolean;
  disabled: boolean;
  size?: React.ComponentProps<typeof Button>["size"];
  className?: string;
}) {
  return (
    <Button type="submit" size={size} className={className} disabled={disabled}>
      {pending || saved ? <Loader2 className="animate-spin" /> : <Check />}
      {pending ? "Saving…" : label}
    </Button>
  );
}
