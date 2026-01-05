import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { container } from '../core/di-container';
import { useFeatureFlags } from '../hooks/useFeatureFlag';
import { DebugPanel } from './DebugPanel';

// Mock the useFeatureFlags hook
vi.mock('../hooks/useFeatureFlag', () => ({
  useFeatureFlags: vi.fn(),
}));

vi.mock('../core/di-container', () => ({
  container: {
    get: vi.fn(),
  },
}));

// Mock window.location.reload
const mockReload = vi.fn();
Object.defineProperty(window, 'location', {
  value: { reload: mockReload },
  writable: true,
});

describe('DebugPanel', () => {
  const mockService = {
    isEnabled: vi.fn(),
    getAll: vi.fn(),
    enable: vi.fn(),
    disable: vi.fn(),
  };

  const mockHaClient = {
    connect: vi.fn(),
    disconnect: vi.fn(),
    isConnected: vi.fn(),
    getStates: vi.fn(),
    getState: vi.fn(),
    getServices: vi.fn(),
    subscribeToEvents: vi.fn(),
    callService: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockReload.mockClear();
    // Set to development mode by default
    vi.stubEnv('DEV', true);

    vi.mocked(container.get).mockReturnValue(mockHaClient);
  });

  it('should render feature flags', () => {
    const mockFlags = {
      FLOOR_PLAN: false,
      HA_CONNECTION: true,
      DEBUG_PANEL: true,
    };

    vi.mocked(useFeatureFlags).mockReturnValue({
      flags: mockFlags,
      service: mockService,
    });

    render(<DebugPanel />);

    // Check that all flags are displayed
    expect(screen.getByText('FLOOR_PLAN')).toBeInTheDocument();
    expect(screen.getByText('HA_CONNECTION')).toBeInTheDocument();
    expect(screen.getByText('DEBUG_PANEL')).toBeInTheDocument();

    // Check indicators are present (we can't easily test role="listitem" since divs don't have that)
    const container = screen.getByText('FLOOR_PLAN').closest('div');
    expect(container).toHaveTextContent('❌');

    const haContainer = screen.getByText('HA_CONNECTION').closest('div');
    expect(haContainer).toHaveTextContent('✅');
  });

  it('should show message when no flags are defined', () => {
    vi.mocked(useFeatureFlags).mockReturnValue({
      flags: {},
      service: mockService,
    });

    render(<DebugPanel />);

    expect(screen.getByText(/no feature flags defined/i)).toBeInTheDocument();
  });

  it('should show toggle button for flags in dev mode', () => {
    vi.stubEnv('DEV', true);
    const mockFlags = { FLOOR_PLAN: false };

    vi.mocked(useFeatureFlags).mockReturnValue({
      flags: mockFlags,
      service: mockService,
    });

    render(<DebugPanel />);

    // Button shows "Toggle" text and has aria-label with flag name
    const toggleButton = screen.getByRole('button', { name: /toggle floor_plan/i });
    expect(toggleButton).toBeInTheDocument();
    expect(toggleButton).toHaveTextContent('Toggle');
  });

  it('should call enable and reload when toggle button clicked for disabled flag', () => {
    vi.stubEnv('DEV', true);
    const mockFlags = { FLOOR_PLAN: false };

    vi.mocked(useFeatureFlags).mockReturnValue({
      flags: mockFlags,
      service: mockService,
    });

    render(<DebugPanel />);

    const toggleButton = screen.getByRole('button', { name: /toggle floor_plan/i });
    fireEvent.click(toggleButton);

    // Should call enable since flag is currently false
    expect(mockService.enable).toHaveBeenCalledWith('FLOOR_PLAN');
    expect(mockService.disable).not.toHaveBeenCalled();
    expect(mockReload).toHaveBeenCalled();
  });

  it('should call disable and reload when toggle button clicked for enabled flag', () => {
    vi.stubEnv('DEV', true);
    const mockFlags = { FLOOR_PLAN: true };

    vi.mocked(useFeatureFlags).mockReturnValue({
      flags: mockFlags,
      service: mockService,
    });

    render(<DebugPanel />);

    const toggleButton = screen.getByRole('button', { name: /toggle floor_plan/i });
    fireEvent.click(toggleButton);

    // Should call disable since flag is currently true
    expect(mockService.disable).toHaveBeenCalledWith('FLOOR_PLAN');
    expect(mockService.enable).not.toHaveBeenCalled();
    expect(mockReload).toHaveBeenCalled();
  });

  it('should not show toggle buttons in production mode', () => {
    vi.stubEnv('DEV', false);
    const mockFlags = { FLOOR_PLAN: false, HA_CONNECTION: true };

    vi.mocked(useFeatureFlags).mockReturnValue({
      flags: mockFlags,
      service: mockService,
    });

    render(<DebugPanel />);

    // No toggle buttons should be present in production
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('should show dev mode indicator in development', () => {
    vi.stubEnv('DEV', true);
    const mockFlags = { FLOOR_PLAN: false };

    vi.mocked(useFeatureFlags).mockReturnValue({
      flags: mockFlags,
      service: mockService,
    });

    render(<DebugPanel />);

    expect(screen.getByText(/dev mode/i)).toBeInTheDocument();
  });

  it('should not show dev mode indicator in production', () => {
    vi.stubEnv('DEV', false);
    const mockFlags = { FLOOR_PLAN: false };

    vi.mocked(useFeatureFlags).mockReturnValue({
      flags: mockFlags,
      service: mockService,
    });

    render(<DebugPanel />);

    expect(screen.queryByText(/dev mode/i)).not.toBeInTheDocument();
  });

  it('should have correct heading and flag count', () => {
    const mockFlags = { FLOOR_PLAN: false, HA_CONNECTION: true, DEBUG_PANEL: false };

    vi.mocked(useFeatureFlags).mockReturnValue({
      flags: mockFlags,
      service: mockService,
    });

    render(<DebugPanel />);

    // Check heading exists
    expect(screen.getByText('Feature Flags')).toBeInTheDocument();

    // Check all three flags are displayed
    expect(screen.getByText('FLOOR_PLAN')).toBeInTheDocument();
    expect(screen.getByText('HA_CONNECTION')).toBeInTheDocument();
    expect(screen.getByText('DEBUG_PANEL')).toBeInTheDocument();
  });

  it('should show HA smoke test section only when HA_CONNECTION flag enabled in dev mode', () => {
    vi.stubEnv('DEV', true);
    vi.mocked(useFeatureFlags).mockReturnValue({
      flags: { HA_CONNECTION: true },
      service: mockService,
    });

    render(<DebugPanel />);

    expect(screen.getByText('Home Assistant Connection')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /home assistant connection smoke test/i })
    ).toBeInTheDocument();
    expect(screen.getAllByText(/not run yet/i)).toHaveLength(2);
  });

  it('should not show HA smoke test section in production mode', () => {
    vi.stubEnv('DEV', false);
    vi.mocked(useFeatureFlags).mockReturnValue({
      flags: { HA_CONNECTION: true },
      service: mockService,
    });

    render(<DebugPanel />);

    expect(screen.queryByText('Home Assistant Connection')).not.toBeInTheDocument();
  });

  it('should run HA smoke test and display counts on success', async () => {
    vi.stubEnv('DEV', true);
    vi.mocked(useFeatureFlags).mockReturnValue({
      flags: { HA_CONNECTION: true },
      service: mockService,
    });

    mockHaClient.connect.mockResolvedValue(undefined);
    mockHaClient.getStates.mockResolvedValue([{ entity_id: 'light.kitchen' }]);
    mockHaClient.getServices.mockResolvedValue([{ domain: 'light', services: {} }]);

    render(<DebugPanel />);

    fireEvent.click(screen.getByRole('button', { name: /home assistant connection smoke test/i }));

    expect(
      await screen.findByText(/connected\. states: 1\. service domains: 1\./i)
    ).toBeInTheDocument();
    expect(mockHaClient.connect).toHaveBeenCalledTimes(1);
    expect(mockHaClient.getStates).toHaveBeenCalledTimes(1);
    expect(mockHaClient.getServices).toHaveBeenCalledTimes(1);
  });

  it('should show error message when HA smoke test fails', async () => {
    vi.stubEnv('DEV', true);
    vi.mocked(useFeatureFlags).mockReturnValue({
      flags: { HA_CONNECTION: true },
      service: mockService,
    });

    mockHaClient.connect.mockRejectedValue(new Error('bad token'));

    render(<DebugPanel />);

    fireEvent.click(screen.getByRole('button', { name: /home assistant connection smoke test/i }));

    expect(await screen.findByText(/error: bad token/i)).toBeInTheDocument();
  });

  it('should toggle a specific light entity and show resulting state', async () => {
    vi.stubEnv('DEV', true);
    vi.mocked(useFeatureFlags).mockReturnValue({
      flags: { HA_CONNECTION: true },
      service: mockService,
    });

    mockHaClient.connect.mockResolvedValue(undefined);
    mockHaClient.callService.mockResolvedValue(undefined);
    mockHaClient.getState.mockResolvedValueOnce({
      entity_id: 'light.norad_corner_torch',
      state: 'off',
      attributes: {},
      last_changed: new Date().toISOString(),
      last_updated: new Date().toISOString(),
      context: { id: '1', parent_id: null, user_id: null },
    });

    const mockUnsubscribe = vi.fn().mockResolvedValue(undefined);
    mockHaClient.subscribeToEvents.mockImplementation(async (_eventType, handler) => {
      setTimeout(() => {
        handler({
          event_type: 'state_changed',
          data: {
            entity_id: 'light.norad_corner_torch',
            old_state: {
              entity_id: 'light.norad_corner_torch',
              state: 'off',
              attributes: {},
              last_changed: new Date().toISOString(),
              last_updated: new Date().toISOString(),
              context: { id: '1', parent_id: null, user_id: null },
            },
            new_state: {
              entity_id: 'light.norad_corner_torch',
              state: 'on',
              attributes: {},
              last_changed: new Date().toISOString(),
              last_updated: new Date().toISOString(),
              context: { id: '2', parent_id: null, user_id: null },
            },
          },
          time_fired: new Date().toISOString(),
          origin: 'LOCAL',
          context: { id: '3', parent_id: null, user_id: null },
        });
      }, 0);

      return { unsubscribe: mockUnsubscribe };
    });

    render(<DebugPanel />);

    fireEvent.click(
      screen.getByRole('button', { name: /toggle light\.norad_corner_torch via home assistant/i })
    );

    expect(
      await screen.findByText(/toggled light\.norad_corner_torch\. current state: on\./i)
    ).toBeInTheDocument();
    expect(mockHaClient.connect).toHaveBeenCalledTimes(1);
    expect(mockHaClient.callService).toHaveBeenCalledWith({
      domain: 'light',
      service: 'toggle',
      service_data: {
        entity_id: 'light.norad_corner_torch',
      },
    });
    expect(mockHaClient.getState).toHaveBeenCalledWith('light.norad_corner_torch');
  });

  it('should show error message when light toggle test fails', async () => {
    vi.stubEnv('DEV', true);
    vi.mocked(useFeatureFlags).mockReturnValue({
      flags: { HA_CONNECTION: true },
      service: mockService,
    });

    mockHaClient.connect.mockResolvedValue(undefined);
    mockHaClient.getState.mockResolvedValueOnce({
      entity_id: 'light.norad_corner_torch',
      state: 'off',
      attributes: {},
      last_changed: new Date().toISOString(),
      last_updated: new Date().toISOString(),
      context: { id: '1', parent_id: null, user_id: null },
    });
    mockHaClient.callService.mockRejectedValue(new Error('service failed'));

    render(<DebugPanel />);

    fireEvent.click(
      screen.getByRole('button', { name: /toggle light\.norad_corner_torch via home assistant/i })
    );

    expect(await screen.findByText(/error: service failed/i)).toBeInTheDocument();
  });
});
