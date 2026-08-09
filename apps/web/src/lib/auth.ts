import { createHmac, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { eq } from 'drizzle-orm';
import { users, verifyPassword } from '@metrookeh/db';
import { getDb } from './db';
import { ensureEnv } from './env';

const SESSION_COOKIE = 'metrookeh_session';
const SESSION_MAX_AGE_SEC = 60 * 60 * 24 * 7;

export type SessionUser = {
  id: string;
  username: string;
  displayName: string;
  role: string;
};

function getAuthSecret(): string {
  ensureEnv();
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error('AUTH_SECRET is not set');
  }
  return secret;
}

function sign(payload: string): string {
  return createHmac('sha256', getAuthSecret()).update(payload).digest('base64url');
}

function encodeSession(user: SessionUser): string {
  const body = Buffer.from(
    JSON.stringify({
      ...user,
      exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SEC,
    }),
  ).toString('base64url');
  return `${body}.${sign(body)}`;
}

function decodeSession(token: string): SessionUser | null {
  const [body, signature] = token.split('.');
  if (!body || !signature) return null;

  const expected = sign(body);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    const data = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as SessionUser & {
      exp?: number;
    };
    if (!data.id || !data.username || !data.exp) return null;
    if (data.exp < Math.floor(Date.now() / 1000)) return null;
    return {
      id: data.id,
      username: data.username,
      displayName: data.displayName,
      role: data.role,
    };
  } catch {
    return null;
  }
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return decodeSession(token);
}

export async function requireSessionUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) {
    throw new Error('UNAUTHORIZED');
  }
  return user;
}

export async function loginWithPassword(
  username: string,
  password: string,
): Promise<{ ok: true; user: SessionUser } | { ok: false; error: string }> {
  const db = getDb();
  const [row] = await db.select().from(users).where(eq(users.username, username)).limit(1);

  if (!row || !row.isActive || !verifyPassword(password, row.passwordHash)) {
    return { ok: false, error: 'نام کاربری یا رمز عبور نادرست است.' };
  }

  const user: SessionUser = {
    id: row.id,
    username: row.username,
    displayName: row.displayName,
    role: row.role,
  };

  const jar = await cookies();
  jar.set(SESSION_COOKIE, encodeSession(user), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_MAX_AGE_SEC,
  });

  return { ok: true, user };
}

export async function logoutSession(): Promise<void> {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  });
}
