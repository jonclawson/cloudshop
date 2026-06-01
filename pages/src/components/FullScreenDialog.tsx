import { useEffect, type ReactNode } from 'react';

type FullScreenDialogProps = {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
};

export default function FullScreenDialog({
  open,
  onClose,
  title,
  children,
}: FullScreenDialogProps) {
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    document.addEventListener('keydown', onKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div
        className="absolute inset-0 bg-black/70"
        onMouseDown={(e) => {
          // Close only when clicking the backdrop, not inside the dialog content.
          if (e.target === e.currentTarget) onClose();
        }}
      />

      <div
        role="dialog"
        aria-modal="true"
        className="absolute inset-0 bg-white outline outline-2 outline-black"
      >
        <div className="flex items-center justify-between gap-3 border-b-2 border-black p-4">
          <div className="min-w-0">
            {title ? (
              <h2 className="text-xl font-extrabold truncate">{title}</h2>
            ) : (
              <div className="text-xl font-extrabold">Dialog</div>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-md border-2 border-black bg-white px-3 py-2 font-extrabold hover:bg-black hover:text-white transition"
          >
            Cancel
          </button>
        </div>

        <div className="h-[calc(100%-70px)] overflow-auto p-4">{children}</div>
      </div>
    </div>
  );
}
