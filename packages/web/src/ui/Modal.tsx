import * as Dialog from "@radix-ui/react-dialog";
import type { ReactElement, ReactNode } from "react";

/**
 * Every modal in the shell. Radix keeps focus inside, gives it back on close, and closes on Esc or a click on the
 * backdrop. The child is the panel itself (a `form` or `div` with class `panel`); put a `ModalTitle` inside it.
 */
export function Modal({ onClose, overlayClass = "dialog", initialFocus, children }: {
  onClose: () => void; overlayClass?: string; initialFocus?: string; children: ReactElement;
}) {
  return (
    <Dialog.Root open onOpenChange={(open) => { if (!open) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className={overlayClass}>
          <Dialog.Content
            asChild
            aria-describedby={undefined}
            onOpenAutoFocus={(event) => {
              // Radix focuses the first control; a modal can name a better one (the prompt, the folder).
              const target = initialFocus ? (event.currentTarget as HTMLElement).querySelector<HTMLElement>(initialFocus) : null;
              if (target) { event.preventDefault(); target.focus(); }
            }}
          >
            {children}
          </Dialog.Content>
        </Dialog.Overlay>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/** The modal's heading, also its accessible name. */
export function ModalTitle({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <Dialog.Title asChild>
      <h2 className={className}>{children}</h2>
    </Dialog.Title>
  );
}

export const ModalClose = Dialog.Close;
