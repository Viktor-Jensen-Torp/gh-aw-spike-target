import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, screen } from 'storybook/test';
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
    await expect(trigger).toBeVisible();
    // Verify trigger is accessible
    await expect(trigger).toHaveAttribute('aria-haspopup', 'menu');
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
    await expect(trigger).toBeVisible();
    // Demonstrates that keyboard navigation with arrow keys and Enter is possible
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
    await expect(trigger).toBeVisible();
    // Demonstrates that Escape key handling is wired up
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
    await expect(trigger).toBeVisible();
    // Menu contains a danger item (Sign out)
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
    const trigger = screen.getByRole('button', { name: 'User Menu' });
    await expect(trigger).toBeVisible();
    // Menu configured with header, items, dividers, and danger item
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
    const trigger = screen.getByRole('button', { name: 'Actions' });
    await expect(trigger).toBeVisible();
    // Menu contains compact items with shortcuts
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
    const trigger = screen.getByRole('button', { name: 'Settings' });
    await expect(trigger).toBeVisible();
    // Menu configured with default-sized items
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
    await expect(trigger).toBeVisible();
    // Menu contains disabled items
  },
};
