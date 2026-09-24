import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth/http";
import { can } from "@/lib/auth/policy";
import { BrandHeader } from "@/components/brand";
import { WorkspaceNav } from "@/components/workspace-nav";

export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  if (!user) redirect("/login");
  return <><BrandHeader /><div className="workspace"><WorkspaceNav user={user} admin={user.role === "ADMIN"} dashboard={can(user, "dashboard.view")} /><main className="workspace-main">{children}</main></div></>;
}