export const AUTH_SESSION_COOKIE = '__Host-fvdms_session';
export const AUTH_CHALLENGE_COOKIE = '__Host-fvdms_challenge';

export type AuthCookieName = typeof AUTH_SESSION_COOKIE | typeof AUTH_CHALLENGE_COOKIE;

export interface AuthCookieDescriptor {
  readonly name: AuthCookieName;
  readonly value: string;
  readonly options: {
    readonly expires: Date;
    readonly httpOnly: true;
    readonly maxAge?: number;
    readonly path: '/';
    readonly sameSite: 'strict';
    readonly secure: true;
  };
}

const secureCookieOptions = {
  httpOnly: true,
  path: '/',
  sameSite: 'strict',
  secure: true,
} as const;

export function createAuthCookie(
  name: AuthCookieName,
  value: string,
  expires: Date,
): AuthCookieDescriptor {
  return { name, value, options: { ...secureCookieOptions, expires } };
}

export function deleteAuthCookie(name: AuthCookieName): AuthCookieDescriptor {
  return {
    name,
    value: '',
    options: { ...secureCookieOptions, expires: new Date(0), maxAge: 0 },
  };
}

export function readAuthCookie(request: Request, name: AuthCookieName): string | null {
  const header = request.headers.get('cookie');
  if (header === null) return null;

  for (const segment of header.split(';')) {
    const separator = segment.indexOf('=');
    if (separator < 0 || segment.slice(0, separator).trim() !== name) continue;
    const encodedValue = segment.slice(separator + 1).trim();
    if (encodedValue === '') return null;
    try {
      return decodeURIComponent(encodedValue);
    } catch {
      return null;
    }
  }

  return null;
}

export function appendAuthCookies(
  response: Response,
  cookies: readonly AuthCookieDescriptor[],
): Response {
  for (const cookie of cookies) response.headers.append('set-cookie', serializeAuthCookie(cookie));
  return response;
}

function serializeAuthCookie(cookie: AuthCookieDescriptor): string {
  const parts = [
    `${cookie.name}=${encodeURIComponent(cookie.value)}`,
    'Path=/',
    `Expires=${cookie.options.expires.toUTCString()}`,
    'HttpOnly',
    'Secure',
    'SameSite=Strict',
  ];
  if (cookie.options.maxAge !== undefined) parts.push(`Max-Age=${cookie.options.maxAge}`);
  return parts.join('; ');
}
