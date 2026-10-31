"use client";
import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
export default function Modal({
  open,
  onClose,
  title,
  children,
  drawer = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  drawer?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
    if (open) {
      const old = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        if (dialog.open) dialog.close();
        document.body.style.overflow = old;
        previouslyFocused?.focus();
      };
    }
  }, [open]);
  return (
    <dialog
      ref={ref}
      className={drawer ? "modal drawer" : "modal"}
      aria-label={title}
      onKeyDown={(event) => {
        if (event.key !== "Tab") return;
        const controls = Array.from(
          event.currentTarget.querySelectorAll<HTMLElement>(
            "a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]",
          ),
        ).filter(
          (element) =>
            element.tabIndex >= 0 && element.getClientRects().length > 0,
        );
        const first = controls[0];
        const last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-inner">
        <div className="modal-heading">
          <h2>{title}</h2>
          <button
            type="button"
            className="icon-button"
            aria-label="Закрыть окно"
            onClick={onClose}
          >
            <X size={22} />
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}
