import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useFeatureFlag, useFeatureFlags } from './useFeatureFlag';
import { vi } from 'vitest';

describe('useFeatureFlag', () => {
  it('should return isEnabled false for disabled features', () => {
    vi.stubEnv('VITE_FEATURE_TEST', 'false');
    
    const { result } = renderHook(() => useFeatureFlag('TEST'));

    expect(result.current.isEnabled).toBe(false);
    expect(result.current.service).toBeDefined();
  });

  it('should return isEnabled true for enabled features', () => {
    vi.stubEnv('VITE_FEATURE_TEST', 'true');
    
    const { result } = renderHook(() => useFeatureFlag('TEST'));

    expect(result.current.isEnabled).toBe(true);
    expect(result.current.service).toBeDefined();
  });

  it('should provide access to the feature flag service', () => {
    const { result } = renderHook(() => useFeatureFlag('TEST'));

    expect(result.current.service).toBeDefined();
    expect(typeof result.current.service.isEnabled).toBe('function');
    expect(typeof result.current.service.getAll).toBe('function');
    expect(typeof result.current.service.enable).toBe('function');
    expect(typeof result.current.service.disable).toBe('function');
  });

  it('should return same service instance on re-render', () => {
    const { result, rerender } = renderHook(() => useFeatureFlag('TEST'));

    const firstService = result.current.service;
    rerender();
    const secondService = result.current.service;

    expect(firstService).toBe(secondService);
  });
});

describe('useFeatureFlags', () => {
  it('should return all feature flags', () => {
    vi.stubEnv('VITE_FEATURE_TEST1', 'true');
    vi.stubEnv('VITE_FEATURE_TEST2', 'false');
    
    const { result } = renderHook(() => useFeatureFlags());

    expect(result.current.flags).toBeDefined();
    expect(typeof result.current.flags).toBe('object');
  });

  it('should provide access to the feature flag service', () => {
    const { result } = renderHook(() => useFeatureFlags());

    expect(result.current.service).toBeDefined();
    expect(typeof result.current.service.isEnabled).toBe('function');
    expect(typeof result.current.service.getAll).toBe('function');
  });

  it('should return same service instance on re-render', () => {
    const { result, rerender } = renderHook(() => useFeatureFlags());

    const firstService = result.current.service;
    rerender();
    const secondService = result.current.service;

    expect(firstService).toBe(secondService);
  });
});
