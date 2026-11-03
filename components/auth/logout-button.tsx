// components/auth/logout-button.tsx

"use client";

import { LogOut } from "lucide-react";
import { IconAction } from "@/components/shared/icon-action";
import { useLogout } from "@/hooks/use-logout";

export function LogoutButton() {
  const { logout, pending } = useLogout();

  return (
    <IconAction label="Log out" pending={pending} onClick={logout} className="text-muted-foreground hover:text-foreground">
      <LogOut />
    </IconAction>
  );
}
