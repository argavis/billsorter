import { useState } from 'react';
import { cn } from '@renderer/lib/cn';
import wordmarkUrl from '@renderer/assets/logo-wordmark.png';
import iconUrl from '@renderer/assets/logo-icon.png';

type Props = {
  className?: string;
  alt?: string;
};

/** Wortmarke billSorter — getrimmtes PNG (1096×221), plain img. */
export const Logo = ({ className, alt = 'BillSorter' }: Props): JSX.Element => {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <span className={cn('font-bold tracking-tight text-brand-700 text-lg', className)}>
        billSorter
      </span>
    );
  }
  return (
    <img
      src={wordmarkUrl}
      alt={alt}
      draggable={false}
      onError={() => setFailed(true)}
      className={cn('block select-none w-auto max-w-none', className)}
      style={{ pointerEvents: 'none' }}
    />
  );
};

/** Icon "bs" — getrimmt (1145×700). */
export const LogoIcon = ({ className, alt = 'BillSorter' }: Props): JSX.Element => {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <span className={cn('flex items-center justify-center rounded-lg bg-brand-600 text-white font-bold text-xs', className)}>
        bs
      </span>
    );
  }
  return (
    <img
      src={iconUrl}
      alt={alt}
      draggable={false}
      onError={() => setFailed(true)}
      className={cn('block select-none w-auto max-w-none', className)}
    />
  );
};

export { iconUrl, wordmarkUrl };
