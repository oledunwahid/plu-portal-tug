import * as React from 'react';
import { cn } from '@/lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(({ className, type, ...props }, ref) => {
  return (
    <input
      type={type}
      className={cn(
        'flex h-10 w-full rounded-md border border-u-input bg-u-card px-3 py-2 text-sm text-u-primary placeholder:text-u-secondary/60',
        'focus:outline-none focus:ring-2 focus:ring-u-gold/40 focus:border-u-gold',
        'disabled:cursor-not-allowed disabled:opacity-50',
        'transition-all duration-200',
        className
      )}
      ref={ref}
      {...props}
    />
  );
});
Input.displayName = 'Input';

export { Input };
