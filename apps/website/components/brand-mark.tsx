import Link from 'next/link';
import Image from 'next/image';

type BrandMarkSize = 'nav' | 'footer';

interface BrandMarkProps {
  size?: BrandMarkSize;
  showName?: boolean;
  href?: string;
}

export function BrandMark({ size = 'nav', showName = true, href = '/' }: BrandMarkProps) {
  const wrapClass = size === 'footer' ? 'footer-logo' : 'nav-logo';
  const imgSize = size === 'footer' ? 38 : 28;

  return (
    <Link href={href} className={wrapClass} aria-label="MemexAI home">
      <Image 
        src="/logo.svg" 
        alt="MemexAI Logo" 
        width={imgSize} 
        height={imgSize} 
      />
      {showName && <span>MemexAI</span>}
    </Link>
  );
}
