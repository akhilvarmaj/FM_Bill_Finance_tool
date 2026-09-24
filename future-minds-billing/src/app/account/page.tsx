import { redirect } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { currentUser } from "@/lib/auth/http";
import { BrandHeader } from "@/components/brand";
import { LogoutButton } from "@/components/logout-button";
import Link from "next/link";
import { can } from "@/lib/auth/policy";

export default async function AccountPage() {
  const user = await currentUser();
  if (!user) redirect("/login");
  return <><BrandHeader /><main className="account-main">
    {can(user, "dashboard.view") && <Link className="secondary-button" href="/dashboard">Open dashboard</Link>}
    <Link className="secondary-button" href="/school/students">{user.role === "PARENT" ? "My children" : "Students"}</Link>
    <div className="account-heading"><div><p className="eyebrow">My account</p><h1>{user.name}</h1><p className="muted">{user.email}</p></div><LogoutButton /></div>
    <dl className="profile-details">
      <div><dt>Account role</dt><dd>{({ ADMIN: "Administrator", STAFF: "Staff", PARENT: "Parent" })[user.role]}</dd></div>
      <div><dt>Status</dt><dd><span className="status"><CheckCircle2 size={16} />Approved</span></dd></div>
      <div><dt>Access</dt><dd>{user.role === "ADMIN" ? "Full access" : user.role === "PARENT" ? "My family" : user.permissions.length ? user.permissions.join(", ") : "No permissions assigned"}</dd></div>
    </dl>
  </main></>;
}