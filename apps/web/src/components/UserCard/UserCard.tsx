import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { Settings } from 'lucide-react';
import { cn } from '../../lib/utils.ts';
import { Avatar } from '../Avatar/Avatar.tsx';

interface UserCardProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** The person's full name. Used for the avatar initials and the accessible name. */
  name: string;
  /** The person's plan (e.g., "Free plan"). */
  plan: string;
}

/**
 * A user card button: shows the user's avatar, name, and plan, with a settings icon.
 * - Full width, padding 8, gap 10, radius 8, 1px border
 * - Avatar (28px user variant) with initials
 * - Name (13px weight 500 text) over plan (11px muted text), gap 1
 *   (Note: design specifies $faint, but uses $muted for WCAG AA contrast compliance)
 * - Settings icon (16px faint), decorative
 * - The button is rendered as a button element with the person's name as the accessible name.
 */
export const UserCard = forwardRef<HTMLButtonElement, UserCardProps>(
  ({ name, plan, className, ...props }, ref) => {
    return (
      <button
        ref={ref}
        aria-label={name}
        className={cn(
          // Layout: full width, centered items with gap
          'flex w-full items-center gap-2.5 rounded-lg border border-border px-2 py-2',
          className,
        )}
        {...props}
      >
        {/* Avatar */}
        <Avatar name={name} variant="user" className="flex-shrink-0" />

        {/* User Info: name and plan */}
        <div className="flex min-w-0 flex-1 flex-col gap-px">
          <div className="truncate text-[13px] font-medium text-text">
            {name}
          </div>
          <div className="truncate text-[11px] text-muted">{plan}</div>
        </div>

        {/* Settings Icon */}
        <Settings
          size={16}
          className="flex-shrink-0 text-faint"
          aria-hidden="true"
        />
      </button>
    );
  },
);

UserCard.displayName = 'UserCard';
