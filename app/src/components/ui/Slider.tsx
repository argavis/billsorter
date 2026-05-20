import { forwardRef } from 'react';
import * as RadixSlider from '@radix-ui/react-slider';
import { cn } from '@renderer/lib/cn';

export const Slider = forwardRef<
  React.ElementRef<typeof RadixSlider.Root>,
  React.ComponentPropsWithoutRef<typeof RadixSlider.Root>
>(({ className, ...props }, ref) => (
  <RadixSlider.Root
    ref={ref}
    className={cn('relative flex w-full touch-none select-none items-center', className)}
    {...props}
  >
    <RadixSlider.Track className="relative h-1.5 w-full grow overflow-hidden rounded-full bg-ink-200">
      <RadixSlider.Range className="absolute h-full bg-brand-600" />
    </RadixSlider.Track>
    <RadixSlider.Thumb
      className="block h-5 w-5 rounded-full border-2 border-brand-600 bg-white shadow focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-600/15 transition-transform hover:scale-110"
      aria-label="Wert"
    />
  </RadixSlider.Root>
));
Slider.displayName = 'Slider';
