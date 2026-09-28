import { useHealth } from './use-health.ts';

/** The start page, until the sign-in screen replaces it (E1). */
export function HomePage() {
  const { status } = useHealth();
  const healthText = status === 'ok' ? 'API: ok' : 'API: unavailable';

  return (
    <main className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-semibold text-text">Tempo</h1>
        <p className="mt-4 text-text">{healthText}</p>
      </div>
    </main>
  );
}
