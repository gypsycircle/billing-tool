// components/auth/logout-button.tsx

"use client";

import { Loader2, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useLogout } from "@/hooks/use-logout";

export function LogoutButton() {
  const { logout, pending } = useLogout();

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={logout}
            disabled={pending}
            aria-label="Log out"
            className="text-muted-foreground hover:text-foreground"
          />
        }
      >
        {pending ? <Loader2 className="animate-spin" /> : <LogOut />}
      </TooltipTrigger>
      <TooltipContent>Log out</TooltipContent>
    </Tooltip>
  );
}
