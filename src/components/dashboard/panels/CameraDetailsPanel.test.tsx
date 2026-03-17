import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useService } from '../../../hooks/useService';
import { useEntityStore } from '../../../stores/useEntityStore';
import { CameraDetailsPanel } from './CameraDetailsPanel';

const TEST_TIMESTAMP = new Date(2026, 0, 3, 12, 0, 0).getTime().toString();

vi.mock('../../../hooks/useService', () => ({
  useService: vi.fn(),
}));

type CameraServiceMock = {
  fetchProxyImage: ReturnType<typeof vi.fn>;
};

const useServiceMock = vi.mocked(useService);

describe('CameraDetailsPanel', () => {
  const cameraService: CameraServiceMock = {
    fetchProxyImage: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    useEntityStore.getState().clear();
    useServiceMock.mockReturnValue(cameraService);

    useEntityStore.getState().setAll([
      {
        entity_id: 'camera.front_door',
        state: 'idle',
        attributes: { friendly_name: 'Front Door Camera' },
        last_changed: TEST_TIMESTAMP,
        last_updated: TEST_TIMESTAMP,
        context: {
          id: 'ctx-camera-front-door',
          parent_id: null,
          user_id: null,
        },
      },
    ]);
  });

  it('returns null when entity does not exist', () => {
    const { container } = render(
      <CameraDetailsPanel entityId="camera.unknown" onBack={() => undefined} />
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('loads and renders a snapshot image', async () => {
    const blob = new Blob(['image'], { type: 'image/jpeg' });
    cameraService.fetchProxyImage.mockResolvedValue(blob);

    const createObjectURL = vi
      .spyOn(URL, 'createObjectURL')
      .mockReturnValue('blob:http://localhost/mock-image');
    const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);

    render(<CameraDetailsPanel entityId="camera.front_door" onBack={() => undefined} />);

    expect(screen.getByText('Loading…')).toBeInTheDocument();

    await waitFor(() => {
      expect(
        screen.getByRole('img', { name: /snapshot from front door camera/i })
      ).toBeInTheDocument();
    });

    expect(cameraService.fetchProxyImage).toHaveBeenCalledWith('camera.front_door');

    createObjectURL.mockRestore();
    revokeObjectURL.mockRestore();
  });

  it('shows an error and retries on refresh', async () => {
    cameraService.fetchProxyImage
      .mockRejectedValueOnce(new Error('snapshot failed'))
      .mockResolvedValueOnce(new Blob(['ok'], { type: 'image/jpeg' }));

    const createObjectURL = vi
      .spyOn(URL, 'createObjectURL')
      .mockReturnValue('blob:http://localhost/retry-image');
    const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);

    render(<CameraDetailsPanel entityId="camera.front_door" onBack={() => undefined} />);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('snapshot failed');
    });

    fireEvent.click(screen.getByRole('button', { name: /refresh camera snapshot/i }));

    await waitFor(() => {
      expect(
        screen.getByRole('img', { name: /snapshot from front door camera/i })
      ).toBeInTheDocument();
    });

    expect(cameraService.fetchProxyImage).toHaveBeenCalledTimes(2);

    createObjectURL.mockRestore();
    revokeObjectURL.mockRestore();
  });

  it('calls onBack when back button is pressed', async () => {
    cameraService.fetchProxyImage.mockResolvedValue(new Blob(['ok'], { type: 'image/jpeg' }));

    const createObjectURL = vi
      .spyOn(URL, 'createObjectURL')
      .mockReturnValue('blob:http://localhost/back-image');
    const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);

    const onBack = vi.fn();

    render(<CameraDetailsPanel entityId="camera.front_door" onBack={onBack} />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /back to cameras/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /back to cameras/i }));
    expect(onBack).toHaveBeenCalledTimes(1);

    createObjectURL.mockRestore();
    revokeObjectURL.mockRestore();
  });
});
