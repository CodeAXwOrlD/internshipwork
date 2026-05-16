import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "default" | "destructive";
  confirmText?: string; // If set, user must type this to confirm
  onConfirm: () => void;
  loading?: boolean;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "default",
  confirmText,
  onConfirm,
  loading,
}: ConfirmDialogProps) {
  const [typed, setTyped] = useState("");
  const canConfirm = confirmText ? typed === confirmText : true;

  return (
    <AlertDialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) setTyped(""); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="break-all font-bold">{title}</AlertDialogTitle>
          <AlertDialogDescription className="break-all">{description}</AlertDialogDescription>
        </AlertDialogHeader>

        {confirmText && (
          <div className="space-y-2 py-2">
            <p className="text-sm text-muted-foreground">
              Type <span className="font-mono font-bold text-foreground">{confirmText}</span> to confirm:
            </p>
            <Input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder={confirmText}
              autoFocus
            />
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>{cancelLabel}</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => { e.preventDefault(); onConfirm(); }}
            disabled={!canConfirm || loading}
            className={variant === "destructive" ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : ""}
          >
            {loading ? "Processing..." : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
