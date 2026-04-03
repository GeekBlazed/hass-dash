import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useDashboardStore } from '../../stores/useDashboardStore';
import { DashboardStage } from './DashboardStage';

vi.mock('./stage/FloorplanCanvas', () => ({
  FloorplanCanvas: () => <div data-testid="floorplan-canvas" />,
}));

vi.mock('./stage/StageDevReadout', () => ({
  StageDevReadout: () => <div data-testid="stage-dev-readout" />,
}));

vi.mock('./stage/MapControlsToggle', () => ({
  MapControlsToggle: () => <div data-testid="map-controls-toggle" />,
}));

vi.mock('./stage/MapControls', () => ({
  MapControls: () => <div data-testid="map-controls" />,
}));

describe('DashboardStage', () => {
  beforeEach(() => {
    useDashboardStore.setState({
      isMapControlsOpen: false,
      stageMediaStreamUrl: null,
    });
  });

  it('renders floorplan content when no media stream url is set', () => {
    render(<DashboardStage onRetryFloorplan={() => {}} />);

    expect(screen.getByLabelText('Interactive floorplan')).toBeInTheDocument();
    expect(screen.getByTestId('floorplan-canvas')).toBeInTheDocument();
  });

  it('renders live stream iframe when media stream url is set', () => {
    useDashboardStore.setState({
      stageMediaStreamUrl: 'http://stream1.tv:8889/hdmi/',
    });

    render(<DashboardStage onRetryFloorplan={() => {}} />);

    const streamFrame = screen.getByTitle('Live stream: Firestick 4K 1');
    expect(streamFrame).toBeInTheDocument();
    expect(streamFrame).toHaveAttribute('src', 'http://stream1.tv:8889/hdmi/');
    expect(screen.queryByLabelText('Interactive floorplan')).not.toBeInTheDocument();
  });
});
