import { render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { TYPES } from '../../core/types';
import { useFeatureFlag } from '../../hooks/useFeatureFlag';
import { useService } from '../../hooks/useService';
import { HomeAssistantEntityStoreController } from './HomeAssistantEntityStoreController';

vi.mock('../../hooks/useFeatureFlag', () => {
  return {
    useFeatureFlag: vi.fn(),
  };
});

vi.mock('../../hooks/useService', () => {
  return {
    useService: vi.fn(),
  };
});

const { warnMock } = vi.hoisted(() => {
  return {
    warnMock: vi.fn(),
  };
});
vi.mock('../../utils/logger', () => {
  return {
    createLogger: () => ({ warn: warnMock }),
  };
});

const { upsertMock } = vi.hoisted(() => {
  return {
    upsertMock: vi.fn(),
  };
});

const { setAllMock } = vi.hoisted(() => {
  return {
    setAllMock: vi.fn(),
  };
});

const { setHouseholdEntityIdsMock } = vi.hoisted(() => {
  return {
    setHouseholdEntityIdsMock: vi.fn(),
  };
});

const { setHouseholdAreaIndexMock } = vi.hoisted(() => {
  return {
    setHouseholdAreaIndexMock: vi.fn(),
  };
});
vi.mock('../../stores/useEntityStore', () => {
  return {
    useEntityStore: (selector: (s: unknown) => unknown) =>
      selector({
        setAll: setAllMock,
        upsert: upsertMock,
        setHouseholdEntityIds: setHouseholdEntityIdsMock,
      }),
  };
});

vi.mock('../../stores/useHouseholdAreaEntityIndexStore', () => {
  return {
    useHouseholdAreaEntityIndexStore: (selector: (s: unknown) => unknown) =>
      selector({
        setIndex: setHouseholdAreaIndexMock,
      }),
  };
});

const useFeatureFlagMock = vi.mocked(useFeatureFlag);
const useServiceMock = vi.mocked(useService);

describe('HomeAssistantEntityStoreController', () => {
  beforeEach(() => {
    warnMock.mockReset();
    setAllMock.mockReset();
    upsertMock.mockReset();
    setHouseholdEntityIdsMock.mockReset();
    setHouseholdAreaIndexMock.mockReset();
    useFeatureFlagMock.mockReset();
    useServiceMock.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does nothing when HA_CONNECTION flag is disabled', () => {
    useFeatureFlagMock.mockReturnValue({ isEnabled: false } as never);

    const fetchStates = vi.fn();
    const subscribeToStateChanges = vi.fn();
    useServiceMock.mockReturnValue({ fetchStates, subscribeToStateChanges } as never);

    render(<HomeAssistantEntityStoreController />);

    expect(fetchStates).not.toHaveBeenCalled();
    expect(subscribeToStateChanges).not.toHaveBeenCalled();
    expect(upsertMock).not.toHaveBeenCalled();
    expect(setHouseholdEntityIdsMock).not.toHaveBeenCalled();
    expect(setHouseholdAreaIndexMock).not.toHaveBeenCalled();
  });

  it('upserts only whitelisted entityIds from initial fetch', async () => {
    useFeatureFlagMock.mockReturnValue({ isEnabled: true } as never);

    const fetchStates = vi.fn().mockResolvedValue([
      { entity_id: 'sensor.keep_me', state: '1', attributes: {} },
      { entity_id: 'sensor.ignore_me', state: '2', attributes: {} },
    ]);

    const subscribeToStateChanges = vi.fn().mockResolvedValue({
      unsubscribe: vi.fn().mockResolvedValue(undefined),
    });

    useServiceMock.mockImplementation((identifier: symbol) => {
      if (identifier === TYPES.IEntityService) {
        return { fetchStates, subscribeToStateChanges } as never;
      }
      if (identifier === TYPES.IHouseholdEntityLabelService) {
        return { getHouseholdEntityIds: vi.fn().mockResolvedValue(new Set()) } as never;
      }
      if (identifier === TYPES.IHouseholdAreaEntityIndexService) {
        return {
          refresh: vi.fn().mockResolvedValue(undefined),
          getAllAreas: vi.fn().mockResolvedValue([]),
          getHouseholdDeviceIdsByAreaId: vi.fn().mockResolvedValue(new Set()),
          getHouseholdEntityIdsByAreaId: vi.fn().mockResolvedValue(new Set()),
        } as never;
      }
      throw new Error('Unexpected service identifier');
    });

    render(<HomeAssistantEntityStoreController entityIds={['sensor.keep_me']} />);

    await waitFor(() => {
      expect(fetchStates).toHaveBeenCalledTimes(1);
      expect(subscribeToStateChanges).toHaveBeenCalledTimes(1);
    });

    expect(upsertMock).toHaveBeenCalledTimes(1);
    expect(setAllMock).not.toHaveBeenCalled();
    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({ entity_id: 'sensor.keep_me' })
    );
  });

  it('captures all entities by default (required for room overlays)', async () => {
    useFeatureFlagMock.mockReturnValue({ isEnabled: true } as never);

    const fetchStates = vi.fn().mockResolvedValue([
      { entity_id: 'sensor.room1_temperature', state: '70', attributes: {} },
      { entity_id: 'sensor.room2_temperature', state: '71', attributes: {} },
    ]);

    let stateHandler:
      | ((next: { entity_id: string; state: string; attributes: Record<string, unknown> }) => void)
      | undefined;

    const unsubscribe = vi.fn().mockResolvedValue(undefined);
    const subscribeToStateChanges = vi
      .fn()
      .mockImplementation(async (handler: NonNullable<typeof stateHandler>) => {
        stateHandler = handler;
        return { unsubscribe };
      });

    useServiceMock.mockImplementation((identifier: symbol) => {
      if (identifier === TYPES.IEntityService) {
        return { fetchStates, subscribeToStateChanges } as never;
      }
      if (identifier === TYPES.IHouseholdEntityLabelService) {
        return {
          getHouseholdEntityIds: vi.fn().mockResolvedValue(new Set(['sensor.room1_temperature'])),
        } as never;
      }
      if (identifier === TYPES.IHouseholdAreaEntityIndexService) {
        return {
          refresh: vi.fn().mockResolvedValue(undefined),
          getAllAreas: vi.fn().mockResolvedValue([]),
          getHouseholdDeviceIdsByAreaId: vi.fn().mockResolvedValue(new Set()),
          getHouseholdEntityIdsByAreaId: vi.fn().mockResolvedValue(new Set()),
        } as never;
      }
      throw new Error('Unexpected service identifier');
    });

    const { unmount } = render(<HomeAssistantEntityStoreController />);

    await waitFor(() => {
      expect(setAllMock).toHaveBeenCalledTimes(1);
      expect(subscribeToStateChanges).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      expect(setHouseholdEntityIdsMock).toHaveBeenCalledTimes(1);
    });

    expect(setAllMock).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ entity_id: 'sensor.room1_temperature' }),
        expect.objectContaining({ entity_id: 'sensor.room2_temperature' }),
      ])
    );

    stateHandler?.({ entity_id: 'sensor.room2_temperature', state: '72', attributes: {} });
    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({ entity_id: 'sensor.room2_temperature' })
    );

    unmount();
    await waitFor(() => {
      expect(unsubscribe).toHaveBeenCalledTimes(1);
    });
  });

  it('logs a warning when initial fetch fails with Error', async () => {
    useFeatureFlagMock.mockReturnValue({ isEnabled: true } as never);

    const fetchStates = vi.fn().mockRejectedValue(new Error('boom'));
    const subscribeToStateChanges = vi.fn().mockResolvedValue({
      unsubscribe: vi.fn().mockResolvedValue(undefined),
    });

    useServiceMock.mockImplementation((identifier: symbol) => {
      if (identifier === TYPES.IEntityService) {
        return { fetchStates, subscribeToStateChanges } as never;
      }
      if (identifier === TYPES.IHouseholdEntityLabelService) {
        return { getHouseholdEntityIds: vi.fn().mockResolvedValue(new Set()) } as never;
      }
      if (identifier === TYPES.IHouseholdAreaEntityIndexService) {
        return {
          refresh: vi.fn().mockResolvedValue(undefined),
          getAllAreas: vi.fn().mockResolvedValue([]),
          getHouseholdDeviceIdsByAreaId: vi.fn().mockResolvedValue(new Set()),
          getHouseholdEntityIdsByAreaId: vi.fn().mockResolvedValue(new Set()),
        } as never;
      }
      throw new Error('Unexpected service identifier');
    });

    render(<HomeAssistantEntityStoreController entityIds={['sensor.keep_me']} />);

    await waitFor(() => {
      expect(warnMock).toHaveBeenCalledWith('Failed to fetch initial entity states: boom');
      expect(subscribeToStateChanges).toHaveBeenCalledTimes(1);
    });
  });

  it('logs a warning when subscribe fails with a non-Error reason', async () => {
    useFeatureFlagMock.mockReturnValue({ isEnabled: true } as never);

    const fetchStates = vi.fn().mockResolvedValue([]);
    const subscribeToStateChanges = vi.fn().mockRejectedValue('nope');

    useServiceMock.mockImplementation((identifier: symbol) => {
      if (identifier === TYPES.IEntityService) {
        return { fetchStates, subscribeToStateChanges } as never;
      }
      if (identifier === TYPES.IHouseholdEntityLabelService) {
        return { getHouseholdEntityIds: vi.fn().mockResolvedValue(new Set()) } as never;
      }
      if (identifier === TYPES.IHouseholdAreaEntityIndexService) {
        return {
          refresh: vi.fn().mockResolvedValue(undefined),
          getAllAreas: vi.fn().mockResolvedValue([]),
          getHouseholdDeviceIdsByAreaId: vi.fn().mockResolvedValue(new Set()),
          getHouseholdEntityIdsByAreaId: vi.fn().mockResolvedValue(new Set()),
        } as never;
      }
      throw new Error('Unexpected service identifier');
    });

    render(<HomeAssistantEntityStoreController entityIds={['sensor.keep_me']} />);

    await waitFor(() => {
      expect(warnMock).toHaveBeenCalledWith('Failed to subscribe to entity updates: nope');
    });
  });

  it('filters state_changed updates and unsubscribes on unmount', async () => {
    useFeatureFlagMock.mockReturnValue({ isEnabled: true } as never);

    const fetchStates = vi.fn().mockResolvedValue([]);

    type StateChangedHandler = (next: {
      entity_id: string;
      state: string;
      attributes: Record<string, unknown>;
    }) => void;

    let handler: StateChangedHandler | undefined;

    const unsubscribe = vi.fn().mockResolvedValue(undefined);
    const subscribeToStateChanges = vi
      .fn()
      .mockImplementation(async (nextHandler: StateChangedHandler) => {
        handler = nextHandler;
        return { unsubscribe };
      });

    useServiceMock.mockImplementation((identifier: symbol) => {
      if (identifier === TYPES.IEntityService) {
        return { fetchStates, subscribeToStateChanges } as never;
      }
      if (identifier === TYPES.IHouseholdEntityLabelService) {
        return { getHouseholdEntityIds: vi.fn().mockResolvedValue(new Set()) } as never;
      }
      if (identifier === TYPES.IHouseholdAreaEntityIndexService) {
        return {
          refresh: vi.fn().mockResolvedValue(undefined),
          getAllAreas: vi.fn().mockResolvedValue([]),
          getHouseholdDeviceIdsByAreaId: vi.fn().mockResolvedValue(new Set()),
          getHouseholdEntityIdsByAreaId: vi.fn().mockResolvedValue(new Set()),
        } as never;
      }
      throw new Error('Unexpected service identifier');
    });

    const { unmount } = render(
      <HomeAssistantEntityStoreController entityIds={['sensor.keep_me']} />
    );

    await waitFor(() => {
      expect(subscribeToStateChanges).toHaveBeenCalledTimes(1);
    });

    handler?.({ entity_id: 'sensor.ignore_me', state: '1', attributes: {} });
    handler?.({ entity_id: 'sensor.keep_me', state: '2', attributes: {} });

    expect(upsertMock).toHaveBeenCalledTimes(1);
    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({ entity_id: 'sensor.keep_me' })
    );

    unmount();

    await waitFor(() => {
      expect(unsubscribe).toHaveBeenCalledTimes(1);
    });
  });
});
