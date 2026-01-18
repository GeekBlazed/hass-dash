import { idbKvDelete, idbKvGet, idbKvSet } from './indexedDb';

export type AsyncStateStorage = {
  getItem: (name: string) => Promise<string | null>;
  setItem: (name: string, value: string) => Promise<void>;
  removeItem: (name: string) => Promise<void>;
};

export function createIndexedDbStateStorage(): AsyncStateStorage {
  return {
    getItem: async (name) => {
      return await idbKvGet(name);
    },
    setItem: async (name, value) => {
      await idbKvSet(name, value);
    },
    removeItem: async (name) => {
      await idbKvDelete(name);
    },
  };
}
