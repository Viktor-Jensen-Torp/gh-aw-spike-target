import {
  type FastifyInstance,
  type FastifyReply,
  type FastifyRequest,
} from 'fastify';
import {
  SignUpRequest,
  SignUpResponse,
  SignInRequest,
  SignInResponse,
  MeResponse,
} from '@tempo/shared/auth';
import { signUp, signIn, getUserBySession, signOut } from './service.ts';
import { ApiError } from '../../lib/errors.ts';

const SECURE = process.env.NODE_ENV !== 'development';

function setCookie(
  reply: FastifyReply,
  name: string,
  value: string,
  maxAge: number,
): void {
  const flags = ['HttpOnly', `SameSite=Lax`];
  if (SECURE) {
    flags.push('Secure');
  }
  const cookieValue = `${name}=${value}; Path=/; Max-Age=${maxAge}; ${flags.join('; ')}`;
  reply.header('Set-Cookie', cookieValue);
}

function getCookie(request: FastifyRequest, name: string): string | undefined {
  const cookieHeader = request.headers.cookie;
  if (!cookieHeader) return undefined;

  const cookies = cookieHeader.split(';');
  for (const cookie of cookies) {
    const [key, value] = cookie.trim().split('=');
    if (key === name) {
      return value;
    }
  }
  return undefined;
}

export async function registerAuthRoutes(app: FastifyInstance): Promise<void> {
  app.post('/auth/sign-up', async (request, reply) => {
    const body = SignUpRequest.parse(request.body);
    const { user, sessionId } = await signUp(app.db, body);

    setCookie(reply, 'session', sessionId, 30 * 24 * 60 * 60);

    const response: SignUpResponse = { user };
    return reply.status(201).send(response);
  });

  app.post('/auth/sign-in', async (request, reply) => {
    const body = SignInRequest.parse(request.body);
    const { user, sessionId } = await signIn(app.db, body);

    setCookie(reply, 'session', sessionId, 30 * 24 * 60 * 60);

    const response: SignInResponse = { user };
    return reply.send(response);
  });

  app.get('/me', async (request, reply) => {
    const sessionId = getCookie(request, 'session');

    if (!sessionId) {
      throw new ApiError(401, 'unauthorized', 'Not signed in.');
    }

    const user = await getUserBySession(app.db, sessionId);

    if (!user) {
      throw new ApiError(401, 'unauthorized', 'Not signed in.');
    }

    const response: MeResponse = { user };
    return reply.send(response);
  });

  app.post('/auth/sign-out', async (request, reply) => {
    const sessionId = getCookie(request, 'session');

    if (!sessionId) {
      throw new ApiError(401, 'unauthorized', 'Not signed in.');
    }

    // Verify the session exists before deleting
    const user = await getUserBySession(app.db, sessionId);

    if (!user) {
      throw new ApiError(401, 'unauthorized', 'Not signed in.');
    }

    // Delete the session
    await signOut(app.db, sessionId);

    // Clear the session cookie by setting it to empty with Max-Age=0
    setCookie(reply, 'session', '', 0);

    return reply.send({});
  });
}
