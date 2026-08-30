import { createHmac } from 'node:crypto';

function firstForwardedAddress(value: string | null) {
  if (!value) return null;
  const first = value.split(',')[0]?.trim();
  return first || null;
}

export function getClientIp(headers: Headers) {
  return firstForwardedAddress(headers.get('x-forwarded-for')) ?? headers.get('x-real-ip')?.trim() || null;
}

export function hashClientIp(ip: string | null, secret: string) {
  if (!ip) return null;
  return createHmac('sha256', secret).update(ip).digest('hex');
}
