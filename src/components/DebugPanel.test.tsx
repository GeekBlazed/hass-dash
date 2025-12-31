import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DebugPanel } from './DebugPanel';
import { useFeatureFlags } from '../hooks/useFeatureFlag';

// Mock the useFeatureFlags hook
vi.mock('../hooks/useFeatureFlag', () => ({
  useFeatureFlags: vi.fn(),
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

  beforeEach(() => {
    vi.clearAllMocks();
    mockReload.mockClear();
    // Set to development mode by default
    vi.stubEnv('DEV', true);
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
});
