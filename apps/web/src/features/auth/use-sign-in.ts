import { useState } from 'react';
import { api, ApiClientError } from '../../lib/api-client.ts';
import { SignInRequest, SignInResponse } from '@tempo/shared/auth';
import { ZodError } from 'zod';

interface FieldErrors {
  email?: string;
  password?: string;
}

export function useSignIn() {
  const [isLoading, setIsLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  async function signIn(data: {
    email: string;
    password: string;
  }): Promise<boolean> {
    setIsLoading(true);
    setFieldErrors({});

    try {
      // Validate with the shared schema to get client-side errors
      const validated = SignInRequest.parse(data);

      // Call the API
      await api('/auth/sign-in', SignInResponse, {
        method: 'POST',
        body: JSON.stringify(validated),
      });

      return true;
    } catch (error) {
      if (error instanceof ZodError) {
        // Handle client-side validation errors
        const errors: FieldErrors = {};
        for (const issue of error.issues) {
          const path = issue.path.join('.');
          if (path === 'email' || path === 'password') {
            errors[path as keyof FieldErrors] = issue.message;
          }
        }
        setFieldErrors(errors);
      } else if (error instanceof ApiClientError) {
        // Handle API errors - show under password field and mark both fields invalid
        if (error.status === 401 && error.code === 'invalid_credentials') {
          setFieldErrors({
            email: error.message,
            password: error.message,
          });
        } else {
          // Other errors
          setFieldErrors({ password: error.message });
        }
      } else {
        // Unknown error
        setFieldErrors({ password: 'Something went wrong.' });
      }
      return false;
    } finally {
      setIsLoading(false);
    }
  }

  return { signIn, isLoading, fieldErrors };
}
