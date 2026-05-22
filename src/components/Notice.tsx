import { X } from 'lucide-react';

type NoticeProps = {
  kind: 'success' | 'error';
  message: string;
  onDismiss: () => void;
};

export function Notice({ kind, message, onDismiss }: NoticeProps) {
  return (
    <div className={`notice ${kind}`}>
      <span>{message}</span>
      <button onClick={onDismiss} aria-label={`Dismiss ${kind}`}>
        <X size={16} />
      </button>
    </div>
  );
}
