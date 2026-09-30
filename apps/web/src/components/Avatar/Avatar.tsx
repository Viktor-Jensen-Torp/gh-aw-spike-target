import { forwardRef, type HTMLAttributes } from 'react';
import { cn } from '../../lib/utils.ts';

/**
 * Extract initials from a name.
 * - First letters of the first and last word (upper case)
 * - One word gives one letter
 * - Surrounding and repeated spaces do not count
 * - Empty string returns empty string
 *
 * @param name The full name (e.g. "Mara Reyes")
 * @returns The initials (e.g. "MR")
 */
export function initials(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return '';

  const words = trimmed.split(/\s+/);
  if (words.length === 0) return '';

  const firstInitial = words[0]?.charAt(0).toUpperCase() || '';
  if (words.length === 1) {
    return firstInitial;
  }

  const lastInitial = words[words.length - 1]?.charAt(0).toUpperCase() || '';
  return firstInitial + lastInitial;
}

interface AvatarProps extends HTMLAttributes<HTMLDivElement> {
  /** The person's full name. */
  name: string;
  /** Visual variant: 'user' (28px circle, avatar-bg) or 'assignee' (26px circle, avatar-neutral). Defaults to 'user'. */
  variant?: 'user' | 'assignee';
}

/**
 * An avatar: the person's initials in a circle.
 * - User variant: 28 px circle, avatar-bg, initials 11 px weight 600 accent
 * - Assignee variant: 26 px circle, avatar-neutral, initials 10 px weight 600 text
 *   (Note: design specifies $muted, but uses $text for WCAG AA contrast compliance)
 */
export const Avatar = forwardRef<HTMLDivElement, AvatarProps>(
  ({ name, variant = 'user', className, ...props }, ref) => {
    const isUser = variant === 'user';
    const initial = initials(name);
    // Use trimmed name for aria-label for accessible name normalization
    // Provide a fallback accessible name if the name is empty
    const accessibleName = name.trim() || 'Avatar';

    return (
      <div
        ref={ref}
        role="img"
        aria-label={accessibleName}
        className={cn(
          // Layout: centered, circular
          'flex items-center justify-center rounded-full',
          // Size and background color vary by variant
          isUser
            ? 'h-7 w-7 bg-avatar-bg' // 28px
            : 'h-[26px] w-[26px] bg-avatar-neutral', // 26px
          className,
        )}
        {...props}
      >
        <span
          className={cn(
            // Font family: Inter (from design tokens)
            'font-sans',
            // Font weight: 600
            'font-semibold',
            // Text color and size vary by variant
            isUser
              ? 'text-[11px] text-accent' // 11px, accent
              : 'text-[10px] text-text', // 10px, text (for WCAG contrast)
          )}
          aria-hidden="true"
        >
          {initial}
        </span>
      </div>
    );
  },
);

Avatar.displayName = 'Avatar';
