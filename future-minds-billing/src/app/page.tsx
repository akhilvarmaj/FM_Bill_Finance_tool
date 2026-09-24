import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth/http";
import { can } from "@/lib/auth/policy";

export default async function Home() {
  const user = await currentUser();
  redirect(!user ? "/login" : user.role === "PARENT" ? "/portal" : can(user, "dashboard.view") ? "/dashboard" : "/account");
}
