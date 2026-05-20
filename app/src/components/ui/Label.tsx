import { forwardRef } from 'react';
import * as RadixLabel from '@radix-ui/react-label';
import { cn } from '@renderer/lib/cn';

type LabelProps = React.ComponentPropsWithoutRef<typeof RadixLabel.Root>;

export const Label = forwardRef<HTMLLabelElement, LabelProps>(
  ({ className, ...props }, ref) => (
    <RadixLabel.Root
      ref={ref}
      className={cn('text-sm font-medium text-ink-700 leading-none', className)}
      {...props}
    />
  ),
);
Label.displayName = 'Label';
