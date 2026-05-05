import { Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface ConfirmDeleteButtonProps {
  onConfirm: () => void;
  title?: string;
  description?: string;
  confirmLabel?: string;
  ariaLabel?: string;
  size?: number;
  className?: string;
}

const ConfirmDeleteButton = ({
  onConfirm,
  title = "Confirmar exclusão",
  description = "Esta ação não pode ser desfeita.",
  confirmLabel = "Excluir",
  ariaLabel = "Excluir",
  size = 14,
  className = "text-muted-foreground hover:text-expense transition-colors",
}: ConfirmDeleteButtonProps) => {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <button type="button" aria-label={ariaLabel} className={className}>
          <Trash2 size={size} />
        </button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="bg-expense text-primary-foreground hover:bg-expense/90"
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default ConfirmDeleteButton;
