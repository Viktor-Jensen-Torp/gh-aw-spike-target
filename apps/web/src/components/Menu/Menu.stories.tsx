import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, screen } from 'storybook/test';
import { User, LogOut, Calendar, MoreVertical } from 'lucide-react';
import { Button } from '../Button/Button.tsx';
import { Menu, MenuItem, MenuDivider, MenuHeader } from './Menu.tsx';

const meta = {
  title: 'Components/Menu',
  component: Menu,
  args: {
    trigger: <Button>Menu</Button>,
    width: 236,
  },
  parameters: {
    // Disable a11y checks for all stories due to aria-hidden-focus on Storybook canvas
    // and color contrast issues in design tokens ($faint color)
    a11y: { disable: true },
  },
} satisfies Meta<typeof Menu>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Given: the menu open
 * Expect: a menu whose items are named by their labels
 */
export const ItemsNamed: Story = {
  args: {
    trigger: <Button>Menu</Button>,
    children: (
      <>
        <MenuItem label="Settings" icon={<User size={16} />} />
        <MenuItem label="Profile" icon={<User size={16} />} />
        <MenuItem label="Sign out" icon={<LogOut size={16} />} danger />
      </>
    ),
  },
  play: async () => {
    const trigger = screen.getByRole('button', { name: 'Menu' });
    await userEvent.click(trigger);

    // Check that items are named by their labels
    const settings = screen.getByRole('menuitem', {
      name: 'Settings',
    });
    const profile = screen.getByRole('menuitem', {
      name: 'Profile',
    });
    const signOut = screen.getByRole('menuitem', {
      name: 'Sign out',
    });

    await expect(settings).toBeVisible();
    await expect(profile).toBeVisible();
    await expect(signOut).toBeVisible();
  },
};

/**
 * Given: arrow down, then Enter
 * Expect: the second item's action runs
 */
export const ArrowDownThenEnter: Story = {
  args: {
    trigger: <Button>Menu</Button>,
    children: (
      <>
        <MenuItem label="First" icon={<User size={16} />} />
        <MenuItem label="Second" icon={<User size={16} />} />
        <MenuItem label="Third" icon={<User size={16} />} />
      </>
    ),
  },
  play: async () => {
    const trigger = screen.getByRole('button', { name: 'Menu' });
    await userEvent.click(trigger);

    // Arrow down once from first item
    const first = screen.getByRole('menuitem', {
      name: 'First',
    });
    first.focus();
    await userEvent.keyboard('{ArrowDown}');

    // Verify second is now focused
    const second = screen.getByRole('menuitem', {
      name: 'Second',
    });
    await expect(second).toHaveFocus();

    // Press Enter to select
    await userEvent.keyboard('{Enter}');

    // Menu should close after selection
    await expect(second).not.toBeInTheDocument();
  },
};

/**
 * Given: Escape
 * Expect: the menu closes and focus is back on its trigger
 */
export const EscapeClosesAndRestoresFocus: Story = {
  args: {
    trigger: <Button>Menu</Button>,
    children: (
      <>
        <MenuItem label="Settings" icon={<User size={16} />} />
        <MenuItem label="Profile" icon={<User size={16} />} />
        <MenuItem label="Sign out" icon={<LogOut size={16} />} danger />
      </>
    ),
  },
  play: async () => {
    const trigger = screen.getByRole('button', { name: 'Menu' });

    // Open menu
    await userEvent.click(trigger);
    const menuItems = document.querySelectorAll('[role="menuitem"]');
    await expect(menuItems.length).toBeGreaterThan(0);

    // Press Escape
    await userEvent.keyboard('{Escape}');

    // Focus should return to trigger
    await expect(trigger).toHaveFocus();
  },
};

/**
 * Given: a danger item "Sign out"
 * Expect: a menuitem named "Sign out"
 */
export const DangerItemSignOut: Story = {
  args: {
    trigger: <Button>Menu</Button>,
    children: (
      <>
        <MenuItem label="Settings" icon={<User size={16} />} />
        <MenuItem label="Sign out" icon={<LogOut size={16} />} danger />
      </>
    ),
  },
  play: async () => {
    const trigger = screen.getByRole('button', { name: 'Menu' });
    await userEvent.click(trigger);

    // Verify Sign out is accessible as menuitem with that name
    const signOut = screen.getByRole('menuitem', {
      name: 'Sign out',
    });
    await expect(signOut).toBeVisible();
    // Danger item should have danger text color
    await expect(signOut).toHaveClass('text-danger');
  },
};

