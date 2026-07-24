import { captureError, captureMessage } from './sentry';

// In production, console.* calls are stripped by babel-plugin-transform-remove-console.
// This logger routes warn/error to Sentry instead so nothing is silently lost.
// Usage: logger.error('useMatches', 'fetch failed', e)

type Level = 'debug' | 'info' | 'warn' | 'error';

function log(level: Level, tag: string, message: string, data?: unknown): void {
  if (__DEV__) {
    const label = `[${tag}] ${message}`;
    if (level === 'error') console.error(label, data ?? '');
    else if (level === 'warn') console.warn(label, data ?? '');
    else console.log(`[${level.toUpperCase()}] ${label}`, data ?? '');
    return;
  }
  if (level === 'error') {
    const err = data instanceof Error ? data : new Error(message);
    captureError(err, { tag, detail: message });
  } else if (level === 'warn') {
    captureMessage(`[${tag}] ${message}`);
  }
  // info / debug are no-ops in production
}

export const logger = {
  debug: (tag: string, msg: string, data?: unknown) => log('debug', tag, msg, data),
  info:  (tag: string, msg: string, data?: unknown) => log('info',  tag, msg, data),
  warn:  (tag: string, msg: string, data?: unknown) => log('warn',  tag, msg, data),
  error: (tag: string, msg: string, data?: unknown) => log('error', tag, msg, data),
};
