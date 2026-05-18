// App-wide async delete confirmation: exposes `confirmDelete` via context and a singleton alert dialog.
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/shared/ui/AlertDialog";
import { Checkbox } from "@/shared/ui/Checkbox";

type DeleteConfirmationOptions = {
  title?: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  acknowledgementLabel?: string;
};

type DeleteConfirmationDialogState = {
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel: string;
  acknowledgementLabel: string | null;
};

type DeleteConfirmationContextValue = {
  confirmDelete: (options: DeleteConfirmationOptions) => Promise<boolean>;
};

const DeleteConfirmationContext = createContext<DeleteConfirmationContextValue | null>(null);

/** Maps optional dialog labels to the fully-resolved state shown in the alert. */
function toDialogState(options: DeleteConfirmationOptions): DeleteConfirmationDialogState {
  return {
    title: options.title ?? "Confirm Delete",
    description: options.description,
    confirmLabel: options.confirmLabel ?? "Delete",
    cancelLabel: options.cancelLabel ?? "Cancel",
    acknowledgementLabel: options.acknowledgementLabel ?? null,
  };
}

export function DeleteConfirmationProvider({ children }: Readonly<{ children: ReactNode }>) {
  // Open dialog state + promise resolver for the in-flight confirmation call.
  const [dialogState, setDialogState] = useState<DeleteConfirmationDialogState | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const resolverRef = useRef<((confirmed: boolean) => void) | null>(null);

  const settle = useCallback((confirmed: boolean) => {
    resolverRef.current?.(confirmed);
    resolverRef.current = null;
    setDialogState(null);
    setAcknowledged(false);
  }, []);

  // Opens the dialog and returns a promise resolved to true/false when the user chooses.
  const confirmDelete = useCallback((options: DeleteConfirmationOptions): Promise<boolean> => {
    if (resolverRef.current) {
      resolverRef.current(false);
      resolverRef.current = null;
    }

    setDialogState(toDialogState(options));
    setAcknowledged(false);
    return new Promise((resolve) => {
      resolverRef.current = resolve;
    });
  }, []);

  // On unmount, reject any pending confirmation so callers are not left hanging.
  useEffect(
    () => () => {
      resolverRef.current?.(false);
      resolverRef.current = null;
    },
    []
  );

  const value = useMemo<DeleteConfirmationContextValue>(
    () => ({
      confirmDelete,
    }),
    [confirmDelete]
  );

  return (
    <DeleteConfirmationContext.Provider value={value}>
      {children}
      {/* Modal resolves the pending `confirmDelete` promise */}
      <AlertDialog
        open={Boolean(dialogState)}
        onOpenChange={(open) => {
          if (!open) {
            settle(false);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{dialogState?.title}</AlertDialogTitle>
            <AlertDialogDescription>{dialogState?.description}</AlertDialogDescription>
          </AlertDialogHeader>
          {dialogState?.acknowledgementLabel ? (
            <label className="flex items-start gap-3 rounded-md border border-[var(--border)] bg-[var(--muted)] px-3 py-2 text-sm text-[var(--foreground)]">
              <Checkbox checked={acknowledged} onChange={(event) => setAcknowledged(event.currentTarget.checked)} />
              <span>{dialogState.acknowledgementLabel}</span>
            </label>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => settle(false)}>{dialogState?.cancelLabel}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-[var(--action-danger-fill)] text-white hover:bg-[var(--action-danger-fill-hover)] focus-visible:ring-[var(--action-danger-focus-ring)]"
              disabled={Boolean(dialogState?.acknowledgementLabel) && !acknowledged}
              onClick={(event) => {
                event.preventDefault();
                if (dialogState?.acknowledgementLabel && !acknowledged) return;
                settle(true);
              }}
            >
              {dialogState?.confirmLabel}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DeleteConfirmationContext.Provider>
  );
}

/** Consumer hook; must be used under `DeleteConfirmationProvider`. */
export function useDeleteConfirmation(): DeleteConfirmationContextValue {
  const context = useContext(DeleteConfirmationContext);
  if (!context) {
    throw new Error("useDeleteConfirmation must be used within DeleteConfirmationProvider.");
  }

  return context;
}
