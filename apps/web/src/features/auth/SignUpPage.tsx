import { useState } from 'react';
import { useNavigate } from 'react-router';
import { AuthCard } from '../../components/AuthCard/AuthCard.tsx';
import { TextField } from '../../components/TextField/TextField.tsx';
import { useSignUp } from './use-sign-up.ts';

/** The sign-up screen: full name, email, password, submit, footer link to sign in. */
export function SignUpPage() {
  const navigate = useNavigate();
  const { signUp, isLoading, fieldErrors } = useSignUp();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const success = await signUp({ fullName, email, password });
    if (success) {
      navigate('/');
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-bg">
      <AuthCard
        heading="Create your account"
        subheading="Free forever for personal lists. No card needed."
        submitLabel="Create account"
        footerText="Already have an account?"
        footerLinkText="Sign in"
        footerLinkHref="/sign-in"
        onSubmit={handleSubmit}
      >
        <TextField
          label="Full name"
          type="text"
          placeholder="E.g. Mara Reyes"
          value={fullName}
          onChange={(e) => setFullName(e.currentTarget.value)}
          {...(fieldErrors.fullName && { error: fieldErrors.fullName })}
          disabled={isLoading}
        />
        <TextField
          label="Email"
          type="email"
          placeholder="mara@reyes.studio"
          value={email}
          onChange={(e) => setEmail(e.currentTarget.value)}
          {...(fieldErrors.email && { error: fieldErrors.email })}
          disabled={isLoading}
        />
        <TextField
          label="Password"
          type="password"
          hint="At least 8 characters and a number or symbol."
          value={password}
          onChange={(e) => setPassword(e.currentTarget.value)}
          {...(fieldErrors.password && { error: fieldErrors.password })}
          disabled={isLoading}
        />
      </AuthCard>
    </main>
  );
}
