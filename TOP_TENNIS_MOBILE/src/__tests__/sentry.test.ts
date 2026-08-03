import { captureError, captureMessage, setUser, clearUser } from '@/services/sentry';

describe('Sentry service', () => {
  it('captureError does not throw when called', () => {
    expect(() => captureError(new Error('test'))).not.toThrow();
  });

  it('captureMessage does not throw when called', () => {
    expect(() => captureMessage('hello')).not.toThrow();
  });

  it('setUser and clearUser do not throw', () => {
    expect(() => setUser('user-123')).not.toThrow();
    expect(() => clearUser()).not.toThrow();
  });
});
