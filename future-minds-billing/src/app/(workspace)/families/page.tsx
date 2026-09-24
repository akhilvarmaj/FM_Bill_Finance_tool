import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth/http";
import { db } from "@/lib/db";
import { RecordForm } from "@/components/record-form";
export default async function FamiliesPage() {
  if ((await currentUser())?.role !== "ADMIN") redirect("/account");
  const [users, parents] = await Promise.all([db.user.findMany({ where: { roleName: "PARENT" }, select: { id: true, name: true, email: true } }), db.parent.findMany({ where: { userId: null }, select: { id: true, name: true, mobile: true } })]);
  return <><h1>Link Parent Account</h1><RecordForm kind="families" id="confirm" endpoint="/api/parents/link" destination="/school/parents" fields={[
    { name: "userId", label: "Parent login", required: true, options: users.map(user => ({ value: user.id, label: `${user.name} (${user.email})` })) },
    { name: "parentId", label: "Unlinked family", required: true, options: parents.map(parent => ({ value: parent.id, label: `${parent.name} (${parent.mobile})` })) },
  ]} /></>;
}