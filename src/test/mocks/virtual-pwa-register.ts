type RegisterOptions = {
  immediate?: boolean;
  onNeedRefresh?: () => void;
};

type UpdateServiceWorker = (reloadPage?: boolean) => Promise<void>;

type RegisterSWHandler = (options: RegisterOptions) => UpdateServiceWorker;

declare global {
  var __VIRTUAL_REGISTER_SW__: RegisterSWHandler | undefined;
}

export function registerSW(options: RegisterOptions): UpdateServiceWorker {
  if (typeof globalThis.__VIRTUAL_REGISTER_SW__ === 'function') {
    return globalThis.__VIRTUAL_REGISTER_SW__(options);
  }

  return async () => undefined;
}
