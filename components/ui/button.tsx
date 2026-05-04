import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-u-dark text-u-gold hover:bg-[#2A1A10] focus-visible:ring-u-gold',
        secondary:
          'bg-transparent text-u-primary border border-u-border hover:bg-u-border/40 focus-visible:ring-u-border',
        destructive:
          'bg-[#8B3A2A] text-white hover:bg-[#7A2E1F] focus-visible:ring-[#8B3A2A]',
        ghost: 'hover:bg-u-border/40 text-u-primary focus-visible:ring-u-border',
        link: 'text-u-gold underline-offset-4 hover:underline focus-visible:ring-u-gold',
        outline: 'border border-u-gold text-u-gold bg-transparent hover:bg-u-gold/10 focus-visible:ring-u-gold',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-8 px-3 text-xs',
        lg: 'h-11 px-6 text-base',
        icon: 'h-9 w-9',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };
