import { Trash2 } from 'lucide-react';
import type { Course } from '../types';
import { Modal } from './Modal';

type DeleteCourseModalProps = {
  course: Course;
  sessionCount: number;
  onCancel: () => void;
  onDelete: () => void;
};

export function DeleteCourseModal({ course, sessionCount, onCancel, onDelete }: DeleteCourseModalProps) {
  return (
    <Modal title="Delete Course?" onClose={onCancel}>
      <p className="confirm-copy">
        Delete "{course.name}" permanently? This will also delete {sessionCount} recorded{' '}
        {sessionCount === 1 ? 'session' : 'sessions'} and cannot be undone.
      </p>
      <div className="modal-actions">
        <button className="secondary-action compact" onClick={onDelete}>
          <Trash2 size={17} />
          Delete anyways
        </button>
        <button className="primary-action compact" autoFocus onClick={onCancel}>
          Cancel
        </button>
      </div>
    </Modal>
  );
}
