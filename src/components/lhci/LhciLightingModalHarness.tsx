import { useMemo, useState } from 'react';

import { useEntityStore } from '../../stores/useEntityStore';
import { LightDetailsPanel } from '../dashboard/panels/LightDetailsPanel';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/Dialog';

type HarnessParams = {
  enabled: boolean;
  entityId: string;
};

const parseHarnessParams = (): HarnessParams => {
  try {
    const params = new URLSearchParams(window.location.search);
    if (!params.has('lhci')) return { enabled: false, entityId: '' };

    const enabled =
      params.get('lhciOpenLightDetails') === '1' || params.get('lhciOpen') === 'lightDetails';
    if (!enabled) return { enabled: false, entityId: '' };

    return {
      enabled: true,
      entityId: params.get('lhciLightEntityId') ?? 'light.lhci_demo',
    };
  } catch {
    return { enabled: false, entityId: '' };
  }
};

/**
 * LHCI-only UI harness.
 *
 * When running Lighthouse CI with `?lhci=1&lhciOpenLightDetails=1`,
 * force the Light Details modal open so the report screenshots capture it.
 */
export function LhciLightingModalHarness() {
  const params = useMemo(() => parseHarnessParams(), []);
  const [open, setOpen] = useState(params.enabled);
  const entityId = params.entityId;

  const exists = useEntityStore((s) => (entityId ? Boolean(s.entitiesById[entityId]) : false));

  const title = useMemo(() => {
    if (!entityId) return 'Light details';
    return `Light details (${entityId})`;
  }, [entityId]);

  if (!open) return null;
  if (!exists) return null;

  return (
    <Dialog open={open} onOpenChange={() => setOpen(false)}>
      <DialogContent overlayClassName="modal" className="modal-container" showCloseButton={false}>
        <DialogHeader className="sr-only">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>LHCI harness: force-open light details modal.</DialogDescription>
        </DialogHeader>
        <div className="modal-body" onContextMenu={(e) => e.preventDefault()}>
          <LightDetailsPanel
            entityId={entityId}
            onBack={() => setOpen(false)}
            backLabel="Close"
            backAriaLabel="Close light details"
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
