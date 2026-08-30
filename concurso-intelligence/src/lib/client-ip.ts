import { createHmac } from 'node:crypto';

export type TrustedIpHeader = 'x-forwarded-for' | 'x-real-ip';

function firstForwardedAddress(value: string | null) {
  if (!value) return null;
  const first = value.split(',')[0]?.trim();
  return first || null;
}

export function getClientIp(headers: Headers, trustedHeader: string | undefined) {
  if (trustedHeader === 'x-forwarded-for') {
    return firstForwardedAddress(headers.get('x-forwarded-for'));
  }

  if (trustedHeader === 'x-real-ip') {
    return headers.get('x-real-ip')?.trim() || null;
  }

  return null;
}

export function selectIpHashSecret(ipHashSecret: string | undefined, sessionSecret: string | undefined) {
  const dedicatedSecret = ipHashSecret?.trim();
  if (dedicatedSecret) return dedicatedSecret;

  const fallbackSecret = sessionSecret?.trim();
  return fallbackSecret || undefined;
}

export function hashClientIp(ip: string | null, secret: string | undefined) {
  if (!ip || !secret) return null;
  return createHmac('sha256', secret).update(ip).digest('hex');
}
