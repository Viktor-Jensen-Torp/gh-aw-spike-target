import { describe, it, expect, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { testApp } from '../../lib/test-app.ts';

describe('Auth: POST /api/auth/sign-in', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await testApp();
  });

  describe('with valid credentials', () => {
    it('returns 200 with user and sets session cookie', async () => {
      // Sign up first
      await app.inject({
        method: 'POST',
        url: '/api/auth/sign-up',
        payload: {
          fullName: 'Mara Reyes',
          email: 'mara@reyes.studio',
          password: 'tempo2026!',
        },
      });

      // Sign in
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/sign-in',
        payload: {
          email: 'mara@reyes.studio',
          password: 'tempo2026!',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body).toEqual({
        user: {
          id: expect.any(String),
          fullName: 'Mara Reyes',
          email: 'mara@reyes.studio',
        },
      });
      // Ensure no password hash is returned
      expect(body.user).not.toHaveProperty('passwordHash');
      expect(body.user).not.toHaveProperty('password');

      // Check session cookie was set
      const setCookieHeader = response.headers['set-cookie'];
      expect(setCookieHeader).toBeDefined();
    });
  });

  describe('with wrong password', () => {
    it('returns 401 with message "Email or password is incorrect."', async () => {
      // Sign up first
      await app.inject({
        method: 'POST',
        url: '/api/auth/sign-up',
        payload: {
          fullName: 'Mara Reyes',
          email: 'mara@reyes.studio',
          password: 'tempo2026!',
        },
      });

      // Try to sign in with wrong password
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/sign-in',
        payload: {
          email: 'mara@reyes.studio',
          password: 'wrongpassword',
        },
      });

      expect(response.statusCode).toBe(401);
      expect(response.json()).toEqual({
        error: {
          code: 'invalid_credentials',
          message: 'Email or password is incorrect.',
        },
      });
    });
  });

  describe('with unknown email', () => {
    it('returns 401 with the same message as wrong password', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/sign-in',
        payload: {
          email: 'nobody@example.com',
          password: 'anypassword',
        },
      });

      expect(response.statusCode).toBe(401);
      expect(response.json()).toEqual({
        error: {
          code: 'invalid_credentials',
          message: 'Email or password is incorrect.',
        },
      });
    });
  });

  describe('the session cookie in development', () => {
    it('is marked HttpOnly and SameSite=Lax but not Secure', async () => {
      // Sign in to get a session cookie
      await app.inject({
        method: 'POST',
        url: '/api/auth/sign-up',
        payload: {
          fullName: 'Test User',
          email: 'test@example.com',
          password: 'password123',
        },
      });

      const signInResponse = await app.inject({
        method: 'POST',
        url: '/api/auth/sign-in',
        payload: {
          email: 'test@example.com',
          password: 'password123',
        },
      });

      expect(signInResponse.statusCode).toBe(200);

      // Get the Set-Cookie header
      const setCookieHeader = signInResponse.headers['set-cookie'];
      const setCookieStr = Array.isArray(setCookieHeader)
        ? setCookieHeader[0]
        : (setCookieHeader as string | undefined);

      expect(setCookieStr).toBeDefined();
      // In development (NODE_ENV not 'production'), Secure should not be set
      expect(setCookieStr).not.toContain('Secure');
      // But HttpOnly and SameSite=Lax should always be set
      expect(setCookieStr).toContain('HttpOnly');
      expect(setCookieStr).toContain('SameSite=Lax');
    });
  });

  describe('the session cookie in production', () => {
    it('is marked Secure, HttpOnly and SameSite=Lax when NODE_ENV=production', async () => {
      // Save the original NODE_ENV
      const originalEnv = process.env.NODE_ENV;

      try {
        // Set NODE_ENV to production for this test
        process.env.NODE_ENV = 'production';

        // Create a fresh app instance (now with NODE_ENV=production in effect)
        const prodApp = await testApp();

        try {
          // Sign up first
          await prodApp.inject({
            method: 'POST',
            url: '/api/auth/sign-up',
            payload: {
              fullName: 'Test User',
              email: 'prod@example.com',
              password: 'password123',
            },
          });

          // Sign in to get a session cookie
          const signInResponse = await prodApp.inject({
            method: 'POST',
            url: '/api/auth/sign-in',
            payload: {
              email: 'prod@example.com',
              password: 'password123',
            },
          });

          expect(signInResponse.statusCode).toBe(200);

          // Get the Set-Cookie header
          const setCookieHeader = signInResponse.headers['set-cookie'];
          const setCookieStr = Array.isArray(setCookieHeader)
            ? setCookieHeader[0]
            : (setCookieHeader as string | undefined);

          expect(setCookieStr).toBeDefined();
          // In production (NODE_ENV='production'), all three flags should be set
          expect(setCookieStr).toContain('Secure');
          expect(setCookieStr).toContain('HttpOnly');
          expect(setCookieStr).toContain('SameSite=Lax');
        } finally {
          await prodApp.close();
        }
      } finally {
        // Restore the original NODE_ENV
        process.env.NODE_ENV = originalEnv;
      }
    });
  });
});
