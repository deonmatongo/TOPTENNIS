type LogLevel = 'debug' | 'info' | 'warn' | 'error';

type LogContext = Record<string, unknown>;

const shouldLog = (level: LogLevel) => {
  if (import.meta.env.DEV) return true;
  return level === 'warn' || level === 'error';
};

const safeSerialize = (value: unknown) => {
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return String(value);
  }
};

const baseLog = (level: LogLevel, message: string, context?: LogContext) => {
  if (!shouldLog(level)) return;

  const prefix = `[${level.toUpperCase()}]`;
  const payload = context ? safeSerialize(context) : undefined;

  switch (level) {
    case 'debug':
      console.debug(prefix, message, payload);
      return;
    case 'info':
      console.info(prefix, message, payload);
      return;
    case 'warn':
      console.warn(prefix, message, payload);
      return;
    case 'error':
      console.error(prefix, message, payload);
      return;
  }
};

export const logger = {
  debug: (message: string, context?: LogContext) => baseLog('debug', message, context),
  info: (message: string, context?: LogContext) => baseLog('info', message, context),
  warn: (message: string, context?: LogContext) => baseLog('warn', message, context),
  error: (message: string, context?: LogContext) => baseLog('error', message, context),
};
