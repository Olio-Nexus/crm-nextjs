import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import DashboardShell from "@/components/layout/DashboardShell";
import { prisma } from "@/lib/prisma";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  // Which tabs this user may see (role + per-user allow-list).
  const id = session.user?.id ? Number(session.user.id) : null;
  const me = id
    ? await prisma.user.findUnique({
        where: { id },
        select: { role: true, allowedTabs: true },
      })
    : null;
  // If the account was removed mid-session, don't fall through to the sidebar
  // (empty allowedTabs would otherwise read as "all tabs"). Send them to login.
  if (!me) redirect("/login");

  return (
    <DashboardShell
      user={session.user}
      role={me?.role}
      allowedTabs={me?.allowedTabs ?? []}
    >
      {children}
    </DashboardShell>
  );
}