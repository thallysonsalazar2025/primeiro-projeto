const MIN_SESSION_SECRET_LENGTH = 32;

export function resolveSessionSecret(value = process.env.SESSION_SECRET) {
  const secret = value?.trim();
  if (!secret) throw new Error('SESSION_SECRET is required');
  if (secret.length < MIN_SESSION_SECRET_LENGTH) {
    throw new Error(`SESSION_SECRET must contain at least ${MIN_SESSION_SECRET_LENGTH} characters`);
  }
  return secret;
}

export function sessionSecretBytes(value = process.env.SESSION_SECRET) {
  return new TextEncoder().encode(resolveSessionSecret(value));
}
