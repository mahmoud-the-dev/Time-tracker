import { useEffect } from 'react';
import { Square } from 'lucide-react';
import { formatDuration } from '../time';
import type { Course } from '../types';
import { Modal } from './Modal';

type EndStudySessionModalProps = {
  activeCourse: Course | null;
  activeStudyMs: number;
  onClose: () => void;
  onEnd: () => void;
};

export function EndStudySessionModal({ activeCourse, activeStudyMs, onClose, onEnd }: EndStudySessionModalProps) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent): void {
      if ((event.key !== 'Enter' && event.code !== 'Space') || event.repeat) return;
      event.preventDefault();
      onEnd();
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onEnd]);

  return (
    <Modal title="End Session?" onClose={onClose}>
      <p className="confirm-copy">
        End your {activeCourse?.name || 'study'} session with {formatDuration(activeStudyMs)} of net study time?
      </p>
      <div className="modal-actions">
        <button onClick={onClose}>Cancel</button>
        <button className="secondary-action danger compact" onClick={onEnd}>
          <Square size={17} />
          End
        </button>
      </div>
    </Modal>
  );
}
