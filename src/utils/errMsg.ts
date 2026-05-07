// Phase G — uniform error-message helper. Lots of our axios catch blocks
// want the same "server detail || .message || fallback" string; consolidating
// here lets the lint rule against `any` stay strict in call sites.

interface AxiosLike {
  response?: { data?: { detail?: string } };
  message?: string;
}

export function errMsg(e: unknown, fallback = "unknown error"): string {
  const a = e as AxiosLike | undefined;
  return a?.response?.data?.detail || a?.message || fallback;
}
