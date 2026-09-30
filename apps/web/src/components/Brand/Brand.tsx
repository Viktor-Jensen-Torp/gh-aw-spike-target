import { forwardRef, type HTMLAttributes } from 'react';
import { Check } from 'lucide-react';
import { cn } from '../../lib/utils.ts';

interface BrandProps extends HTMLAttributes<HTMLDivElement> {
  /**
   * Whether to show the "Tempo" text alongside the mark.
   * Defaults to false (mark only).
   */
  withName?: boolean;
  /**
   * Layout variant for the mark + name.
   * - 'auth': standard horizontal layout with gap 10, used in auth screens
   * - 'sidebar': full width with padding 4, used in the sidebar
   * Ignored if `withName` is false.
   * Defaults to 'auth'.
   */
  variant?: 'auth' | 'sidebar';
}

/**
 * The Tempo brand: the mark alone, or the mark with the "Tempo" name.
 * - **Mark**: 28 by 28, radius 8, `$accent` fill, with a 16 px `check` icon in `$on-accent` (decorative).
 * - **With the name**: the mark, gap 10, then "Tempo" 17 px weight 600 `$text`.
 *   - In the sidebar variant, full width with padding 4.
 * The brand's accessible name is "Tempo".
 */
export const Brand = forwardRef<HTMLDivElement, BrandProps>(
  ({ withName = false, variant = 'auth', className, ...props }, ref) => {
    const mark = (
      <div
        className={cn(
          // Container: 28x28, radius 8, accent background
          'w-7 h-7 rounded-lg bg-accent',
          // Flex center for icon
          'flex items-center justify-center',
          // Ensure it doesn't shrink
          'flex-shrink-0',
        )}
      >
        <Check
          size={16}
          className="text-on-accent"
          strokeWidth={2}
          aria-hidden="true"
        />
      </div>
    );

    if (!withName) {
      // Mark only: accessible name is required
      // Use a div with role="img" to provide an accessible name
      return (
        <div
          ref={ref}
          role="img"
          aria-label="Tempo"
          className={cn('inline-flex items-center', className)}
          {...props}
        >
          {mark}
        </div>
      );
    }

    // Mark with name
    const containerClassName =
      variant === 'sidebar'
        ? cn(
            // Sidebar: full width with padding 4 (p-1), gap 10 (gap-2.5)
            'w-full px-1 py-1 gap-2.5',
            'flex items-center',
          )
        : cn(
            // Auth: standard horizontal layout with gap 10 (gap-2.5)
            'flex items-center gap-2.5',
          );

    return (
      <div
        ref={ref}
        role="img"
        aria-label="Tempo"
        className={cn(containerClassName, className)}
        {...props}
      >
        {mark}
        <span className="text-base font-semibold text-text" aria-hidden="true">
          Tempo
        </span>
      </div>
    );
  },
);

Brand.displayName = 'Brand';
