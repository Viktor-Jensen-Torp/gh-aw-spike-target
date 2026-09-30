import { useState } from 'react';
import { api, ApiClientError } from '../../lib/api-client.ts';
import { SignUpRequest, SignUpResponse } from '@tempo/shared/auth';
import { ZodError } from 'zod';

interface FieldErrors {
  fullName?: string;
  email?: string;
  password?: string;
}

export function useSignUp() {
  const [isLoading, setIsLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  async function signUp(data: {
    fullName: string;
    email: string;
    password: string;
  }): Promise<boolean> {
    setIsLoading(true);
    setFieldErrors({});

    try {
      // Validate with the shared schema to get client-side errors
      const validated = SignUpRequest.parse(data);

      // Call the API
      await api('/auth/sign-up', SignUpResponse, {
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
          if (path === 'fullName' || path === 'email' || path === 'password') {
            errors[path as keyof FieldErrors] = issue.message;
          }
        }
        setFieldErrors(errors);
      } else if (error instanceof ApiClientError) {
        // Handle API errors
        if (error.status === 409 && error.code === 'duplicate_email') {
          // Email already in use
          setFieldErrors({ email: error.message });
        } else {
          // Other errors
          setFieldErrors({ fullName: error.message });
        }
      } else {
        // Unknown error
        setFieldErrors({ fullName: 'Something went wrong.' });
      }
      return false;
    } finally {
      setIsLoading(false);
    }
  }

  return { signUp, isLoading, fieldErrors };
}
