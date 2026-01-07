import type {
  HomeAssistantConnectionConfig,
  HomeAssistantConnectionValidationResult,
} from '../interfaces/IHomeAssistantConnectionConfig';

const isValidUrlWithProtocol = (
  value: string,
  allowedProtocols: Array<'http:' | 'https:' | 'ws:' | 'wss:'>
): boolean => {
  try {
    const url = new URL(value);
    return allowedProtocols.includes(url.protocol as (typeof allowedProtocols)[number]);
  } catch {
    return false;
  }
};

export const deriveWebSocketUrlFromBaseUrl = (baseUrl: string): string | undefined => {
  const trimmed = baseUrl.trim();

  try {
    const url = new URL(trimmed);

    let wsProtocol: 'ws:' | 'wss:' | undefined;
    if (url.protocol === 'https:') {
      wsProtocol = 'wss:';
    } else if (url.protocol === 'http:') {
      wsProtocol = 'ws:';
    } else {
      return undefined;
    }

    url.protocol = wsProtocol;
    url.pathname = `${url.pathname.replace(/\/$/, '')}/api/websocket`;
    url.search = '';
    url.hash = '';

    return url.toString();
  } catch {
    return undefined;
  }
};

export const validateHomeAssistantConnectionConfig = (
  config: HomeAssistantConnectionConfig
): HomeAssistantConnectionValidationResult => {
  const errors: string[] = [];

  const hasToken = Boolean(config.accessToken?.trim());
  if (!hasToken) {
    errors.push('Access token is required.');
  }

  const baseUrl = config.baseUrl?.trim();
  const wsUrl = config.webSocketUrl?.trim();

  let effectiveWebSocketUrl: string | undefined;

  if (wsUrl) {
    const wsValid = isValidUrlWithProtocol(wsUrl, ['ws:', 'wss:']);
    if (!wsValid) {
      errors.push('WebSocket URL must start with ws:// or wss:// and be a valid URL.');
    } else {
      effectiveWebSocketUrl = wsUrl;
    }
  } else if (baseUrl) {
    const baseValid = isValidUrlWithProtocol(baseUrl, ['http:', 'https:']);
    if (!baseValid) {
      errors.push('Base URL must start with http:// or https:// and be a valid URL.');
    } else {
      effectiveWebSocketUrl = deriveWebSocketUrlFromBaseUrl(baseUrl);
      if (!effectiveWebSocketUrl) {
        errors.push('Could not derive WebSocket URL from Base URL.');
      }
    }
  } else {
    errors.push('Base URL or WebSocket URL is required.');
  }

  return {
    isValid: errors.length === 0,
    errors,
    effectiveWebSocketUrl,
  };
};
