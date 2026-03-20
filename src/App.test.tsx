import { act, render, screen, within } from '@testing-library/react';
import type { ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import { useEntityStore } from './stores/useEntityStore';

async function renderAndSettle(ui: ReactElement): Promise<void> {
  render(ui);
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe('App', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/');
    window.sessionStorage.removeItem('hass-dash:devtools');
    useEntityStore.getState().clear();
  });

  afterEach(() => {
    window.history.replaceState({}, '', '/');
    window.sessionStorage.removeItem('hass-dash:devtools');
    useEntityStore.getState().clear();
    vi.unstubAllEnvs();
  });

  it('renders the dashboard', async () => {
    await renderAndSettle(<App />);

    // Dashboard renders the application shell
    expect(screen.getByRole('application', { name: /floorplan dashboard/i })).toBeInTheDocument();
  });

  it('renders app version at bottom center', async () => {
    const versionUnderTest = 'test-build-version';
    vi.stubEnv('VITE_APP_VERSION', versionUnderTest);

    await renderAndSettle(<App />);

    const versionLabel = screen.getByLabelText(/app version/i);
    expect(versionLabel).toBeInTheDocument();
    expect(versionLabel).toHaveTextContent(versionUnderTest);
  });

  it('renders quick action buttons', async () => {
    await renderAndSettle(<App />);

    // Quick action buttons should be present
    expect(screen.getByRole('button', { name: /^lighting$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^climate$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^media$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^agenda$/i })).toBeInTheDocument();
  });

  it('renders weather display', async () => {
    await renderAndSettle(<App />);

    const weatherSummary = screen.getByLabelText(/weather summary/i);
    expect(weatherSummary).toBeInTheDocument();
    expect(within(weatherSummary).getByTestId('humidity-icon')).toBeInTheDocument();
    expect(within(weatherSummary).getByText(/--%/)).toBeInTheDocument();
  });

  it('has proper semantic structure', async () => {
    await renderAndSettle(<App />);

    // Should have main and aside landmarks
    expect(screen.getByRole('main')).toBeInTheDocument();
    expect(screen.getByRole('complementary')).toBeInTheDocument();
  });

  it('has accessible buttons with proper roles', async () => {
    await renderAndSettle(<App />);

    // All buttons should be accessible
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThanOrEqual(4); // quick actions at minimum

    // Each button should be focusable
    buttons.forEach((button) => {
      expect(button).not.toHaveAttribute('tabindex', '-1');
    });
  });

  it('does not render the debug panel by default', async () => {
    await renderAndSettle(<App />);
    expect(screen.queryByRole('heading', { name: /dev tools/i })).not.toBeInTheDocument();
  });

  it('renders the debug panel when ?debug is present', async () => {
    window.history.replaceState({}, '', '/?debug');
    await renderAndSettle(<App />);
    expect(screen.getByRole('heading', { name: /dev tools/i })).toBeInTheDocument();
  });

  it('seeds LHCI demo light when requested and no light entities exist', async () => {
    window.history.replaceState({}, '', '/?lhci=1&lhciSeedLights=1');

    await renderAndSettle(<App />);

    const entity = useEntityStore.getState().entitiesById['light.lhci_demo'];
    expect(entity).toBeDefined();
    expect(entity?.state).toBe('on');
    expect(useEntityStore.getState().householdEntityIds['light.lhci_demo']).toBe(true);
  });

  it('does not seed LHCI demo light when another light already exists', async () => {
    useEntityStore.getState().upsert({
      entity_id: 'light.existing',
      state: 'off',
      attributes: { friendly_name: 'Existing Light' },
      last_changed: '2026-01-01T00:00:00.000Z',
      last_updated: '2026-01-01T00:00:00.000Z',
      context: { id: 'ctx', parent_id: null, user_id: null },
    });

    window.history.replaceState({}, '', '/?lhci=1&lhciSeedLights=1');

    await renderAndSettle(<App />);

    expect(useEntityStore.getState().entitiesById['light.lhci_demo']).toBeUndefined();
    expect(useEntityStore.getState().householdEntityIds['light.lhci_demo']).toBe(true);
  });
});
