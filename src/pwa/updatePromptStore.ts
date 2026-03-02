type Listener = () => void;

type ApplyUpdate = () => Promise<void>;

export type UpdatePromptState = {
  isVisible: boolean;
  applyUpdate: ApplyUpdate | null;
};

let state: UpdatePromptState = {
  isVisible: false,
  applyUpdate: null,
};

const listeners = new Set<Listener>();

function emit(): void {
  for (const listener of listeners) {
    listener();
  }
}

export const updatePromptStore = {
  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  getSnapshot(): UpdatePromptState {
    return state;
  },

  show(applyUpdate: ApplyUpdate): void {
    state = {
      isVisible: true,
      applyUpdate,
    };
    emit();
  },

  hide(): void {
    if (!state.isVisible && state.applyUpdate === null) return;
    state = {
      isVisible: false,
      applyUpdate: null,
    };
    emit();
  },
};
