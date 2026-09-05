export function ingestionHeartbeatMs(staleClaimSeconds: number) {
  return Math.max(100, Math.floor((staleClaimSeconds * 1000) / 3));
}
