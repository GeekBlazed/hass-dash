import { describe, expect, it } from 'vitest';

import type { HaCallServiceParams } from '../types/home-assistant';
import { idbKvGet, idbKvSet, idbQueueGetAll, idbQueuePut } from '../utils/indexedDb';

type QueueRecord = {
  id: string;
  createdAtMs: number;
  attempts: number;
  params: HaCallServiceParams;
};

describe.sequential('global test setup clears IndexedDB', () => {
  it('writes sentinel values into IndexedDB', async () => {
    await idbKvSet('test-sentinel', 'hello');
    expect(await idbKvGet('test-sentinel')).toBe('hello');

    const record: QueueRecord = {
      id: 'sentinel',
      createdAtMs: Date.now(),
      attempts: 0,
      params: { domain: 'light', service: 'turn_on' },
    };

    await idbQueuePut(record);
    const queued = await idbQueueGetAll<QueueRecord>();
    expect(queued).toHaveLength(1);
  });

  it('starts clean in the next test (cleared by global beforeEach)', async () => {
    expect(await idbKvGet('test-sentinel')).toBeNull();

    const queued = await idbQueueGetAll<QueueRecord>();
    expect(queued).toHaveLength(0);
  });
});
