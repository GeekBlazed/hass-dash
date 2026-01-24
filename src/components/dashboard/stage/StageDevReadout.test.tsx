import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { useDashboardStore } from '../../../stores/useDashboardStore';
import { StageDevReadout } from './StageDevReadout';

describe('StageDevReadout', () => {
  beforeEach(() => {
    useDashboardStore.setState({
      stageView: { x: 0, y: 0, scale: 1 },
    });
  });

  it('renders x/y as 0 when stageView values are not finite', () => {
    useDashboardStore.setState({
      stageView: { x: Number.NaN, y: Number.POSITIVE_INFINITY, scale: 1 },
    });

    render(<StageDevReadout />);

    const x = document.getElementById('map-launch-x');
    const y = document.getElementById('map-launch-y');

    expect(x?.textContent).toBe('0');
    expect(y?.textContent).toBe('0');
  });
});
