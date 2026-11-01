import type { ReactNode } from "react";
import { Modal, ModalClose, ModalTitle } from "./Modal.tsx";

/** A titled modal with a close button, for longer flows (accounts, hand-off, review requests). */
export function BatchDialog({ title, close, children }: { title: string; close: () => void; children: ReactNode }) {
  return (
    <Modal onClose={close} overlayClass="dialog batch-overlay">
      <div className="batch-dialog">
        <header>
          <ModalTitle>{title}</ModalTitle>
          <ModalClose type="button" aria-label="Close dialog">
            ×
          </ModalClose>
        </header>
        {children}
      </div>
    </Modal>
  );
}
