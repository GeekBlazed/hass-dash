import { useMemo } from 'react';

import { container } from '../core/di-container';

export function useService<TService>(serviceIdentifier: symbol): TService {
  return useMemo(() => container.get<TService>(serviceIdentifier), [serviceIdentifier]);
}
