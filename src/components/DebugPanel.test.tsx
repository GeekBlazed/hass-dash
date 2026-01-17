import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { container } from '../core/di-container';
import { useEntityStore } from '../stores/useEntityStore';
import type { HaEntityState } from '../types/home-assistant';
import * as DebugPanelModule from './DebugPanel';

vi.mock('../core/di-container', () => ({
  container: {
    get: vi.fn(),
  },
}));

describe('DebugPanel', () => {
  const mockHaClient = {
    connect: vi.fn<() => Promise<void>>().mockResolvedValue(),
    getStates: vi.fn<() => Promise<unknown[]>>().mockResolvedValue([]),
    getServices: vi.fn<() => Promise<unknown[]>>().mockResolvedValue([]),
    getState: vi.fn(),
    subscribeToEvents: vi.fn(),
    callService: vi.fn(),
  };

  const mockEntityService = {
    fetchStates: vi.fn<() => Promise<HaEntityState[]>>().mockResolvedValue([]),
    subscribeToStateChanges: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.removeItem('hass-dash:entities');
    useEntityStore.getState().clear();

    vi.mocked(container.get).mockImplementation((token) => {
      const tokenKey = (() => {
        if (typeof token === 'symbol') {
          return token.description ?? token.toString();
        }
        return String(token);
      })();

      if (tokenKey.includes('IEntityService')) return mockEntityService;
      return mockHaClient;
    });
  });

  it('renders the dev tools header and help text', () => {
    render(<DebugPanelModule.DebugPanel />);
    expect(screen.getByRole('heading', { name: /dev tools/i })).toBeInTheDocument();
    expect(screen.getByText(/enable this panel with/i)).toBeInTheDocument();
  });

  it('runs the Home Assistant connection smoke test', async () => {
    mockHaClient.getStates.mockResolvedValueOnce([{}, {}]);
    mockHaClient.getServices.mockResolvedValueOnce([{}]);

    render(<DebugPanelModule.DebugPanel />);

    await act(async () => {
      fireEvent.click(
        screen.getByRole('button', { name: /run home assistant connection smoke test/i })
      );
    });

    expect(mockHaClient.connect).toHaveBeenCalledTimes(1);
    expect(mockHaClient.getStates).toHaveBeenCalledTimes(1);
    expect(mockHaClient.getServices).toHaveBeenCalledTimes(1);

    expect(
      await screen.findByText(/Connected\. States: 2\. Service domains: 1\./i)
    ).toBeInTheDocument();
  });

  it('loads entities via the Entity Debug section', async () => {
    const states: HaEntityState[] = [
      {
        entity_id: 'light.kitchen',
        state: 'on',
        attributes: {},
        last_changed: '2026-01-01T00:00:00.000Z',
        last_updated: '2026-01-01T00:00:00.000Z',
        context: {
          id: '00000000000000000000000000000000',
          parent_id: null,
          user_id: null,
        },
      },
    ];

    mockEntityService.fetchStates.mockResolvedValueOnce(states);

    render(<DebugPanelModule.DebugPanel />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /load home assistant entities/i }));
    });

    expect(mockEntityService.fetchStates).toHaveBeenCalledTimes(1);
    expect(await screen.findByText(/Loaded 1 entities\./i)).toBeInTheDocument();
  });
});
