export const AUTH_SESSION_COOKIE = "next-auth.session-token.v2";

export const AUTH_SESSION_COOKIES = [
  `__Secure-${AUTH_SESSION_COOKIE}`,
  AUTH_SESSION_COOKIE,
] as const;

export const LEGACY_AUTH_SESSION_COOKIES = [
  "__Secure-next-auth.session-token",
  "next-auth.session-token",
] as const;
