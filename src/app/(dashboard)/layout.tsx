/**
 * Shared dashboard layout — Sidebar + Topbar for all role dashboards.
 */
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { MobileNav } from "@/components/dashboard/MobileNav";
import { Topbar } from "@/components/dashboard/Topbar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");
  const { id, name, role, companyId } = session.user;

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar role={role as string} />
      <MobileNav role={role as string} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar userId={id} name={name || ""} role={role as string} companyId={companyId} />
        <main className="flex-1 overflow-auto p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}