import { Trash2 } from 'lucide-react';
import type { Course } from '../types';
import { Modal } from './Modal';

type DeleteCourseModalProps = (
  | {
      course: Course;
      sessionCount: number;
      emptyCourseCount?: never;
    }
  | {
      course?: never;
      sessionCount?: never;
      emptyCourseCount: number;
    }
) & {
  onCancel: () => void;
  onDelete: () => void;
};

export function DeleteCourseModal({ course, sessionCount, emptyCourseCount, onCancel, onDelete }: DeleteCourseModalProps) {
  const title = course ? 'Delete Course?' : 'Delete Empty Courses?';

  return (
    <Modal title={title} onClose={onCancel}>
      {course ? (
        <p className="confirm-copy">
          Delete "{course.name}" permanently? This will also delete {sessionCount} recorded{' '}
          {sessionCount === 1 ? 'session' : 'sessions'} and cannot be undone.
        </p>
      ) : (
        <p className="confirm-copy">
          Delete {emptyCourseCount} empty {emptyCourseCount === 1 ? 'course' : 'courses'} permanently? This cannot be
          undone.
        </p>
      )}
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
