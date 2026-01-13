import { act, render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { container } from '../../../core/di-container';
import type { IHomeAssistantClient } from '../../../interfaces/IHomeAssistantClient';
import { useEntityStore } from '../../../stores/useEntityStore';
import type { HaEntityState } from '../../../types/home-assistant';
import { LightingPanel } from './LightingPanel';

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason: unknown) => void;
};

const createDeferred = <T,>(): Deferred<T> => {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;

  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
};

const makeLight = (entityId: string, state: 'on' | 'off', friendlyName?: string): HaEntityState => {
  const attrs: Record<string, unknown> = {};
  if (friendlyName) attrs.friendly_name = friendlyName;

  return {
    entity_id: entityId,
    state,
    attributes: attrs,
    last_changed: '2026-01-01T00:00:00Z',
    last_updated: '2026-01-01T00:00:00Z',
    context: { id: 'c', parent_id: null, user_id: null },
  };
};

describe('LightingPanel', () => {
  beforeEach(() => {
    useEntityStore.getState().clear();
    vi.restoreAllMocks();
  });

  it('shows empty state when no lights are on', () => {
    useEntityStore.getState().upsert(makeLight('light.kitchen_ceiling', 'off', 'Kitchen'));

    render(<LightingPanel isHidden={false} />);

    expect(screen.getByText('There are no lights on.')).toBeInTheDocument();
    const empty = document.getElementById('lighting-empty');
    expect(empty?.classList.contains('is-hidden')).toBe(false);
  });

  it('applies the hidden class when isHidden is true', () => {
    useEntityStore.getState().upsert(makeLight('light.kitchen_ceiling', 'on', 'Kitchen'));

    render(<LightingPanel isHidden={true} />);

    const panel = document.getElementById('lighting-panel');
    expect(panel?.classList.contains('is-hidden')).toBe(true);
  });

  it('renders only on lights and sorts by display name', () => {
    useEntityStore.getState().upsert(makeLight('light.kitchen_ceiling', 'on', 'B Kitchen'));
    useEntityStore.getState().upsert(makeLight('light.dining_main', 'on', 'A Dining'));
    useEntityStore.getState().upsert(makeLight('light.bedroom_lamp', 'off', 'C Bedroom'));

    render(<LightingPanel isHidden={false} />);

    const items = document.querySelectorAll('#lighting-list .lighting-item');
    expect(items.length).toBe(2);

    expect(items[0]?.textContent).toContain('A Dining');
    expect(items[1]?.textContent).toContain('B Kitchen');

    const empty = document.getElementById('lighting-empty');
    expect(empty?.classList.contains('is-hidden')).toBe(true);
  });

  it('falls back to attributes.name when friendly_name is empty', () => {
    useEntityStore.getState().upsert(
      makeLight('light.kitchen_ceiling', 'on', '   ') // friendly_name blank
    );

    // Provide a name attribute instead.
    useEntityStore.getState().upsert({
      ...makeLight('light.kitchen_ceiling', 'on'),
      attributes: { name: 'Kitchen Ceiling' },
    });

    render(<LightingPanel isHidden={false} />);

    expect(screen.getByText('Kitchen Ceiling')).toBeInTheDocument();
  });

  it('filters to household-labeled lights when household ids exist', () => {
    useEntityStore.getState().upsert(makeLight('light.kitchen_ceiling', 'on', 'Kitchen'));
    useEntityStore.getState().upsert(makeLight('light.garage_workbench', 'on', 'Garage'));

    useEntityStore.getState().setHouseholdEntityIds(['light.kitchen_ceiling']);

    render(<LightingPanel isHidden={false} />);

    expect(screen.getByText('Kitchen')).toBeInTheDocument();
    expect(screen.queryByText('Garage')).toBeNull();
  });

  it('optimistically turns off a light immediately on click', async () => {
    useEntityStore.getState().upsert(makeLight('light.kitchen_ceiling', 'on', 'Kitchen'));

    const connect = vi.fn().mockResolvedValue(undefined);
    const callServiceDeferred = createDeferred<void>();
    const callService = vi.fn().mockReturnValue(callServiceDeferred.promise);

    const mockClient: Partial<IHomeAssistantClient> = { connect, callService };
    const getSpy = vi
      .spyOn(container, 'get')
      .mockReturnValue(mockClient as unknown as IHomeAssistantClient);

    const user = userEvent.setup();

    render(<LightingPanel isHidden={false} />);

    await user.click(screen.getByRole('button', { name: /turn off kitchen/i }));

    // Store updates immediately (before callService resolves)
    expect(useEntityStore.getState().entitiesById['light.kitchen_ceiling']?.state).toBe('off');

    // Now resolve the pending HA call so we don't leak async work.
    callServiceDeferred.resolve(undefined);
    await callServiceDeferred.promise;

    expect(connect).toHaveBeenCalledTimes(1);
    expect(callService).toHaveBeenCalledWith({
      domain: 'light',
      service: 'turn_off',
      service_data: { entity_id: 'light.kitchen_ceiling' },
      target: { entity_id: 'light.kitchen_ceiling' },
    });

    getSpy.mockRestore();
  });

  it('turns off a light on Enter keydown', async () => {
    useEntityStore.getState().upsert(makeLight('light.kitchen_ceiling', 'on', 'Kitchen'));

    const connect = vi.fn().mockResolvedValue(undefined);
    const callServiceDeferred = createDeferred<void>();
    const callService = vi.fn().mockReturnValue(callServiceDeferred.promise);

    const mockClient: Partial<IHomeAssistantClient> = { connect, callService };
    const getSpy = vi
      .spyOn(container, 'get')
      .mockReturnValue(mockClient as unknown as IHomeAssistantClient);

    render(<LightingPanel isHidden={false} />);

    const item = screen.getByRole('button', { name: /turn off kitchen/i });

    await act(async () => {
      item.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    });

    expect(useEntityStore.getState().entitiesById['light.kitchen_ceiling']?.state).toBe('off');

    callServiceDeferred.resolve(undefined);
    await callServiceDeferred.promise;

    expect(callService).toHaveBeenCalledTimes(1);

    getSpy.mockRestore();
  });

  it('turns off a light on Space keydown', async () => {
    useEntityStore.getState().upsert(makeLight('light.kitchen_ceiling', 'on', 'Kitchen'));

    const connect = vi.fn().mockResolvedValue(undefined);
    const callServiceDeferred = createDeferred<void>();
    const callService = vi.fn().mockReturnValue(callServiceDeferred.promise);

    const mockClient: Partial<IHomeAssistantClient> = { connect, callService };
    const getSpy = vi
      .spyOn(container, 'get')
      .mockReturnValue(mockClient as unknown as IHomeAssistantClient);

    render(<LightingPanel isHidden={false} />);

    const item = screen.getByRole('button', { name: /turn off kitchen/i });

    await act(async () => {
      item.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
    });

    expect(useEntityStore.getState().entitiesById['light.kitchen_ceiling']?.state).toBe('off');

    callServiceDeferred.resolve(undefined);
    await callServiceDeferred.promise;

    expect(callService).toHaveBeenCalledTimes(1);

    getSpy.mockRestore();
  });

  it('ignores unrelated keys on keydown', async () => {
    useEntityStore.getState().upsert(makeLight('light.kitchen_ceiling', 'on', 'Kitchen'));

    const connect = vi.fn().mockResolvedValue(undefined);
    const callService = vi.fn().mockResolvedValue(undefined);
    const mockClient: Partial<IHomeAssistantClient> = { connect, callService };
    const getSpy = vi
      .spyOn(container, 'get')
      .mockReturnValue(mockClient as unknown as IHomeAssistantClient);

    render(<LightingPanel isHidden={false} />);

    const item = screen.getByRole('button', { name: /turn off kitchen/i });

    await act(async () => {
      item.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      await Promise.resolve();
    });

    expect(useEntityStore.getState().entitiesById['light.kitchen_ceiling']?.state).toBe('on');
    expect(callService).toHaveBeenCalledTimes(0);

    getSpy.mockRestore();
  });

  it('does not roll back when the previous state is not a string', async () => {
    // Force a non-string runtime value in `entity.state` to cover the
    // `typeof previousState === 'string'` guard branches.
    const entity = makeLight('light.kitchen_ceiling', 'on', 'Kitchen');
    (entity as unknown as { state: unknown }).state = { toString: () => 'on' };
    useEntityStore.getState().upsert(entity);

    const connect = vi.fn().mockResolvedValue(undefined);
    const callServiceDeferred = createDeferred<void>();
    const callService = vi.fn().mockReturnValue(callServiceDeferred.promise);

    const mockClient: Partial<IHomeAssistantClient> = { connect, callService };
    const getSpy = vi
      .spyOn(container, 'get')
      .mockReturnValue(mockClient as unknown as IHomeAssistantClient);

    const user = userEvent.setup();

    render(<LightingPanel isHidden={false} />);

    await user.click(screen.getByRole('button', { name: /turn off kitchen/i }));

    // Optimistic: off immediately
    expect(useEntityStore.getState().entitiesById['light.kitchen_ceiling']?.state).toBe('off');

    // Reject the HA call. Because previousState was not a string, rollback should not occur.
    await act(async () => {
      callServiceDeferred.reject(new Error('boom'));
      await callServiceDeferred.promise.catch(() => undefined);
      await Promise.resolve();
    });

    expect(useEntityStore.getState().entitiesById['light.kitchen_ceiling']?.state).toBe('off');

    getSpy.mockRestore();
  });

  it('rolls back optimistic update if turn off fails', async () => {
    useEntityStore.getState().upsert(makeLight('light.kitchen_ceiling', 'on', 'Kitchen'));

    const connect = vi.fn().mockResolvedValue(undefined);
    const callServiceDeferred = createDeferred<void>();
    const callService = vi.fn().mockReturnValue(callServiceDeferred.promise);

    const mockClient: Partial<IHomeAssistantClient> = { connect, callService };
    const getSpy = vi
      .spyOn(container, 'get')
      .mockReturnValue(mockClient as unknown as IHomeAssistantClient);

    const user = userEvent.setup();

    render(<LightingPanel isHidden={false} />);

    await user.click(screen.getByRole('button', { name: /turn off kitchen/i }));

    // Optimistic: off immediately
    expect(useEntityStore.getState().entitiesById['light.kitchen_ceiling']?.state).toBe('off');

    // Now reject the pending HA call and wait for rollback.
    await act(async () => {
      callServiceDeferred.reject(new Error('boom'));
      await callServiceDeferred.promise.catch(() => undefined);
      await Promise.resolve();
    });

    expect(useEntityStore.getState().entitiesById['light.kitchen_ceiling']?.state).toBe('on');

    getSpy.mockRestore();
  });
});
