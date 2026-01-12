import { describe, expect, it, vi } from 'vitest';

import { PublicLightingYamlDataSource } from './PublicLightingYamlDataSource';

describe('PublicLightingYamlDataSource', () => {
  it('returns an empty model and does not fetch any YAML', async () => {
    const fetchMock = vi.fn(async () => {
      return new Response('lights: []', { status: 200 });
    });
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);

    const ds = new PublicLightingYamlDataSource();
    const model = await ds.getLighting();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(model).toEqual({ lights: [] });
  });
});
