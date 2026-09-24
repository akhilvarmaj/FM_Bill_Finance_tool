import Image from "next/image";
import Link from "next/link";

export function BrandHeader() {
  return <header className="app-header">
    <Link href="/" className="brand" aria-label="Future Minds home">
      <Image src="/future-minds-logo.svg" alt="" width={48} height={48} priority />
      <span><span className="brand-name">Future Minds</span><span className="brand-tagline">Robotics &bull; AI &bull; Coding</span></span>
    </Link>
    <span className="product-label">Future Minds Billing</span>
  </header>;
}