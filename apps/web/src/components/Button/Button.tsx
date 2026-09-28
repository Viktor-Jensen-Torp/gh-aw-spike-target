import {
  forwardRef,
  type PropsWithChildren,
  type ButtonHTMLAttributes,
  type ComponentType,
} from 'react';
import type { LucideProps } from 'lucide-react';
import { Plus } from 'lucide-react';
import { cn } from '../../lib/utils.ts';

const iconMap: Record<string, ComponentType<LucideProps>> = {
  Plus,
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Optional leading icon name from lucide-react. The icon is decorative. */
  icon?: keyof typeof iconMap;
}

/**
 * Primary button: accent fill, white label, used for a form's submit and a
 * screen's main action. Optional leading icon (lucide, 16 px, white), 8 px
 * before the label. The icon is decorative: the button's name is its label.
 */
export const Button = forwardRef<
  HTMLButtonElement,
  PropsWithChildren<ButtonProps>
>(({ children, icon, className, ...props }, ref) => {
  // Get the icon component if specified
  const IconComponent = icon ? iconMap[icon] : null;

  return (
    <button
      ref={ref}
      className={cn(
        // Container: full width, accent fill (design: fill $accent, width fill_container)
        'w-full bg-accent',
        // Border radius: 8px from design (cornerRadius 8)
        'rounded-lg',
        // Flex layout for icon + label with 8px gap (design: gap 8, which is gap-2 in Tailwind)
        'flex items-center justify-center gap-2',
        // Padding: design specifies padding [9, 12] (v/h), approximate with py-2 px-3
        'px-3 py-2',
        // Typography: 14px, weight 600 (from design: fontSize 14, fontWeight 600, color white)
        'text-sm font-semibold text-white',
        // Interactive states for accessibility
        'hover:opacity-90 active:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed',
        // Focus state for accessibility
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-accent',
        className,
      )}
      {...props}
    >
      {IconComponent && (
        <IconComponent
          size={16}
          className="flex-shrink-0"
          aria-hidden="true"
          strokeWidth={2}
        />
      )}
      {children}
    </button>
  );
});

Button.displayName = 'Button';
