import { act, render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TYPES } from '../../core/types';
import { useService } from '../../hooks/useService';
import type { IHomeAssistantServiceCallQueue } from '../../interfaces/IHomeAssistantServiceCallQueue';
import type { IWebSocketService, IWebSocketSubscription } from '../../interfaces/IWebSocketService';
import { useConnectivityStore } from '../../stores/useConnectivityStore';
import { ConnectivityController } from './ConnectivityController';

vi.mock('../../hooks/useService', () => ({
  useService: vi.fn(),
}));

const useServiceMock = vi.mocked(useService);

describe('ConnectivityController', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useConnectivityStore.setState({ isOnline: true, haConnected: true });
  });

  it('syncs initial online state and reacts to browser/network events', async () => {
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });

    const flush = vi.fn().mockResolvedValue(undefined);
    let wsStatusHandler: ((connected: boolean) => void) | null = null;

    const wsService: Pick<IWebSocketService, 'subscribeConnectionStatus'> = {
      subscribeConnectionStatus: vi.fn((handler) => {
        wsStatusHandler = handler;
        const sub: IWebSocketSubscription = { unsubscribe: vi.fn() };
        return sub;
      }),
    };

    const queue: Pick<IHomeAssistantServiceCallQueue, 'flush'> = { flush };

    useServiceMock.mockImplementation((token) => {
      if (token === TYPES.IWebSocketService) return wsService as IWebSocketService;
      return queue as IHomeAssistantServiceCallQueue;
    });

    render(<ConnectivityController />);

    expect(useConnectivityStore.getState().isOnline).toBe(false);

    await act(async () => {
      Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
      window.dispatchEvent(new Event('online'));
      await Promise.resolve();
    });

    expect(useConnectivityStore.getState().isOnline).toBe(true);
    expect(flush).toHaveBeenCalledTimes(1);

    await act(async () => {
      wsStatusHandler?.(true);
      await Promise.resolve();
    });

    expect(useConnectivityStore.getState().haConnected).toBe(true);
    expect(flush).toHaveBeenCalledTimes(2);

    await act(async () => {
      window.dispatchEvent(new Event('offline'));
      wsStatusHandler?.(false);
      await Promise.resolve();
    });

    expect(useConnectivityStore.getState().isOnline).toBe(false);
    expect(useConnectivityStore.getState().haConnected).toBe(false);
  });

  it('defaults to online when navigator.onLine is unavailable and unsubscribes on unmount', () => {
    Object.defineProperty(navigator, 'onLine', { value: undefined, configurable: true });

    const flush = vi.fn().mockResolvedValue(undefined);
    const unsubscribe = vi.fn();

    const wsService: Pick<IWebSocketService, 'subscribeConnectionStatus'> = {
      subscribeConnectionStatus: vi.fn(() => ({ unsubscribe })),
    };

    const queue: Pick<IHomeAssistantServiceCallQueue, 'flush'> = { flush };

    useServiceMock.mockImplementation((token) => {
      if (token === TYPES.IWebSocketService) return wsService as IWebSocketService;
      return queue as IHomeAssistantServiceCallQueue;
    });

    const { unmount } = render(<ConnectivityController />);

    expect(useConnectivityStore.getState().isOnline).toBe(true);
    unmount();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });
});
