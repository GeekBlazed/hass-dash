import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useDashboardStore } from '../../../stores/useDashboardStore';
import { useEntityStore } from '../../../stores/useEntityStore';
import type { HaEntityState } from '../../../types/home-assistant';
import { CamerasPanel } from './CamerasPanel';

const makeCamera = (entityId: string, state: string, friendlyName?: string): HaEntityState => {
  const attrs: Record<string, unknown> = {};
  if (friendlyName !== undefined) attrs.friendly_name = friendlyName;

  return {
    entity_id: entityId,
    state,
    attributes: attrs,
    last_changed: '2026-01-01T00:00:00Z',
    last_updated: '2026-01-01T00:00:00Z',
    context: { id: 'c', parent_id: null, user_id: null },
  };
};

describe('CamerasPanel', () => {
  beforeEach(() => {
    useEntityStore.getState().clear();
    useDashboardStore.getState().closeCameraModal();
    vi.restoreAllMocks();
  });

  it('shows empty state when there are no cameras', () => {
    render(<CamerasPanel isHidden={false} />);

    expect(screen.queryByText('There are no cameras.')).not.toBeNull();
    const empty = document.getElementById('cameras-empty');
    expect(empty?.classList.contains('is-hidden')).toBe(false);
  });

  it('applies the hidden class when isHidden is true', () => {
    useEntityStore.getState().upsert(makeCamera('camera.kitchen', 'idle', 'Kitchen'));

    render(<CamerasPanel isHidden={true} />);

    const panel = document.getElementById('cameras-panel');
    expect(panel?.classList.contains('is-hidden')).toBe(true);
  });

  it('renders cameras and sorts by display name', () => {
    useEntityStore.getState().upsert(makeCamera('camera.front_porch', 'idle', 'B Porch'));
    useEntityStore.getState().upsert(makeCamera('camera.garage', 'streaming', 'A Garage'));

    render(<CamerasPanel isHidden={false} />);

    const items = document.querySelectorAll('#cameras-list .cameras-item');
    expect(items.length).toBe(2);

    expect(items[0]?.textContent).toContain('A Garage');
    expect(items[1]?.textContent).toContain('B Porch');

    // State is included in the meta line.
    expect(items[0]?.textContent).toContain('streaming');

    const empty = document.getElementById('cameras-empty');
    expect(empty?.classList.contains('is-hidden')).toBe(true);
  });

  it('filters to household-labeled cameras when household ids exist', () => {
    useEntityStore.getState().upsert(makeCamera('camera.kitchen', 'idle', 'Kitchen'));
    useEntityStore.getState().upsert(makeCamera('camera.garage', 'idle', 'Garage'));

    useEntityStore.getState().setHassDashEntityIds(['camera.kitchen']);

    render(<CamerasPanel isHidden={false} />);

    expect(screen.queryByText('Kitchen')).not.toBeNull();
    expect(screen.queryByText('Garage')).toBeNull();
  });

  it("explains when cameras exist but none match the 'hass-dash' label", () => {
    useEntityStore.getState().upsert(makeCamera('camera.kitchen', 'idle', 'Kitchen'));
    useEntityStore.getState().setHassDashEntityIds(['light.kitchen']);

    render(<CamerasPanel isHidden={false} />);

    expect(
      screen.queryByText(
        "No cameras match the 'hass-dash' label. Add the label to a camera entity or its device in Home Assistant."
      )
    ).not.toBeNull();
  });

  it('falls back to attributes.name when friendly_name is empty', () => {
    useEntityStore.getState().upsert(makeCamera('camera.kitchen', 'idle', '   '));

    useEntityStore.getState().upsert({
      ...makeCamera('camera.kitchen', 'idle'),
      attributes: { name: 'Kitchen Camera' },
    });

    render(<CamerasPanel isHidden={false} />);

    expect(screen.queryByText('Kitchen Camera')).not.toBeNull();
  });

  it('stores selected camera id when a camera is selected', () => {
    useEntityStore.getState().upsert(makeCamera('camera.kitchen', 'idle', 'Kitchen'));

    render(<CamerasPanel isHidden={false} />);

    fireEvent.click(screen.getByRole('button', { name: 'Open live view for Kitchen' }));

    expect(useDashboardStore.getState().selectedCameraEntityId).toBe('camera.kitchen');
  });
});
