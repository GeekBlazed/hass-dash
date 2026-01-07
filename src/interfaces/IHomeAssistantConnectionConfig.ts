export type HomeAssistantConnectionConfig = {
  baseUrl?: string;
  webSocketUrl?: string;
  accessToken?: string;
};

export type HomeAssistantConnectionValidationResult = {
  isValid: boolean;
  errors: string[];
  effectiveWebSocketUrl?: string;
};

/**
 * Home Assistant connection configuration abstraction.
 *
 * Provides validated config values and (dev-only) runtime overrides.
 */
export interface IHomeAssistantConnectionConfig {
  getConfig(): HomeAssistantConnectionConfig;

  /**
   * Returns the WebSocket URL either directly configured or derived from base URL.
   */
  getEffectiveWebSocketUrl(): string | undefined;

  getAccessToken(): string | undefined;

  validate(): HomeAssistantConnectionValidationResult;

  /**
   * Development-only runtime overrides stored in sessionStorage.
   */
  getOverrides(): HomeAssistantConnectionConfig;
  setOverrides(overrides: HomeAssistantConnectionConfig): void;
  clearOverrides(): void;
}
