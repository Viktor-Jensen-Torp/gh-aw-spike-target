import {
  forwardRef,
  type PropsWithChildren,
  type ButtonHTMLAttributes,
  type ComponentType,
} from 'react';
import type { LucideProps } from 'lucide-react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils.ts';

const buttonVariants = cva(
  // Base classes shared by all buttons
  'inline-flex items-center justify-center rounded-lg transition-colors disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
  {
    variants: {
      variant: {
        // Primary block: full width, accent fill, white label
        primary: 'w-full bg-accent text-on-accent disabled:bg-accent-disabled',
        // Solid: accent fill with optional danger tone, white label
        solid: 'bg-accent text-on-accent disabled:bg-accent-disabled',
        // Secondary: border with optional fill
        secondary:
          'border border-border text-muted disabled:border-border-disabled disabled:bg-surface',
        // Icon only buttons
        'icon-secondary':
          'border border-border text-muted disabled:border-border-disabled',
        'icon-danger':
          'border border-danger-border text-danger disabled:border-border-disabled disabled:text-muted',
      },
      size: {
        // Primary block: height 42, no horizontal padding (full width)
        'primary-block':
          'h-[42px] text-sm font-semibold focus-visible:ring-accent',
        // Solid small: padding 10 by 16, label 13px weight 600
        'solid-small':
          'px-4 py-[10px] text-xs font-semibold focus-visible:ring-accent',
        // Solid medium: padding 11 by 18, label 14px weight 600
        'solid-medium':
          'px-[18px] py-[11px] text-sm font-semibold focus-visible:ring-accent',
        // Solid with icon (compact): padding 10 by 14, label 13px weight 600
        'solid-icon-compact':
          'px-[14px] py-[10px] text-xs font-semibold focus-visible:ring-accent',
        // Secondary small: padding 10 by 16, label 13px weight 500
        'secondary-small':
          'px-4 py-[10px] text-xs font-medium bg-transparent focus-visible:ring-border',
        // Secondary medium: padding 11 by 18, label 14px weight 500
        'secondary-medium':
          'px-[18px] py-[11px] text-sm font-medium bg-surface text-text focus-visible:ring-border',
        // Leading icon button: full width, padding 9 by 12, label 14px weight 500
        'with-icon':
          'w-full px-3 py-[9px] text-sm font-medium focus-visible:ring-accent',
        // Icon only: padding 10 by 12
        'icon-only': 'px-3 py-[10px]',
      },
      tone: {
        default: '',
        danger: 'bg-danger disabled:bg-accent-disabled',
      },
    },
    compoundVariants: [
      // Solid with danger tone
      {
        variant: 'solid',
        tone: 'danger',
        class: 'bg-danger text-on-accent disabled:bg-accent-disabled',
      },
    ],
  },
);

type ButtonVariants = VariantProps<typeof buttonVariants>;

interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>, ButtonVariants {
  /** Leading icon component from lucide-react. The icon is decorative. */
  icon?: ComponentType<LucideProps>;
  /** Tone variant: 'default' or 'danger'. Defaults to 'default'. Only applies to solid variant. */
  tone?: 'default' | 'danger';
}

/**
 * A button component with variants for primary, solid, secondary, and icon-only states.
 * Covers the design's six button variants: primary block, solid small/medium,
 * secondary small/medium, with leading icon, and icon-only.
 * Native button props pass through, including ref.
 */
export const Button = forwardRef<
  HTMLButtonElement,
  PropsWithChildren<ButtonProps>
>(
  (
    {
      variant = 'primary',
      size = 'primary-block',
      tone = 'default',
      icon: Icon,
      className,
      children,
      disabled,
      ...props
    },
    ref,
  ) => {
    // Add gap for buttons with icons
    const hasGap =
      size === 'with-icon' ||
      size === 'solid-icon-compact' ||
      (variant === 'icon-secondary' && Icon) ||
      (variant === 'icon-danger' && Icon);

    return (
      <button
        ref={ref}
        disabled={disabled}
        className={cn(
          buttonVariants({ variant, size, tone }),
          hasGap && 'gap-2',
          className,
        )}
        {...props}
      >
        {Icon && (
          <Icon
            size={16}
            className="flex-shrink-0"
            aria-hidden="true"
            strokeWidth={2}
          />
        )}
        {children}
      </button>
    );
  },
);

Button.displayName = 'Button';
