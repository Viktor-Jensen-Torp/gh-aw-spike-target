import { useState } from 'react';
import { useNavigate } from 'react-router';
import { AuthCard } from '../../components/AuthCard/AuthCard.tsx';
import { TextField } from '../../components/TextField/TextField.tsx';
import { useSignIn } from './use-sign-in.ts';

/** The sign-in screen: email, password with show/hide toggle, submit, footer link to sign up. */
export function SignInPage() {
  const navigate = useNavigate();
  const { signIn, isLoading, fieldErrors } = useSignIn();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const success = await signIn({ email, password });
    if (success) {
      navigate('/');
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-bg">
      <AuthCard
        heading="Welcome back"
        subheading="Sign in to pick up where you left off."
        submitLabel="Sign in"
        footerText="Don't have an account?"
        footerLinkText="Create one"
        footerLinkHref="/sign-up"
        onSubmit={handleSubmit}
      >
        <TextField
          label="Email"
          type="email"
          placeholder="mara@reyes.studio"
          value={email}
          onChange={(e) => setEmail(e.currentTarget.value)}
          {...(fieldErrors.email && { error: fieldErrors.email })}
          {...(fieldErrors.emailInvalidWithoutError && {
            invalidWithoutError: fieldErrors.emailInvalidWithoutError,
          })}
          disabled={isLoading}
        />
        <TextField
          label="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.currentTarget.value)}
          {...(fieldErrors.password && { error: fieldErrors.password })}
          disabled={isLoading}
        />
      </AuthCard>
    </main>
  );
}
