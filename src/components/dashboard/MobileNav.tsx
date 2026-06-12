"use client";

/**
 * MobileNav — hamburger drawer for phone-width viewports.
 *
 * Hidden on md+ breakpoints where the desktop Sidebar takes over. The drawer
 * uses Radix Dialog (already in package.json) and renders the same nav items
 * as Sidebar.tsx — kept in sync by reading the same role → nav map.
 *
 * Place it once at the top of the dashboard layout alongside <Sidebar>.
 * The hamburger trigger is rendered into the topbar via a portal-free flex
 * layout: the trigger floats on the left edge of the viewport so it works
 * regardless of where the topbar lives in the DOM.
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import {
  LayoutDashboard,
  MapPin,
  Users as UsersIcon,
  Clock,
  Calendar,
  ClipboardList,
  FileText,
  LogOut,
  Settings,
  Building,
  Plane,
  Menu,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";

const empNav = [
  { href: "/employee", label: "Today's check-in", icon: Clock },
  { href: "/employee/history", label: "History", icon: Calendar },
  { href: "/employee/leave", label: "Leave", icon: Plane },
  { href: "/employee/regularization", label: "Regularization", icon: ClipboardList },
  { href: "/employee/sites", label: "My sites", icon: MapPin },
];

const mgrNav = [
  { href: "/manager", label: "Team", icon: UsersIcon },
  { href: "/manager/approvals", label: "Approvals", icon: ClipboardList },
  { href: "/manager/reports", label: "Reports", icon: FileText },
];

const adminNav = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/sites", label: "Sites", icon: MapPin },
  { href: "/admin/employees", label: "Employees", icon: UsersIcon },
  { href: "/admin/shifts", label: "Shifts", icon: Clock },
  { href: "/admin/schedules", label: "Schedules", icon: Calendar },
  { href: "/admin/holidays", label: "Holidays", icon: FileText },
  { href: "/admin/approvals", label: "Approvals", icon: ClipboardList },
  { href: "/admin/reports", label: "Reports", icon: FileText },
  { href: "/admin/audit", label: "Audit", icon: Settings },
];

const superNav = [
  { href: "/super-admin", label: "Overview", icon: LayoutDashboard },
  { href: "/super-admin/companies", label: "Companies", icon: Building },
  { href: "/super-admin/users", label: "Users", icon: UsersIcon },
];

function getNav(role: string) {
  if (role === "super_admin") return superNav;
  if (role === "admin") return adminNav;
  if (role === "manager") return mgrNav;
  return empNav;
}

export function MobileNav({ role }: { role: string }) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);
  const nav = getNav(role);

  // Close the drawer whenever the user navigates so it doesn't stay open
  // over a different page.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <>
      {/* Hamburger trigger — only visible below md. Floats over the topbar. */}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="fixed left-2 top-2 z-40 h-10 w-10 md:hidden"
        onClick={() => setOpen(true)}
        aria-label="Open menu"
      >
        <Menu className="h-5 w-5" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          aria-describedby={undefined}
          className="left-0 top-0 block h-screen max-h-screen w-72 max-w-[85vw] translate-x-0 translate-y-0 gap-0 rounded-none p-0 data-[state=open]:slide-in-from-left data-[state=closed]:slide-out-to-left"
        >
          <DialogTitle className="sr-only">Navigation</DialogTitle>
          <div className="flex h-14 items-center border-b px-4 font-semibold">
            Geo Attendance
          </div>
          <nav className="space-y-1 p-2">
            {nav.map((item) => {
              const isActive =
                pathname === item.href ||
                (item.href !== "/" && pathname.startsWith(item.href));
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="absolute inset-x-0 bottom-0 border-t p-2">
            <div className="px-3 pb-2 text-xs text-muted-foreground truncate">
              {session?.user?.email}
            </div>
            <Button
              variant="ghost"
              className="w-full justify-start text-muted-foreground hover:text-foreground"
              onClick={() => signOut({ callbackUrl: "/login" })}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
