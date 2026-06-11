/**
 * Employee layout (nested under dashboard) — redirects non-employees.
 */
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export default async function EmployeeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");
  if (session.user.role !== "employee") redirect(`/${session.user.role}`);
  return children as any; // satisfy TS — layout wraps content
}