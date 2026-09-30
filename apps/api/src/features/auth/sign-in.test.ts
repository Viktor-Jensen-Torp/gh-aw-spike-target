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
});
