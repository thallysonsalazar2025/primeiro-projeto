type LogLevel = 'info' | 'warn' | 'error';

type LogFields = Record<string, unknown>;

type LogSink = (line: string) => void;

const REDACTED = '[REDACTED]';
const SENSITIVE_KEY = /(authorization|cookie|password|secret|token|credential|session)/i;

function sanitize(value: unknown, seen = new WeakSet<object>()): unknown {
  if (value instanceof Error) {
    return { name: value.name };
  }
  if (typeof value === 'bigint') return value.toString();
  if (Array.isArray(value)) return value.map((item) => sanitize(item, seen));
  if (!value || typeof value !== 'object') return value;
  if (seen.has(value)) return '[Circular]';

  seen.add(value);
  const sanitized: Record<string, unknown> = {};
  for (const [key, nested] of Object.entries(value)) {
    sanitized[key] = SENSITIVE_KEY.test(key) ? REDACTED : sanitize(nested, seen);
  }
  seen.delete(value);
  return sanitized;
}

export function structuredLog(
  level: LogLevel,
  event: string,
  fields: LogFields = {},
  options?: { now?: Date; sink?: LogSink },
) {
  const line = JSON.stringify({
    ...(sanitize(fields) as LogFields),
    timestamp: (options?.now ?? new Date()).toISOString(),
    level,
    event,
  });

  (options?.sink ?? console.log)(line);
  return line;
}
