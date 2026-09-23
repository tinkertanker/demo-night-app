// Short codes attendees type (or scan) to join a live event, e.g. demo-night.tk.sg/K7QX.
// The alphabet has no vowels (so codes never spell words or collide with routes like
// /auth) and no look-alike characters (0/O, 1/I/L).
export const JOIN_CODE_LENGTH = 4;
export const JOIN_CODE_ALPHABET = "BCDFGHJKMNPQRSTVWXYZ23456789";

// Admins may pick their own code, so allow any letters/digits there, but not
// ones that shadow top-level routes.
const RESERVED_JOIN_CODES = new Set(["AUTH"]);
const JOIN_CODE_PATTERN = new RegExp(`^[A-Z0-9]{${JOIN_CODE_LENGTH}}$`);

export function generateJoinCode(random: () => number = Math.random): string {
  let code = "";
  for (let i = 0; i < JOIN_CODE_LENGTH; i++) {
    code +=
      JOIN_CODE_ALPHABET[Math.floor(random() * JOIN_CODE_ALPHABET.length)];
  }
  return code;
}

export function normalizeJoinCode(code: string): string {
  return code.trim().toUpperCase();
}

export function isValidJoinCode(code: string): boolean {
  return JOIN_CODE_PATTERN.test(code) && !RESERVED_JOIN_CODES.has(code);
}
