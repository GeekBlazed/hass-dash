import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { useEntityStore } from '../../stores/useEntityStore';
import { LhciLightingModalHarness } from './LhciLightingModalHarness';

const seedLightEntity = (entityId: string) => {
  const nowIso = new Date().toISOString();
  useEntityStore.getState().upsert({
    entity_id: entityId,
    state: 'on',
    attributes: {
      friendly_name: 'LHCI Demo Light',
      supported_color_modes: ['rgb', 'color_temp'],
      supported_features: 0,
      brightness: 200,
      rgb_color: [255, 180, 90],
      color_temp: 275,
      min_mireds: 153,
      max_mireds: 500,
    },
    last_changed: nowIso,
    last_updated: nowIso,
    context: {
      id: 'lhci',
      parent_id: null,
      user_id: null,
    },
  });
};

describe('LhciLightingModalHarness', () => {
  const originalUrl = window.location.href;
  const originalRelativeUrl = (() => {
    try {
      const url = new URL(originalUrl);
      return `${url.pathname}${url.search}${url.hash}` || '/';
    } catch {
      return '/';
    }
  })();
  const originalURLSearchParams = globalThis.URLSearchParams;

  beforeEach(async () => {
    await useEntityStore.persist.clearStorage();
    useEntityStore.setState({ entitiesById: {}, lastUpdatedAt: null, householdEntityIds: {} });
    globalThis.URLSearchParams = originalURLSearchParams;
    try {
      window.history.replaceState({}, '', '/');
    } catch {
      // ignore
    }
  });

  afterEach(() => {
    globalThis.URLSearchParams = originalURLSearchParams;
    try {
      window.history.replaceState({}, '', originalRelativeUrl);
    } catch {
      // ignore
    }
  });

  it('renders nothing when lhci param is missing', () => {
    render(<LhciLightingModalHarness />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('renders nothing when lhci is present but not enabled', () => {
    window.history.replaceState({}, '', '/?lhci=1');
    render(<LhciLightingModalHarness />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('returns null when entityId is empty (exists false path)', () => {
    window.history.replaceState({}, '', '/?lhci=1&lhciOpenLightDetails=1&lhciLightEntityId=');
    render(<LhciLightingModalHarness />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('renders the modal when enabled and the entity exists', () => {
    window.history.replaceState({}, '', '/?lhci=1&lhciOpenLightDetails=1');
    seedLightEntity('light.lhci_demo');

    render(<LhciLightingModalHarness />);

    expect(screen.getByLabelText('Close light details')).toBeInTheDocument();
    expect(screen.getByLabelText('Light details for LHCI Demo Light')).toBeInTheDocument();
  });

  it('fails closed if URLSearchParams throws (parse error path)', () => {
    globalThis.URLSearchParams = class {
      constructor() {
        throw new Error('boom');
      }

      has(): boolean {
        return false;
      }

      get(): string | null {
        return null;
      }
    } as unknown as typeof URLSearchParams;

    render(<LhciLightingModalHarness />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
