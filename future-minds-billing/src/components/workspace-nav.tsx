"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { LayoutDashboard, UsersRound, ScrollText, UserRound, Menu, X, Search, CalendarDays, Wallet, Bell, Send, Settings, BookOpen, Megaphone, FilePlus2, ChartNoAxesCombined } from "lucide-react";
import { can, type Principal } from "@/lib/auth/policy";
import { schoolModules } from "@/lib/school/modules";

export function WorkspaceNav({ admin, dashboard, user }: { admin: boolean; dashboard: boolean; user: Principal }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const links = [
    { href: "/search", title: "Search", Icon: Search },
    ...(dashboard ? [{ href: "/dashboard", title: "Dashboard", Icon: LayoutDashboard }] : []),
    ...(user.role === "PARENT" ? [{ href: "/portal", title: "My Family", Icon: LayoutDashboard }] : []),
    ...(can(user, "invoices.create") ? [{ href: "/billing", title: "Create Bill", Icon: ScrollText }] : []),
    ...(user.role === "PARENT" || can(user, "invoices.view") ? [{ href: "/invoices", title: "Invoices", Icon: ScrollText }] : []),
    ...(user.role === "PARENT" || can(user, "invoices.view") ? [{ href: "/monthly", title: "Monthly Dues", Icon: ScrollText }] : []),
    ...(user.role === "PARENT" || can(user, "payments.view") ? [{ href: "/payments", title: "Payments", Icon: ScrollText }] : []),
    ...(can(user, "marketing.view") ? [{ href: "/marketing", title: "Marketing", Icon: ScrollText }] : []),
    ...((["reports.sales", "reports.courses", "reports.payments", "reports.marketing"] as const).some(permission => can(user, permission)) ? [{ href: "/reports", title: "Reports", Icon: LayoutDashboard }] : []),
    ...(user.role === "PARENT" || can(user, "notifications.view") ? [{ href: "/notifications", title: "Notifications", Icon: ScrollText }] : []),
    ...(can(user, "whatsapp.send") && can(user, "invoices.view") ? [{ href: "/deliveries", title: "Delivery History", Icon: ScrollText }] : []),
    ...(admin ? [{ href: "/settings", title: "Settings", Icon: ScrollText }] : []),
    ...(can(user, "enrollments.manage") ? [{ href: "/enrollments", title: "Enrollments", Icon: UsersRound }] : []),
    ...(admin ? [{ href: "/families", title: "Link Parent Account", Icon: UsersRound }] : []),
    ...Object.entries(schoolModules).filter(([kind, module]) => can(user, module.view) || (user.role === "PARENT" && kind === "students")).map(([kind, module]) => ({ href: `/school/${kind}`, title: user.role === "PARENT" ? "My Children" : module.title, Icon: UsersRound })),
    ...(admin ? [{ href: "/users", title: "Users & Access", Icon: UsersRound }, { href: "/audit", title: "Audit Logs", Icon: ScrollText }] : []),
    { href: "/account", title: "My Account", Icon: UserRound },
  ];
  return <><button className="mobile-nav secondary-button" aria-expanded={open} aria-controls="workspace-nav" onClick={() => setOpen(!open)}>{open ? <X size={18} /> : <Menu size={18} />}Menu</button>
    <nav id="workspace-nav" className={`workspace-nav ${open ? "is-open" : ""}`} aria-label="Main navigation">
      {[{ title: "Workspace", paths: ["/search", "/dashboard", "/portal", "/billing"] }, { title: "Billing", paths: ["/invoices", "/monthly", "/payments", "/notifications", "/deliveries", "/reports", "/marketing"] }, { title: "School", paths: ["/school/students", "/school/parents", "/enrollments", "/school/courses", "/school/batches", "/families"] }, { title: "Administration", paths: ["/users", "/settings", "/audit", "/account"] }].map(group => {
        const items = group.paths.flatMap(path => links.filter(link => link.href === path));
        if (!items.length) return null;
        return <div className="nav-group" key={group.title}><p className="eyebrow">{group.title}</p>{items.map(link => {
          const Icon = ({ "/billing": FilePlus2, "/monthly": CalendarDays, "/payments": Wallet, "/notifications": Bell, "/deliveries": Send, "/settings": Settings, "/school/courses": BookOpen, "/marketing": Megaphone, "/reports": ChartNoAxesCombined } as Record<string, typeof ScrollText>)[link.href] ?? link.Icon;
          return <Link key={link.href} href={link.href} aria-current={pathname === link.href || (link.href !== "/billing" && pathname.startsWith(`${link.href}/`)) ? "page" : undefined} onClick={() => setOpen(false)}><Icon size={17} />{link.title}</Link>;
        })}</div>;
      })}
    </nav></>;
}