import { createHmac } from 'node:crypto';

function firstForwardedAddress(value: string | null) {
  if (!value) return null;
  const first = value.split(',')[0]?.trim();
  return first || null;
}

export function getClientIp(headers: Headers) {
  const forwarded = firstForwardedAddress(headers.get('x-forwarded-for'));
  if (forwarded) return forwarded;

  const realIp = headers.get('x-real-ip')?.trim();
  return realIp || null;
}

export function hashClientIp(ip: string | null, secret: string) {
  if (!ip) return null;
  return createHmac('sha256', secret).update(ip).digest('hex');
}
