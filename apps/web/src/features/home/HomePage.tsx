import { useHealth } from './use-health.ts';
import { useMe } from '../auth/use-me.ts';
import { Brand } from '../../components/Brand/Brand.tsx';
import { UserCard } from '../../components/UserCard/UserCard.tsx';
import {
  Menu,
  MenuItem,
  MenuHeader,
  MenuDivider,
} from '../../components/Menu/Menu.tsx';
import { useSignOut } from '../auth/use-sign-out.ts';
import { LogOut } from 'lucide-react';

/** The start page, until the sign-in screen replaces it (E1). */
export function HomePage() {
  const { status } = useHealth();
  const { user, isLoading, isSignedIn } = useMe();
  const { signOut } = useSignOut();
  const healthText = status === 'ok' ? 'API: ok' : 'API: unavailable';

  // Show loading state or unsigned-in state
  if (isLoading || !isSignedIn) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-text">Tempo</h1>
          <p className="mt-4 text-text">{healthText}</p>
        </div>
      </main>
    );
  }

  // Show signed-in layout with sidebar
  return (
    <main className="flex min-h-screen">
      {/* Sidebar: 248px wide, left column on $surface with 1px border on right */}
      <div className="w-[248px] border-r border-border bg-surface flex flex-col">
        {/* Brand at the top */}
        <div className="flex-shrink-0 p-1">
          <Brand withName={true} variant="sidebar" />
        </div>

        {/* Spacer to push UserCard to bottom */}
        <div className="flex-1" />

        {/* User Card at the foot with Menu */}
        {user && (
          <div className="flex-shrink-0 p-2">
            <Menu
              width={236}
              trigger={
                <UserCard
                  name={user.fullName}
                  plan="Free plan"
                  aria-expanded="false"
                />
              }
            >
              <MenuHeader title={user.fullName} detail={user.email} />
              <MenuDivider />
              <MenuItem
                label="Sign out"
                icon={<LogOut size={16} />}
                danger={true}
                onSelect={signOut}
              />
            </Menu>
          </div>
        )}
      </div>

      {/* Main content area */}
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-text">Tempo</h1>
          <p className="mt-4 text-text">{healthText}</p>
        </div>
      </div>
    </main>
  );
}
