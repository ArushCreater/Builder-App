import { ReactNode, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from './ui/dialog';
import { Button } from './ui/button';

type ConfirmDialogProps = {
  trigger: ReactNode;
  title: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  confirmVariant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
  confirmDisabled?: boolean;
  onConfirm: () => void | Promise<void>;
};

export default function ConfirmDialog({
  trigger,
  title,
  description,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  confirmVariant = 'destructive',
  confirmDisabled,
  onConfirm,
}: ConfirmDialogProps) {
  const [open, setOpen] = useState(false);

  const handleConfirm = async () => {
    try {
      await onConfirm();
    } finally {
      setOpen(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" type="button" onClick={() => setOpen(false)}>
            {cancelText}
          </Button>
          <Button variant={confirmVariant} type="button" onClick={handleConfirm} disabled={confirmDisabled}>
            {confirmText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

