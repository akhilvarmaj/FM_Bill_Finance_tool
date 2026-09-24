import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { currentUser } from "@/lib/auth/http";
import { db } from "@/lib/db";
import { userSelection } from "@/lib/users/service";
import { UserEditor } from "@/components/user-editor";

export default async function UserPage({ params }: { params: Promise<{ id: string }> }) {
  if ((await currentUser())?.role !== "ADMIN") redirect("/account");
  const account = await db.user.findUnique({ where: { id: (await params).id }, select: userSelection });
  if (!account) notFound();
  return <><Link href="/users">Back to users</Link><div className="page-heading"><div><h1>{account.name}</h1><p className="muted">{account.email} · {account.roleName}</p></div></div><UserEditor key={account.updatedAt.toISOString()} account={{ ...account, updatedAt: account.updatedAt.toISOString(), permissions: account.permissions.map(grant => grant.permissionKey) }} /></>;
}