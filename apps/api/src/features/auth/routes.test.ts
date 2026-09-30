import { describe, it, expect, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { testApp } from '../../lib/test-app.ts';

describe('Auth Routes', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await testApp();
  });

  describe('GET /api/me with no cookie', () => {
    it('returns 401 in the one error shape', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/me',
      });

      expect(response.statusCode).toBe(401);
      expect(response.json()).toEqual({
        error: {
          code: 'unauthorized',
          message: 'Not signed in.',
        },
      });
    });
  });

  describe('GET /api/me with a valid session cookie', () => {
    it('returns 200 with that user, no password hash', async () => {
      // Sign up first
      const signUpResponse = await app.inject({
        method: 'POST',
        url: '/api/auth/sign-up',
        payload: {
          fullName: 'Test User',
          email: 'test@example.com',
          password: 'password123',
        },
      });

      expect(signUpResponse.statusCode).toBe(201);

      // Extract session cookie from Set-Cookie header
      const setCookieHeader = signUpResponse.headers['set-cookie'];
      expect(setCookieHeader).toBeDefined();
      // Parse the cookie to extract session value
      const setCookieStr = Array.isArray(setCookieHeader)
        ? setCookieHeader[0]
        : (setCookieHeader as string | undefined);
      const sessionMatch = setCookieStr?.match(/session=([^;]+)/);
      const sessionId = sessionMatch?.[1];
      expect(sessionId).toBeDefined();

      // Get /api/me with the session cookie
      const meResponse = await app.inject({
        method: 'GET',
        url: '/api/me',
        headers: {
          cookie: `session=${sessionId}`,
        },
      });

      expect(meResponse.statusCode).toBe(200);
      const body = meResponse.json();
      expect(body).toEqual({
        user: {
          id: expect.any(String),
          fullName: 'Test User',
          email: 'test@example.com',
        },
      });
      // Ensure no password hash is returned
      expect(body.user).not.toHaveProperty('passwordHash');
      expect(body.user).not.toHaveProperty('password');
    });
  });

  describe('a session older than 30 days', () => {
    it('returns 401', async () => {
      // Sign up
      const signUpResponse = await app.inject({
        method: 'POST',
        url: '/api/auth/sign-up',
        payload: {
          fullName: 'Test User',
          email: 'test@example.com',
          password: 'password123',
        },
      });

      const setCookieHeader = signUpResponse.headers['set-cookie'];
      const setCookieStr = Array.isArray(setCookieHeader)
        ? setCookieHeader[0]
        : (setCookieHeader as string | undefined);
      const sessionMatch = setCookieStr?.match(/session=([^;]+)/);
      const sessionId = sessionMatch?.[1];

      // Manually update session to be expired by directly manipulating DB
      const db = app.db;
      const { sessions } = await import('../../db/schema.ts');
      const { eq } = await import('drizzle-orm');

      // Update the session to be expired
      await db
        .update(sessions)
        .set({ expiresAt: new Date(Date.now() - 1) })
        .where(eq(sessions.id, sessionId || ''));

      // Try to get /api/me with expired session
      const meResponse = await app.inject({
        method: 'GET',
        url: '/api/me',
        headers: {
          cookie: `session=${sessionId}`,
        },
      });

      expect(meResponse.statusCode).toBe(401);
      expect(meResponse.json()).toEqual({
        error: {
          code: 'unauthorized',
          message: 'Not signed in.',
        },
      });
    });
  });

  describe('two users with Mara@Reyes.studio and mara@reyes.studio', () => {
    it('the second is refused as a duplicate', async () => {
      // Sign up first user with capitalized email
      const first = await app.inject({
        method: 'POST',
        url: '/api/auth/sign-up',
        payload: {
          fullName: 'Mara Reyes',
          email: 'Mara@Reyes.studio',
          password: 'password123',
        },
      });

      expect(first.statusCode).toBe(201);

      // Try to sign up second user with lowercase email
      const second = await app.inject({
        method: 'POST',
        url: '/api/auth/sign-up',
        payload: {
          fullName: 'Another Mara',
          email: 'mara@reyes.studio',
          password: 'password123',
        },
      });

      expect(second.statusCode).toBe(409);
      expect(second.json()).toEqual({
        error: {
          code: 'duplicate_email',
          message:
            'This email is already in use. Sign in instead or reset your password.',
        },
      });
    });
  });

  describe('the stored password', () => {
    it('is an scrypt hash with a salt, never the password', async () => {
      // Sign up
      await app.inject({
        method: 'POST',
        url: '/api/auth/sign-up',
        payload: {
          fullName: 'Test User',
          email: 'test@example.com',
          password: 'password123',
        },
      });

      // Get the user from DB
      const db = app.db;
      const { users } = await import('../../db/schema.ts');
      const { eq } = await import('drizzle-orm');

      const userRows = await db
        .select()
        .from(users)
        .where(eq(users.email, 'test@example.com'));

      expect(userRows).toHaveLength(1);
      const user = userRows[0]!;

      // Verify it's not the plain password
      expect(user.passwordHash).not.toBe('password123');

      // Verify it's a base64-encoded hash with salt (should decode to 80 bytes: 16 salt + 64 hash)
      const decoded = Buffer.from(user.passwordHash, 'base64');
      expect(decoded.length).toBe(80); // 16 bytes salt + 64 bytes hash from scrypt

      // Verify it can be used to verify the correct password (through service)
      const signInResponse = await app.inject({
        method: 'POST',
        url: '/api/auth/sign-in',
        payload: {
          email: 'test@example.com',
          password: 'password123',
        },
      });

      expect(signInResponse.statusCode).toBe(200);
    });
  });

  describe('two concurrent requests with the same email', () => {
    it('the second returns 400 duplicate_email, not a database error', async () => {
      // Fire two concurrent sign-up requests with the same email
      const results = await Promise.allSettled([
        app.inject({
          method: 'POST',
          url: '/api/auth/sign-up',
          payload: {
            fullName: 'User One',
            email: 'concurrent@example.com',
            password: 'password123',
          },
        }),
        app.inject({
          method: 'POST',
          url: '/api/auth/sign-up',
          payload: {
            fullName: 'User Two',
            email: 'concurrent@example.com',
            password: 'password456',
          },
        }),
      ]);

      // Both should settle
      expect(results[0]).toHaveProperty('status', 'fulfilled');
      expect(results[1]).toHaveProperty('status', 'fulfilled');

      const response1 =
        results[0].status === 'fulfilled' ? results[0].value : null;
      const response2 =
        results[1].status === 'fulfilled' ? results[1].value : null;

      expect(response1).toBeDefined();
      expect(response2).toBeDefined();

      // One should succeed (201)
      const successCount = [
        response1?.statusCode,
        response2?.statusCode,
      ].filter((code) => code === 201).length;
      expect(successCount).toBe(1);

      // The other should return 409 duplicate_email
      const failureResponse =
        response1?.statusCode === 201 ? response2 : response1;
      expect(failureResponse?.statusCode).toBe(409);
      expect(failureResponse?.json()).toEqual({
        error: {
          code: 'duplicate_email',
          message:
            'This email is already in use. Sign in instead or reset your password.',
        },
      });
    });
  });

  describe('GET /api/health with no cookie', () => {
    it('returns 200', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/health',
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ status: 'ok' });
    });
  });
});
