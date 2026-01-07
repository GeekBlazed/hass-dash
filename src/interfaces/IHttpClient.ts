export interface IHttpClient {
  /**
   * Performs an authenticated GET request against the Home Assistant REST API.
   *
   * @param path - A path beginning with `/` (e.g. `/api/`).
   */
  get<TResponse>(path: string): Promise<TResponse>;

  /**
   * Performs an authenticated POST request against the Home Assistant REST API.
   *
   * @param path - A path beginning with `/`.
   * @param body - Request body to JSON-encode.
   */
  post<TResponse>(path: string, body?: unknown): Promise<TResponse>;
}
