import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export default async function HomePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");
  const role = session.user.role;
  if (role === "super_admin") redirect("/super-admin");
  if (role === "admin") redirect("/admin");
  if (role === "manager") redirect("/manager");
  redirect("/employee");
}
