const MAX_NODE_TIMER_DELAY_MS = 2_147_483_647;

export function ingestionHeartbeatMs(staleClaimSeconds: number) {
  const targetDelayMs = Math.max(100, Math.floor((staleClaimSeconds * 1000) / 3));
  return Math.min(targetDelayMs, MAX_NODE_TIMER_DELAY_MS);
}
