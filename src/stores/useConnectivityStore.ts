import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

export type ConnectivityState = {
  isOnline: boolean;
  haConnected: boolean;

  setIsOnline: (isOnline: boolean) => void;
  setHaConnected: (connected: boolean) => void;
};

function getInitialOnline(): boolean {
  if (typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean') {
    return navigator.onLine;
  }
  return true;
}

export const useConnectivityStore = create<ConnectivityState>()(
  devtools(
    (set) => ({
      isOnline: getInitialOnline(),
      haConnected: true,
      setIsOnline: (isOnline) => set({ isOnline }),
      setHaConnected: (haConnected) => set({ haConnected }),
    }),
    { name: 'hass-dash:connectivity' }
  )
);
