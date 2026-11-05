import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import Button from "../Button";

const Dialog = ({ open, onClose, title, children }) => {
  const dialogRef = useRef(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return createPortal(
    <dialog ref={dialogRef} aria-labelledby={titleId}
      className="ga-dialog" onClose={onClose}
      onCancel={(event) => { event.preventDefault(); onClose(); }}>
      <div className="flex items-start justify-between gap-4 mb-6">
        <h2 id={titleId} className="text-section font-semibold">{title}</h2>
        <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close dialog">✕</Button>
      </div>
      {children}
    </dialog>,
    document.body,
  );
};

export default Dialog;
