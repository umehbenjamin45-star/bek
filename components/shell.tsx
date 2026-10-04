'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AuthProvider } from './auth-provider';
export function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  return <AuthProvider><div className="shell"><header className="header"><Link href="/" className="brand" aria-label="Bek home"><span className="brand-mark">b</span>bek<span className="brand-note">voice to text</span></Link><nav aria-label="Main navigation">{[['/', 'Home'], ['/history', 'History'], ['/settings', 'Settings']].map(([href, label]) => <Link key={href} href={href} aria-current={path === href ? 'page' : undefined}>{label}</Link>)}</nav></header><main>{children}</main><footer>Your voice. Your words. One place.</footer></div></AuthProvider>;
}
