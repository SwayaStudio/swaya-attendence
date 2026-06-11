"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { cn } from "@/lib/utils";
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
} from "lucide-react";
import { Button } from "@/components/ui/button";

const empNav = [
  { href: "/employee", label: "Today's check-in", icon: Clock },
  { href: "/employee/history", label: "History", icon: Calendar },
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
  { href: "/admin/reports", label: "Reports", icon: FileText },
  { href: "/admin/audit", label: "Audit", icon: Settings },
];

const superNav = [
  { href: "/super-admin", label: "Overview", icon: LayoutDashboard },
  { href: "/super-admin/companies", label: "Companies", icon: Building },
  { href: "/super-admin/users", label: "Users", icon: UsersIcon },
];

export function Sidebar({ role }: { role: string }) {
  const pathname = usePathname();
  const { data: session } = useSession();

  let nav: { href: string; label: string; icon: any }[] = [];
  if (role === "super_admin") nav = superNav;
  else if (role === "admin") nav = adminNav;
  else if (role === "manager") nav = mgrNav;
  else nav = empNav;

  return (
    <aside className="w-64 flex-shrink-0 border-r bg-card">
      <div className="flex h-14 items-center border-b px-4 font-semibold">
        Geo Attendance
      </div>
      <nav className="space-y-1 p-2">
        {nav.map((item) => {
          const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
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
      <div className="border-t p-2">
        <Button
          variant="ghost"
          className="w-full justify-start text-muted-foreground hover:text-foreground"
          onClick={() => signOut({ callbackUrl: "/login" })}
        >
          <LogOut className="mr-2 h-4 w-4" />
          Sign out
        </Button>
      </div>
    </aside>
  );
}