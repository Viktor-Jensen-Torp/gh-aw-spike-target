import { randomBytes, scryptSync } from 'node:crypto';
import type { Db } from '../../db/client.ts';
import { users, sessions } from '../../db/schema.ts';
import { eq } from 'drizzle-orm';
import { ApiError } from '../../lib/errors.ts';

const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const SCRYPT_OPTIONS = {
  N: 16384,
  r: 8,
  p: 1,
};

/** Hash a password with scrypt and a random salt. */
function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 64, SCRYPT_OPTIONS);
  // Combine salt and hash: salt (16 bytes) + hash (64 bytes)
  return Buffer.concat([salt, hash]).toString('base64');
}

/** Verify a password against its hash. */
function verifyPassword(password: string, hash: string): boolean {
  const combined = Buffer.from(hash, 'base64');
  const salt = combined.subarray(0, 16);
  const storedHash = combined.subarray(16);
  const computedHash = scryptSync(password, salt, 64, SCRYPT_OPTIONS);
  return computedHash.equals(storedHash);
}

/** Generate a random session ID. */
function generateSessionId(): string {
  return randomBytes(32).toString('hex');
}

export interface User {
  id: string;
  fullName: string;
  email: string;
}

export interface SignUpData {
  fullName: string;
  email: string;
  password: string;
}

export interface SignInData {
  email: string;
  password: string;
}

/** Sign up a new user and create a session. Returns the user and session ID. */
export async function signUp(
  db: Db,
  data: SignUpData,
): Promise<{ user: User; sessionId: string }> {
  const normalizedEmail = data.email.toLowerCase().trim();

  // Check if email already exists
  const existing = await db
    .select()
    .from(users)
    .where(eq(users.email, normalizedEmail))
    .limit(1);

  if (existing.length > 0) {
    throw new ApiError(400, 'duplicate_email', 'Email already in use.');
  }

  const userId = randomBytes(16).toString('hex');
  const passwordHash = hashPassword(data.password);
  const now = Date.now();

  // Insert user - catch UNIQUE constraint violation (race condition)
  try {
    await db.insert(users).values({
      id: userId,
      fullName: data.fullName,
      email: normalizedEmail,
      passwordHash,
      createdAt: new Date(now),
    });
  } catch (error) {
    // Handle SQLite UNIQUE constraint violation on email
    if (
      error instanceof Error &&
      error.message.includes('UNIQUE constraint failed')
    ) {
      throw new ApiError(400, 'duplicate_email', 'Email already in use.');
    }
    throw error;
  }

  // Create session
  const sessionId = generateSessionId();
  const expiresAt = now + SESSION_DURATION_MS;

  await db.insert(sessions).values({
    id: sessionId,
    userId,
    expiresAt: new Date(expiresAt),
    createdAt: new Date(now),
  });

  return {
    user: {
      id: userId,
      fullName: data.fullName,
      email: normalizedEmail,
    },
    sessionId,
  };
}

/** Sign in a user and create a session. Returns the user and session ID. */
export async function signIn(
  db: Db,
  data: SignInData,
): Promise<{ user: User; sessionId: string }> {
  const normalizedEmail = data.email.toLowerCase().trim();

  const userRows = await db
    .select()
    .from(users)
    .where(eq(users.email, normalizedEmail))
    .limit(1);

  if (userRows.length === 0) {
    throw new ApiError(
      401,
      'invalid_credentials',
      'Invalid email or password.',
    );
  }

  const user = userRows[0]!;
  if (!verifyPassword(data.password, user.passwordHash)) {
    throw new ApiError(
      401,
      'invalid_credentials',
      'Invalid email or password.',
    );
  }

  // Create session
  const sessionId = generateSessionId();
  const now = Date.now();
  const expiresAt = now + SESSION_DURATION_MS;

  await db.insert(sessions).values({
    id: sessionId,
    userId: user.id,
    expiresAt: new Date(expiresAt),
    createdAt: new Date(now),
  });

  return {
    user: {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
    },
    sessionId,
  };
}

/** Get a user by session ID. Returns null if session is invalid or expired. */
export async function getUserBySession(
  db: Db,
  sessionId: string,
): Promise<User | null> {
  const sessionRows = await db
    .select()
    .from(sessions)
    .where(eq(sessions.id, sessionId))
    .limit(1);

  if (sessionRows.length === 0) {
    return null;
  }

  const session = sessionRows[0]!;
  const now = Date.now();

  // Check if session is expired
  if (session.expiresAt.getTime() < now) {
    return null;
  }

  // Get the user
  const userRows = await db
    .select()
    .from(users)
    .where(eq(users.id, session.userId))
    .limit(1);

  if (userRows.length === 0) {
    return null;
  }

  const user = userRows[0]!;
  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
  };
}
