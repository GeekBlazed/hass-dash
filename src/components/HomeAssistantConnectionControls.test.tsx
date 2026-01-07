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
    disconnect: vi.fn(),
    getStates: vi.fn(async () => []),
    getServices: vi.fn(async () => []),
    subscribeToEvents: vi.fn(async () => ({ unsubscribe: async () => undefined })),
    callService: vi.fn(async () => ({ context: { id: '1', parent_id: null, user_id: null } })),
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

  it('shows derive error when base url is valid but cannot be derived due to casing', async () => {
    const user = userEvent.setup();

    useFeatureFlagMock.mockReturnValue({ isEnabled: true });

    // URL is valid (https:), but helper derives only from lowercase prefixes.
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
    expect(
      within(dialog).getByText(/Could not derive WebSocket URL from Base URL\./i, {
        selector: 'li',
      })
    ).toBeInTheDocument();
  });

  it('tests connection successfully in dev mode and restores empty overrides by clearing', async () => {
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

    expect(configSvc.setOverrides).toHaveBeenCalledWith({
      baseUrl: 'https://example/',
      webSocketUrl: '',
      accessToken: 'token',
    });

    expect(haClient.connect).toHaveBeenCalledTimes(1);
    expect(haClient.disconnect).toHaveBeenCalledTimes(1);

    // With no previous overrides, component should clear overrides at the end.
    expect(configSvc.clearOverrides).toHaveBeenCalledTimes(1);

    expect(within(dialog).getByText('Connected successfully.')).toBeInTheDocument();
  });

  it('restores previous overrides after test when they existed', async () => {
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

    // Last call should restore previous overrides.
    expect(configSvc.setOverrides).toHaveBeenCalledWith(previousOverrides);
  });
});
