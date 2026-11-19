import { describe, expect, it, vi } from 'vitest';
import { createReporter } from './errorReporting';

describe('createReporter', () => {
  it('sends only the error, source, path and time', () => {
    const send = vi.fn(() => true);
    const report = createReporter({ endpoint: 'https://errors.example.test', send });
    report(new Error('boom'), 'react');
    expect(send).toHaveBeenCalledTimes(1);
    const body = JSON.parse((send.mock.calls[0] as unknown as [string, string])[1]);
    expect(Object.keys(body).sort()).toEqual(['message', 'path', 'source', 'stack', 'time']);
    expect(body.message).toBe('boom');
  });

  it('drops repeats of the same message', () => {
    const send = vi.fn(() => true);
    const report = createReporter({ endpoint: 'x', send });
    report(new Error('same'), 'window');
    report(new Error('same'), 'window');
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('stops after ten reports per page load', () => {
    const send = vi.fn(() => true);
    const report = createReporter({ endpoint: 'x', send });
    for (let i = 0; i < 25; i++) report(new Error(`e${i}`), 'window');
    expect(send).toHaveBeenCalledTimes(10);
  });

  it('only logs when no endpoint is configured', () => {
    const send = vi.fn(() => true);
    const log = vi.fn();
    const report = createReporter({ send, log });
    report('plain string', 'promise');
    expect(send).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith(expect.objectContaining({ message: 'plain string', source: 'promise' }));
  });
});
