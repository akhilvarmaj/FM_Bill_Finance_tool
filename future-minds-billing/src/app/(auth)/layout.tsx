import { ShieldCheck } from "lucide-react";
import { BrandHeader } from "@/components/brand";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <><BrandHeader /><main className="auth-main">{children}</main><footer className="auth-footer"><span>Future Minds &copy; {new Date().getFullYear()}</span><span className="security-label"><ShieldCheck size={15} aria-hidden />Private account access</span></footer></>;
}