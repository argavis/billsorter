import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '@renderer/lib/cn';

export type InputProps = InputHTMLAttributes<HTMLInputElement>;

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        'h-10 w-full rounded-lg border border-ink-200 bg-white px-3 text-sm text-ink-900 placeholder:text-ink-400',
        'focus:outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-600/15',
        'disabled:bg-ink-50 disabled:cursor-not-allowed',
        'transition-colors',
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = 'Input';
