import { forwardRef, type ReactNode, useState, useCallback } from 'react';
import * as DropdownMenu from 'radix-ui/dropdown-menu';
import { cn } from '../../lib/utils.ts';

interface MenuItemProps {
  /** Label text for the menu item. */
  label: string;
  /** Optional icon component from lucide-react (16px or 14px depending on size). */
  icon?: ReactNode;
  /** Optional shortcut text shown at the end (compact size only). */
  shortcut?: string;
  /** Whether this item is dangerous (Sign out, delete, etc). */
  danger?: boolean;
  /** Callback when the item is selected. */
  onSelect?: () => void;
  /** Size variant: 'default' (Settings Nav Item) or 'compact' (Menu Item). */
  size?: 'default' | 'compact';
  /** Custom className. */
  className?: string;
  /** Whether the item is disabled. */
  disabled?: boolean;
}

interface MenuDividerProps {
  className?: string;
}

interface MenuHeaderProps {
  /** Title text (13px weight 600). */
  title: string;
  /** Detail text (11px $faint). */
  detail: string;
  className?: string;
}

interface MenuProps {
  /** Width of the menu in pixels. Default 236 for user menu, 216 for context menu. */
  width?: number;
  /** Menu content: header, items, dividers. */
  children: ReactNode;
  /** Whether the menu is open (controlled). */
  open?: boolean;
  /** Callback when open state changes. */
  onOpenChange?: (open: boolean) => void;
  /** Trigger element. */
  trigger: ReactNode;
}

/**
 * Menu item component - used inside Menu.
 * Supports two sizes: default (Settings Nav Item) and compact (Menu Item).
 * Can be a danger item, disabled, or have a shortcut.
 */
const MenuItem = forwardRef<HTMLDivElement, MenuItemProps>(
  (
    {
      label,
      icon,
      shortcut,
      danger = false,
      size = 'default',
      onSelect,
      className,
      disabled,
      ...props
    },
    ref,
  ) => {
    const isDefault = size === 'default';

    return (
      <DropdownMenu.Item
        ref={ref}
        {...(disabled !== undefined && { disabled })}
        {...(onSelect && { onSelect })}
        className={cn(
          // Base: flex row, gap, padding, radius
          'flex items-center',
          isDefault
            ? 'gap-2.5 px-2.5 py-2 rounded-[7px]'
            : 'gap-[9px] px-[9px] py-[7px] rounded-[6px]',
          // Typography: label
          'text-[13px] font-normal',
          // Colors: text and background
          danger ? 'text-danger' : 'text-text',
          'focus:bg-bg focus-visible:outline-none focus-visible:ring-0',
          'data-[highlighted]:bg-bg',
          // Disabled
          disabled && 'opacity-50 cursor-not-allowed',
          className,
        )}
        {...props}
      >
        {/* Icon */}
        {icon && (
          <div
            className={cn(
              'flex-shrink-0',
              danger ? 'text-danger' : 'text-muted',
            )}
          >
            {typeof icon === 'string' ? (
              <div dangerouslySetInnerHTML={{ __html: icon }} />
            ) : (
              icon
            )}
          </div>
        )}

        {/* Label */}
        <span className="flex-1 text-[13px] font-normal">{label}</span>

        {/* Shortcut (compact only) */}
        {shortcut && size === 'compact' && (
          <span className="text-xs font-normal text-faint">{shortcut}</span>
        )}
      </DropdownMenu.Item>
    );
  },
);

MenuItem.displayName = 'MenuItem';

/**
 * Menu divider component - used inside Menu.
 */
const MenuDivider = forwardRef<HTMLDivElement, MenuDividerProps>(
  ({ className }, ref) => (
    <DropdownMenu.Separator
      ref={ref}
      className={cn('h-px bg-border my-1', className)}
    />
  ),
);

MenuDivider.displayName = 'MenuDivider';

/**
 * Menu header component - used inside Menu for optional header.
 */
const MenuHeader = forwardRef<HTMLDivElement, MenuHeaderProps>(
  ({ title, detail, className }, ref) => (
    <div
      ref={ref}
      className={cn(
        // Container: flex column, gap 1, padding
        'flex flex-col gap-px px-2.5 py-2',
        className,
      )}
    >
      {/* Title: 13px weight 600 */}
      <div className="text-[13px] font-semibold text-text">{title}</div>
      {/* Detail: 11px $faint */}
      <div className="text-[11px] font-normal text-faint">{detail}</div>
    </div>
  ),
);

MenuHeader.displayName = 'MenuHeader';

/**
 * Dropdown menu component with optional header, items in two sizes,
 * dividers, and danger items. Uses Radix's dropdown menu for keyboard
 * navigation and accessibility.
 *
 * Structure:
 * - Width (236px user menu, 216px context menu), padding 6, radius 10
 * - $surface background, 1px $border
 * - Optional header (padding 8 by 10, gap 1)
 * - Items: default (Settings Nav Item) or compact (Menu Item) with optional shortcut
 * - Danger item: icon and label $danger
 * - Dividers: 1px $border
 * - Keyboard: arrow keys navigate, Enter selects, Escape closes
 */
const Menu = forwardRef<HTMLDivElement, MenuProps>(
  ({ width = 236, children, open, onOpenChange, trigger, ...props }, ref) => {
    const [internalOpen, setInternalOpen] = useState(open ?? false);
    const isControlled = open !== undefined;
    const isOpen = isControlled ? open : internalOpen;

    const handleOpenChange = useCallback(
      (newOpen: boolean) => {
        if (!isControlled) {
          setInternalOpen(newOpen);
        }
        onOpenChange?.(newOpen);
      },
      [isControlled, onOpenChange],
    );

    return (
      <DropdownMenu.Root open={isOpen} onOpenChange={handleOpenChange}>
        <DropdownMenu.Trigger asChild>{trigger}</DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            ref={ref}
            style={{ width: `${width}px` }}
            className={cn(
              // Sizing and spacing
              'px-1.5 py-1.5',
              // Radius
              'rounded-[10px]',
              // Colors
              'bg-surface',
              'border border-border',
              // Shadow - from design tokens
              'shadow-lg',
              // Z-index
              'z-50',
            )}
            sideOffset={8}
            {...props}
          >
            {children}
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    );
  },
);

Menu.displayName = 'Menu';

export { Menu, MenuItem, MenuDivider, MenuHeader };
export type { MenuProps, MenuItemProps, MenuDividerProps, MenuHeaderProps };
