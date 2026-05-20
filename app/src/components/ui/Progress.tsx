import { forwardRef } from 'react';
import * as RadixProgress from '@radix-ui/react-progress';
import { cn } from '@renderer/lib/cn';

export const Progress = forwardRef<
  React.ElementRef<typeof RadixProgress.Root>,
  React.ComponentPropsWithoutRef<typeof RadixProgress.Root> & { value?: number }
>(({ className, value = 0, ...props }, ref) => (
  <RadixProgress.Root
    ref={ref}
    className={cn('relative h-2 w-full overflow-hidden rounded-full bg-ink-100', className)}
    {...props}
  >
    <RadixProgress.Indicator
      className="h-full bg-brand-600 transition-transform duration-300"
      style={{ transform: `translateX(-${100 - value}%)` }}
    />
  </RadixProgress.Root>
));
Progress.displayName = 'Progress';
