"use client";

import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function Topbar({
  userId,
  name,
  role,
  companyId,
}: {
  userId: string;
  name: string;
  role: string;
  companyId: string;
}) {
  const roleLabel = { super_admin: "Super Admin", admin: "Admin", manager: "Manager", employee: "Employee" }[role] || role;
  const initials = name.split(" ").map(n=>n[0]).join("").toUpperCase().slice(0,2) || "U";

  return (
    <header className="flex h-14 items-center justify-between gap-2 border-b bg-card pl-14 pr-3 md:px-6">
      <div className="min-w-0 truncate text-sm text-muted-foreground">
        Logged in as <span className="font-medium text-foreground">{roleLabel}</span>
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="max-w-[45vw] gap-2 sm:max-w-none">
            <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold">
              {initials}
            </span>
            <span className="truncate">{name}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>My account</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem disabled>Name: {name}</DropdownMenuItem>
          <DropdownMenuItem disabled>Role: {roleLabel}</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => signOut({ callbackUrl: "/login" })}>
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}