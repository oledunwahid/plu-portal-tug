import * as React from 'react';
import { cn } from '@/lib/utils';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(({ className, ...props }, ref) => {
  return (
    <textarea
      className={cn(
        'flex min-h-[80px] w-full rounded-md border border-u-input bg-u-card px-3 py-2 text-sm text-u-primary placeholder:text-u-secondary/60',
        'focus:outline-none focus:ring-2 focus:ring-u-gold/40 focus:border-u-gold',
        'disabled:cursor-not-allowed disabled:opacity-50 resize-y',
        'transition-all duration-200',
        className
      )}
      ref={ref}
      {...props}
    />
  );
});
Textarea.displayName = 'Textarea';

export { Textarea };
