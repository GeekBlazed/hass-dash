import { render, screen, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TYPES } from '../core/types';
import type { IHomeAssistantClient } from '../interfaces/IHomeAssistantClient';
import type {
  HomeAssistantConnectionConfig,
  HomeAssistantConnectionValidationResult,
  IHomeAssistantConnectionConfig,
} from '../interfaces/IHomeAssistantConnectionConfig';
import { HomeAssistantConnectionControls } from './HomeAssistantConnectionControls';

const useFeatureFlagMock = vi.hoisted(() => vi.fn());
const useServiceMock = vi.hoisted(() => vi.fn());

vi.mock('../hooks/useFeatureFlag', () => ({
  useFeatureFlag: useFeatureFlagMock,
}));

vi.mock('../hooks/useService', () => ({
  useService: useServiceMock,
}));

describe('HomeAssistantConnectionControls', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const withImportMetaEnv = async (
    overrides: Partial<Record<'DEV' | 'PROD', boolean>>,
    fn: () => Promise<void>
  ): Promise<void> => {
    const meta = import.meta as unknown as { env: Record<string, unknown> };
    const original = { ...meta.env };

    try {
      Object.assign(meta.env, overrides);
      await fn();
    } finally {
      try {
        Object.assign(meta.env, original);
      } catch {
        // Best-effort restore.
      }
    }
  };

  const createConnectionConfigStub = (opts: {
    config: HomeAssistantConnectionConfig;
    validation: HomeAssistantConnectionValidationResult;
    overrides?: HomeAssistantConnectionConfig;
  }): IHomeAssistantConnectionConfig => {
    const overrides: HomeAssistantConnectionConfig = opts.overrides ?? {};

    return {
      getConfig: () => opts.config,
      getEffectiveWebSocketUrl: () => opts.validation.effectiveWebSocketUrl,
      getAccessToken: () => opts.config.accessToken,
      validate: () => opts.validation,

      getOverrides: () => overrides,
      setOverrides: vi.fn(),
      clearOverrides: vi.fn(),
    };
  };

  const createClientStub = (): IHomeAssistantClient => ({
    connect: vi.fn(async () => undefined),
    connectWithConfig: vi.fn(async () => undefined),
    disconnect: vi.fn(),
    isConnected: vi.fn(() => false),
    getStates: vi.fn(async () => []),
    getState: vi.fn(async () => null),
    getServices: vi.fn(async () => []),
    subscribeToEvents: vi.fn(async () => ({ unsubscribe: async () => undefined })),
    callService: vi.fn(async () => ({
      context: { id: '1', parent_id: null, user_id: null },
      response: null,
    })),
  });

  it('does not render when HA_CONNECTION feature flag is disabled', () => {
    useFeatureFlagMock.mockReturnValue({ isEnabled: false });

    const configSvc = createConnectionConfigStub({
      config: {},
      validation: { isValid: false, errors: ['Missing token'] },
    });
    const haClient = createClientStub();

    useServiceMock.mockImplementation((token: symbol) => {
      if (token === TYPES.IHomeAssistantConnectionConfig) return configSvc;
      if (token === TYPES.IHomeAssistantClient) return haClient;
      throw new Error('Unexpected DI token');
    });

    const { container } = render(<HomeAssistantConnectionControls />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows validation errors and does not attempt connect when draft is invalid', async () => {
    const user = userEvent.setup();

    useFeatureFlagMock.mockReturnValue({ isEnabled: true });

    const configSvc = createConnectionConfigStub({
      config: { baseUrl: '', webSocketUrl: '', accessToken: '' },
      validation: { isValid: false, errors: ['Access token is required.'] },
    });
    const haClient = createClientStub();

    useServiceMock.mockImplementation((token: symbol) => {
      if (token === TYPES.IHomeAssistantConnectionConfig) return configSvc;
      if (token === TYPES.IHomeAssistantClient) return haClient;
      throw new Error('Unexpected DI token');
    });

    render(<HomeAssistantConnectionControls />);

    expect(screen.getByLabelText('HA: Not configured')).toBeInTheDocument();

    await user.click(
      screen.getByRole('button', { name: 'Open Home Assistant connection settings' })
    );

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('Home Assistant Connection')).toBeInTheDocument();

    // Initial draft is invalid, so Validation section should be visible.
    expect(within(dialog).getByText('Validation')).toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: 'Test' }));

    expect(haClient.connect).not.toHaveBeenCalled();
    expect(within(dialog).getByText(/Error:/i)).toBeInTheDocument();
  });

  it('shows websocket URL validation error when websocket url is invalid', async () => {
    const user = userEvent.setup();

    useFeatureFlagMock.mockReturnValue({ isEnabled: true });

    const configSvc = createConnectionConfigStub({
      config: { baseUrl: '', webSocketUrl: 'http://example.com', accessToken: 'token' },
      validation: { isValid: false, errors: ['Access token is required.'] },
    });
    const haClient = createClientStub();

    useServiceMock.mockImplementation((token: symbol) => {
      if (token === TYPES.IHomeAssistantConnectionConfig) return configSvc;
      if (token === TYPES.IHomeAssistantClient) return haClient;
      throw new Error('Unexpected DI token');
    });

    render(<HomeAssistantConnectionControls />);

    await user.click(
      screen.getByRole('button', { name: 'Open Home Assistant connection settings' })
    );

    const dialog = screen.getByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Test' }));

    expect(haClient.connect).not.toHaveBeenCalled();
    expect(
      within(dialog).getByText(/WebSocket URL must start with ws:\/\/ or wss:\/\//i, {
        selector: 'li',
      })
    ).toBeInTheDocument();
  });

  it('shows base URL validation error when base url has an invalid protocol', async () => {
    const user = userEvent.setup();

    useFeatureFlagMock.mockReturnValue({ isEnabled: true });

    const configSvc = createConnectionConfigStub({
      config: { baseUrl: 'ftp://example.com', webSocketUrl: '', accessToken: 'token' },
      validation: { isValid: false, errors: ['Access token is required.'] },
    });
    const haClient = createClientStub();

    useServiceMock.mockImplementation((token: symbol) => {
      if (token === TYPES.IHomeAssistantConnectionConfig) return configSvc;
      if (token === TYPES.IHomeAssistantClient) return haClient;
      throw new Error('Unexpected DI token');
    });

    render(<HomeAssistantConnectionControls />);

    await user.click(
      screen.getByRole('button', { name: 'Open Home Assistant connection settings' })
    );

    const dialog = screen.getByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Test' }));

    expect(haClient.connect).not.toHaveBeenCalled();
    expect(
      within(dialog).getByText(/Base URL must start with http:\/\/ or https:\/\//i, {
        selector: 'li',
      })
    ).toBeInTheDocument();
  });

  it('accepts base URL scheme casing and can test-connect in dev mode', async () => {
    const user = userEvent.setup();

    useFeatureFlagMock.mockReturnValue({ isEnabled: true });

    // Ensure we accept scheme casing (URL() normalizes protocol).
    const configSvc = createConnectionConfigStub({
      config: {
        baseUrl: 'HTTPS://homeassistant.local:8123',
        webSocketUrl: '',
        accessToken: 'token',
      },
      validation: { isValid: false, errors: ['Access token is required.'] },
    });
    const haClient = createClientStub();

    useServiceMock.mockImplementation((token: symbol) => {
      if (token === TYPES.IHomeAssistantConnectionConfig) return configSvc;
      if (token === TYPES.IHomeAssistantClient) return haClient;
      throw new Error('Unexpected DI token');
    });

    render(<HomeAssistantConnectionControls />);

    await user.click(
      screen.getByRole('button', { name: 'Open Home Assistant connection settings' })
    );

    const dialog = screen.getByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Test' }));

    expect(haClient.connect).not.toHaveBeenCalled();
    expect(haClient.connectWithConfig).toHaveBeenCalledTimes(1);
    expect(within(dialog).getByText('Connected successfully.')).toBeInTheDocument();
  });

  it('tests connection successfully in dev mode without mutating overrides', async () => {
    const user = userEvent.setup();

    useFeatureFlagMock.mockReturnValue({ isEnabled: true });

    const configSvc = createConnectionConfigStub({
      config: {
        baseUrl: 'https://example/',
        webSocketUrl: '',
        accessToken: 'token',
      },
      validation: {
        isValid: true,
        errors: [],
        effectiveWebSocketUrl: 'wss://example/api/websocket',
      },
      overrides: {},
    });

    const haClient = createClientStub();

    useServiceMock.mockImplementation((token: symbol) => {
      if (token === TYPES.IHomeAssistantConnectionConfig) return configSvc;
      if (token === TYPES.IHomeAssistantClient) return haClient;
      throw new Error('Unexpected DI token');
    });

    render(<HomeAssistantConnectionControls />);

    expect(screen.getByLabelText('HA: Configured')).toBeInTheDocument();

    await user.click(
      screen.getByRole('button', { name: 'Open Home Assistant connection settings' })
    );

    const dialog = screen.getByRole('dialog');

    await user.click(within(dialog).getByRole('button', { name: 'Test' }));

    expect(configSvc.setOverrides).not.toHaveBeenCalled();
    expect(haClient.connect).not.toHaveBeenCalled();
    expect(haClient.connectWithConfig).toHaveBeenCalledTimes(1);
    expect(haClient.connectWithConfig).toHaveBeenCalledWith({
      baseUrl: 'https://example/',
      webSocketUrl: '',
      accessToken: 'token',
    });
    expect(configSvc.clearOverrides).not.toHaveBeenCalled();

    expect(within(dialog).getByText('Connected successfully.')).toBeInTheDocument();
  });

  it('does not mutate existing overrides during a test connection', async () => {
    const user = userEvent.setup();

    useFeatureFlagMock.mockReturnValue({ isEnabled: true });

    const previousOverrides: HomeAssistantConnectionConfig = {
      baseUrl: 'https://prev/',
      webSocketUrl: 'wss://prev/api/websocket',
      accessToken: 'prev-token',
    };

    const configSvc = createConnectionConfigStub({
      config: {
        baseUrl: 'https://example/',
        webSocketUrl: '',
        accessToken: 'token',
      },
      validation: {
        isValid: true,
        errors: [],
        effectiveWebSocketUrl: 'wss://example/api/websocket',
      },
      overrides: previousOverrides,
    });

    const haClient = createClientStub();

    useServiceMock.mockImplementation((token: symbol) => {
      if (token === TYPES.IHomeAssistantConnectionConfig) return configSvc;
      if (token === TYPES.IHomeAssistantClient) return haClient;
      throw new Error('Unexpected DI token');
    });

    render(<HomeAssistantConnectionControls />);

    await user.click(
      screen.getByRole('button', { name: 'Open Home Assistant connection settings' })
    );

    const dialog = screen.getByRole('dialog');

    await user.click(within(dialog).getByRole('button', { name: 'Test' }));

    expect(configSvc.setOverrides).not.toHaveBeenCalled();
    expect(configSvc.clearOverrides).not.toHaveBeenCalled();
    expect(haClient.connect).not.toHaveBeenCalled();
    expect(haClient.connectWithConfig).toHaveBeenCalledTimes(1);
  });

  it('does not call setOverrides during testConnection in production mode', async () => {
    await withImportMetaEnv({ DEV: false, PROD: true }, async () => {
      const user = userEvent.setup();

      useFeatureFlagMock.mockReturnValue({ isEnabled: true });

      const configSvc = createConnectionConfigStub({
        config: {
          baseUrl: 'https://example/',
          webSocketUrl: '',
          accessToken: 'token',
        },
        validation: {
          isValid: true,
          errors: [],
          effectiveWebSocketUrl: 'wss://example/api/websocket',
        },
      });

      const haClient = createClientStub();

      useServiceMock.mockImplementation((token: symbol) => {
        if (token === TYPES.IHomeAssistantConnectionConfig) return configSvc;
        if (token === TYPES.IHomeAssistantClient) return haClient;
        throw new Error('Unexpected DI token');
      });

      render(<HomeAssistantConnectionControls />);

      await user.click(
        screen.getByRole('button', { name: 'Open Home Assistant connection settings' })
      );

      const dialog = screen.getByRole('dialog');
      expect(
        within(dialog).getByText(/Runtime overrides are disabled in production\./i)
      ).toBeInTheDocument();

      // Save should be disabled in production (guarding against override mutation).
      expect(within(dialog).getByRole('button', { name: 'Save' })).toBeDisabled();

      await user.click(within(dialog).getByRole('button', { name: 'Test' }));

      expect(configSvc.setOverrides).not.toHaveBeenCalled();
      expect(configSvc.clearOverrides).not.toHaveBeenCalled();
      expect(haClient.connectWithConfig).not.toHaveBeenCalled();
      expect(haClient.connect).toHaveBeenCalledTimes(1);

      expect(within(dialog).getByText('Connected successfully.')).toBeInTheDocument();
    });
  });

  it('saves overrides in dev mode and resets test status to idle', async () => {
    await withImportMetaEnv({ DEV: true, PROD: false }, async () => {
      const user = userEvent.setup();

      useFeatureFlagMock.mockReturnValue({ isEnabled: true });

      let configState: HomeAssistantConnectionConfig = {
        baseUrl: 'https://initial/',
        webSocketUrl: '',
        accessToken: 'initial-token',
      };

      const configSvc: IHomeAssistantConnectionConfig = {
        getConfig: () => configState,
        getEffectiveWebSocketUrl: () => undefined,
        getAccessToken: () => configState.accessToken,
        validate: () => ({ isValid: false, errors: ['Not configured'] }),

        getOverrides: () => ({}),
        setOverrides: vi.fn((overrides: HomeAssistantConnectionConfig) => {
          configState = { ...configState, ...overrides };
        }),
        clearOverrides: vi.fn(),
      };

      const haClient = createClientStub();

      useServiceMock.mockImplementation((token: symbol) => {
        if (token === TYPES.IHomeAssistantConnectionConfig) return configSvc;
        if (token === TYPES.IHomeAssistantClient) return haClient;
        throw new Error('Unexpected DI token');
      });

      render(<HomeAssistantConnectionControls />);

      await user.click(
        screen.getByRole('button', { name: 'Open Home Assistant connection settings' })
      );

      const dialog = screen.getByRole('dialog');

      // Trigger a connection test so we can verify Save resets status to idle.
      await user.clear(within(dialog).getByLabelText('Base URL'));
      await user.type(within(dialog).getByLabelText('Base URL'), 'https://example/');
      await user.clear(within(dialog).getByLabelText('WebSocket URL (optional)'));
      await user.clear(within(dialog).getByLabelText('Access Token'));
      await user.type(within(dialog).getByLabelText('Access Token'), 'token');

      await user.click(within(dialog).getByRole('button', { name: 'Test' }));
      expect(within(dialog).getByText('Connected successfully.')).toBeInTheDocument();

      await user.click(within(dialog).getByRole('button', { name: 'Save' }));

      expect(configSvc.setOverrides).toHaveBeenCalledTimes(1);
      expect(configSvc.setOverrides).toHaveBeenCalledWith({
        baseUrl: 'https://example/',
        webSocketUrl: '',
        accessToken: 'token',
      });

      // Save() resets the test status.
      expect(within(dialog).getByText('Connection test not run.')).toBeInTheDocument();
    });
  });

  it('clears overrides in dev mode and refreshes the draft fields from config', async () => {
    await withImportMetaEnv({ DEV: true, PROD: false }, async () => {
      const user = userEvent.setup();

      useFeatureFlagMock.mockReturnValue({ isEnabled: true });

      let configState: HomeAssistantConnectionConfig = {
        baseUrl: 'https://example/',
        webSocketUrl: 'wss://example/api/websocket',
        accessToken: 'token',
      };

      const clearOverrides = vi.fn(() => {
        configState = {};
      });

      const configSvc: IHomeAssistantConnectionConfig = {
        getConfig: () => configState,
        getEffectiveWebSocketUrl: () => undefined,
        getAccessToken: () => configState.accessToken,
        validate: () => ({ isValid: true, errors: [] }),

        getOverrides: () => ({ ...configState }),
        setOverrides: vi.fn(),
        clearOverrides,
      };

      const haClient = createClientStub();

      useServiceMock.mockImplementation((token: symbol) => {
        if (token === TYPES.IHomeAssistantConnectionConfig) return configSvc;
        if (token === TYPES.IHomeAssistantClient) return haClient;
        throw new Error('Unexpected DI token');
      });

      render(<HomeAssistantConnectionControls />);

      await user.click(
        screen.getByRole('button', { name: 'Open Home Assistant connection settings' })
      );

      const dialog = screen.getByRole('dialog');
      expect(within(dialog).getByLabelText('Base URL')).toHaveValue('https://example/');
      expect(within(dialog).getByLabelText('WebSocket URL (optional)')).toHaveValue(
        'wss://example/api/websocket'
      );
      expect(within(dialog).getByLabelText('Access Token')).toHaveValue('token');

      // Change draft (executes onChange callbacks), then clear.
      await user.clear(within(dialog).getByLabelText('Base URL'));
      await user.type(within(dialog).getByLabelText('Base URL'), 'https://changed/');

      await user.click(within(dialog).getByRole('button', { name: 'Clear' }));
      expect(clearOverrides).toHaveBeenCalledTimes(1);

      // Draft should be reset from getConfig() (now empty).
      expect(within(dialog).getByLabelText('Base URL')).toHaveValue('');
      expect(within(dialog).getByLabelText('WebSocket URL (optional)')).toHaveValue('');
      expect(within(dialog).getByLabelText('Access Token')).toHaveValue('');
    });
  });

  it('falls back to connect() in dev mode if connectWithConfig is not implemented', async () => {
    await withImportMetaEnv({ DEV: true, PROD: false }, async () => {
      const user = userEvent.setup();

      useFeatureFlagMock.mockReturnValue({ isEnabled: true });

      const configSvc = createConnectionConfigStub({
        config: {
          baseUrl: 'https://example/',
          webSocketUrl: '',
          accessToken: 'token',
        },
        validation: {
          isValid: true,
          errors: [],
          effectiveWebSocketUrl: 'wss://example/api/websocket',
        },
      });

      const haClient: IHomeAssistantClient = {
        ...createClientStub(),
        connectWithConfig: undefined,
      };

      useServiceMock.mockImplementation((token: symbol) => {
        if (token === TYPES.IHomeAssistantConnectionConfig) return configSvc;
        if (token === TYPES.IHomeAssistantClient) return haClient;
        throw new Error('Unexpected DI token');
      });

      render(<HomeAssistantConnectionControls />);

      await user.click(
        screen.getByRole('button', { name: 'Open Home Assistant connection settings' })
      );

      const dialog = screen.getByRole('dialog');
      await user.click(within(dialog).getByRole('button', { name: 'Test' }));

      expect(haClient.connect).toHaveBeenCalledTimes(1);
      expect(haClient.connectWithConfig).toBeUndefined();
      expect(within(dialog).getByText('Connected successfully.')).toBeInTheDocument();
    });
  });

  it('shows "Unknown error" for non-Error rejections and always disconnects', async () => {
    await withImportMetaEnv({ DEV: false, PROD: true }, async () => {
      const user = userEvent.setup();

      useFeatureFlagMock.mockReturnValue({ isEnabled: true });

      const configSvc = createConnectionConfigStub({
        config: {
          baseUrl: 'https://example/',
          webSocketUrl: '',
          accessToken: 'token',
        },
        validation: {
          isValid: true,
          errors: [],
          effectiveWebSocketUrl: 'wss://example/api/websocket',
        },
      });

      const haClient = createClientStub();
      (haClient.connect as unknown as ReturnType<typeof vi.fn>).mockRejectedValue('boom');

      useServiceMock.mockImplementation((token: symbol) => {
        if (token === TYPES.IHomeAssistantConnectionConfig) return configSvc;
        if (token === TYPES.IHomeAssistantClient) return haClient;
        throw new Error('Unexpected DI token');
      });

      render(<HomeAssistantConnectionControls />);

      await user.click(
        screen.getByRole('button', { name: 'Open Home Assistant connection settings' })
      );

      const dialog = screen.getByRole('dialog');
      await user.click(within(dialog).getByRole('button', { name: 'Test' }));

      expect(within(dialog).getByText('Error: Unknown error')).toBeInTheDocument();
      expect(haClient.disconnect).toHaveBeenCalledTimes(1);
    });
  });
});