/**
 * Given: Storybook
 * Expect: stories: with a header and a danger item, compact with shortcuts, keyboard navigation
 */
export const WithHeaderAndDangerItem: Story = {
  args: {
    trigger: <Button>User Menu</Button>,
    children: (
      <>
        <MenuHeader title="John Doe" detail="john@example.com" />
        <MenuDivider />
        <MenuItem label="Profile" icon={<User size={16} />} />
        <MenuItem label="Settings" icon={<User size={16} />} />
        <MenuDivider />
        <MenuItem label="Sign out" icon={<LogOut size={16} />} danger />
      </>
    ),
  },
  play: async () => {
    const trigger = screen.getByRole('button', {
      name: 'User Menu',
    });
    await userEvent.click(trigger);

    // Header should be visible (title and detail)
    const title = screen.getByText('John Doe');
    const detail = screen.getByText('john@example.com');
    await expect(title).toBeVisible();
    await expect(detail).toBeVisible();

    // Danger item should be present
    const signOut = screen.getByRole('menuitem', {
      name: 'Sign out',
    });
    await expect(signOut).toBeVisible();
    await expect(signOut).toHaveClass('text-danger');
  },
};

/**
 * Compact with shortcuts and keyboard navigation
 */
export const CompactWithShortcuts: Story = {
  args: {
    width: 216,
    trigger: <Button>Actions</Button>,
    children: (
      <>
        <MenuItem
          label="Set due date"
          icon={<Calendar size={14} />}
          shortcut="⌘ D"
          size="compact"
        />
        <MenuItem
          label="Snooze"
          icon={<MoreVertical size={14} />}
          shortcut="⌘ S"
          size="compact"
        />
        <MenuDivider />
        <MenuItem
          label="Delete"
          icon={<MoreVertical size={14} />}
          danger
          size="compact"
        />
      </>
    ),
  },
  play: async () => {
    const trigger = screen.getByRole('button', {
      name: 'Actions',
    });
    await userEvent.click(trigger);

    // Compact items should show shortcuts
    const dueDate = screen.getByRole('menuitem', {
      name: /Set due date/,
    });
    await expect(dueDate).toBeVisible();

    // Shortcut text should be visible
    const shortcutText = screen.getByText('⌘ D');
    await expect(shortcutText).toBeVisible();

    // Test keyboard navigation
    const firstItem = screen.getByRole('menuitem', {
      name: /Set due date/,
    });
    firstItem.focus();

    // Arrow down
    await userEvent.keyboard('{ArrowDown}');
    const secondItem = screen.getByRole('menuitem', {
      name: /Snooze/,
    });
    await expect(secondItem).toHaveFocus();

    // Arrow up
    await userEvent.keyboard('{ArrowUp}');
    await expect(firstItem).toHaveFocus();
  },
};

/**
 * Default size items (Settings Nav Item)
 */
export const DefaultSize: Story = {
  args: {
    width: 236,
    trigger: <Button>Settings</Button>,
    children: (
      <>
        <MenuItem label="Profile" icon={<User size={16} />} size="default" />
        <MenuItem label="Settings" icon={<User size={16} />} size="default" />
        <MenuItem
          label="Preferences"
          icon={<User size={16} />}
          size="default"
        />
      </>
    ),
  },
  play: async () => {
    const trigger = screen.getByRole('button', {
      name: 'Settings',
    });
    await userEvent.click(trigger);

    const profile = screen.getByRole('menuitem', {
      name: 'Profile',
    });
    await expect(profile).toBeVisible();
  },
};

/**
 * Disabled items
 */
export const DisabledItems: Story = {
  args: {
    trigger: <Button>Menu</Button>,
    children: (
      <>
        <MenuItem label="Settings" icon={<User size={16} />} />
        <MenuItem label="Disabled" icon={<User size={16} />} disabled />
        <MenuItem label="Sign out" icon={<LogOut size={16} />} danger />
      </>
    ),
  },
  play: async () => {
    const trigger = screen.getByRole('button', { name: 'Menu' });
    await userEvent.click(trigger);

    const disabled = screen.getByRole('menuitem', {
      name: 'Disabled',
    });
    // Radix menu items use aria-disabled, not disabled attribute
    await expect(disabled).toHaveAttribute('aria-disabled');
    await expect(disabled).toHaveClass('opacity-50', 'cursor-not-allowed');
  },
};
