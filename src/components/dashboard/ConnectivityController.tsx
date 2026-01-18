import { useEffect } from 'react';

import { TYPES } from '../../core/types';
import { useService } from '../../hooks/useService';
import type { IHomeAssistantServiceCallQueue } from '../../interfaces/IHomeAssistantServiceCallQueue';
import type { IWebSocketService } from '../../interfaces/IWebSocketService';
import { useConnectivityStore } from '../../stores/useConnectivityStore';

function canUseNavigatorOnline(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean';
}

function getOnline(): boolean {
  if (!canUseNavigatorOnline()) return true;
  return navigator.onLine;
}

export function ConnectivityController() {
  const webSocketService = useService<IWebSocketService>(TYPES.IWebSocketService);
  const serviceQueue = useService<IHomeAssistantServiceCallQueue>(
    TYPES.IHomeAssistantServiceCallQueue
  );

  const setIsOnline = useConnectivityStore((s) => s.setIsOnline);
  const setHaConnected = useConnectivityStore((s) => s.setHaConnected);

  useEffect(() => {
    setIsOnline(getOnline());

    const onOnline = () => {
      setIsOnline(true);
      void serviceQueue.flush();
    };

    const onOffline = () => {
      setIsOnline(false);
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('online', onOnline);
      window.addEventListener('offline', onOffline);
    }

    const wsSub = webSocketService.subscribeConnectionStatus((connected) => {
      setHaConnected(connected);
      if (connected) {
        void serviceQueue.flush();
      }
    });

    return () => {
      wsSub.unsubscribe();
      if (typeof window !== 'undefined') {
        window.removeEventListener('online', onOnline);
        window.removeEventListener('offline', onOffline);
      }
    };
  }, [serviceQueue, setHaConnected, setIsOnline, webSocketService]);

  return null;
}
