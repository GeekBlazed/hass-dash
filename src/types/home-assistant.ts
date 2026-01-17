/**
 * Home Assistant API types
 *
 * These interfaces model the payload shapes used by Home Assistant's REST and WebSocket APIs.
 * They are intended to be stable contracts for our app regardless of where data originates.
 */

export type HaEntityId = string;

export interface HaContext {
  id: string;
  parent_id: string | null;
  user_id: string | null;
}

export interface HaEntityState<TAttributes = Record<string, unknown>> {
  entity_id: HaEntityId;
  state: string;
  attributes: TAttributes;
  last_changed: string;
  last_updated: string;
  context: HaContext;
}

export type HaEventOrigin = 'LOCAL' | 'REMOTE' | string;

export interface HaEvent<TData = Record<string, unknown>> {
  event_type: string;
  data: TData;
  time_fired: string;
  origin: HaEventOrigin;
  context: HaContext;
}

export interface HaStateChangedEventData {
  entity_id: HaEntityId;
  old_state: HaEntityState | null;
  new_state: HaEntityState | null;
}

export interface HaServiceTarget {
  entity_id?: HaEntityId | HaEntityId[];
  device_id?: string | string[];
  area_id?: string | string[];
  floor_id?: string | string[];
  label_id?: string | string[];
}

export interface HaCallServiceParams {
  domain: string;
  service: string;
  service_data?: Record<string, unknown>;
  target?: HaServiceTarget;
  return_response?: boolean;
}

export interface HaCallServiceResult {
  context: HaContext;
  response: unknown;
}

export interface HaRestServiceField {
  description?: string;
  example?: unknown;
  required?: boolean;
  selector?: unknown;
}

export interface HaRestServiceInfo {
  description?: string;
  fields?: Record<string, HaRestServiceField>;
}

export interface HaRestServicesDomain {
  domain: string;
  services: Record<string, HaRestServiceInfo>;
}

export interface HaWsAuthRequiredMessage {
  type: 'auth_required';
  ha_version: string;
}

export interface HaWsAuthOkMessage {
  type: 'auth_ok';
  ha_version: string;
}

export interface HaWsAuthInvalidMessage {
  type: 'auth_invalid';
  message: string;
}

export interface HaWsError {
  code: string;
  message: string;
  translation_key?: string;
  translation_domain?: string;
  translation_placeholders?: Record<string, string>;
}

export interface HaWsResultMessage<TResult = unknown> {
  id: number;
  type: 'result';
  success: boolean;
  result: TResult;
  error?: HaWsError;
}

export interface HaWsEventMessage<TEvent = HaEvent> {
  id: number;
  type: 'event';
  event: TEvent;
}

export interface HaTriggerStateChange {
  platform: 'state' | string;
  entity_id: HaEntityId;
  from_state: HaEntityState | null;
  to_state: HaEntityState | null;
  for: unknown;
  attribute: string | null;
  description?: string;
}

export interface HaTriggerEvent {
  variables: {
    trigger: HaTriggerStateChange;
  };
  context: HaContext;
}

export interface HaWsPingMessage {
  id: number;
  type: 'ping';
}

export interface HaWsPongMessage {
  id: number;
  type: 'pong';
}
