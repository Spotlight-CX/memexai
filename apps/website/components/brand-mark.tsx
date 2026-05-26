import Link from 'next/link';

type BrandMarkSize = 'nav' | 'footer';

interface BrandMarkProps {
  size?: BrandMarkSize;
  showName?: boolean;
  href?: string;
}

export function BrandMark({ size = 'nav', showName = true, href = '/' }: BrandMarkProps) {
  const markClass = size === 'footer' ? 'footer-logo-mark' : 'nav-logo-mark';
  const wrapClass = size === 'footer' ? 'footer-logo' : 'nav-logo';

  return (
    <Link href={href} className={wrapClass} aria-label="MemexAI home">
      <span className={markClass}>mx</span>
      {showName && <span>MemexAI</span>}
    </Link>
  );
}
