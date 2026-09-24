import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth/http";
import { UserEditor } from "@/components/user-editor";

export default async function NewStaffPage() {
  if ((await currentUser())?.role !== "ADMIN") redirect("/account");
  return <><h1>Create staff account</h1><UserEditor /></>;
}