import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { useConnectivityStore } from '../../../stores/useConnectivityStore';
import { OfflineIndicator } from './OfflineIndicator';

describe('OfflineIndicator', () => {
  beforeEach(() => {
    useConnectivityStore.setState({ isOnline: true, haConnected: true });
  });

  it('renders nothing when online and connected', () => {
    const { container } = render(<OfflineIndicator />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders Offline when browser is offline', () => {
    useConnectivityStore.setState({ isOnline: false, haConnected: true });
    render(<OfflineIndicator />);
    expect(screen.getByText('Offline')).toBeInTheDocument();
  });

  it('renders Disconnected when HA is disconnected but browser is online', () => {
    useConnectivityStore.setState({ isOnline: true, haConnected: false });
    render(<OfflineIndicator />);
    expect(screen.getByText('Disconnected')).toBeInTheDocument();
  });
});
