import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export default async function ManagerLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");
  if (!["manager", "admin", "super_admin"].includes(session.user.role)) {
    redirect(`/${session.user.role}`);
  }
  return children as any;
}