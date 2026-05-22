import type { FormEvent } from 'react';
import { Archive, Edit3, Plus, RotateCcw, Trash2 } from 'lucide-react';
import type { Course, StudySession } from '../types';

type CourseForm = {
  name: string;
};

type CourseManagementPanelProps = {
  courses: Course[];
  sessions: StudySession[];
  courseForm: CourseForm;
  editingCourseId: string | null;
  editingCourseName: string;
  onCourseFormChange: (form: CourseForm) => void;
  onEditingCourseIdChange: (courseId: string | null) => void;
  onEditingCourseNameChange: (name: string) => void;
  onAddCourse: (event: FormEvent<HTMLFormElement>) => void;
  onRenameCourse: (event: FormEvent<HTMLFormElement>) => void;
  onArchiveCourse: (courseId: string, archived: boolean) => void;
  onRemoveCourse: (course: Course) => void;
};

export function CourseManagementPanel({
  courses,
  sessions,
  courseForm,
  editingCourseId,
  editingCourseName,
  onCourseFormChange,
  onEditingCourseIdChange,
  onEditingCourseNameChange,
  onAddCourse,
  onRenameCourse,
  onArchiveCourse,
  onRemoveCourse,
}: CourseManagementPanelProps) {
  return (
    <section className="panel" id="courses">
      <div className="section-head">
        <div>
          <p className="eyebrow">Course Management</p>
          <h2>Courses</h2>
        </div>
      </div>
      <form className="course-form" onSubmit={onAddCourse}>
        <input
          value={courseForm.name}
          onChange={(event) => onCourseFormChange({ name: event.target.value })}
          placeholder="Add a course"
        />
        <button className="icon-text-button" type="submit">
          <Plus size={18} />
          Add
        </button>
      </form>
      <div className="course-list">
        {courses.map((course) => {
          const recorded = sessions.filter((session) => session.courseId === course.id).length;
          const editing = editingCourseId === course.id;

          return (
            <div className="course-row" key={course.id}>
              {editing ? (
                <form className="rename-form" onSubmit={onRenameCourse}>
                  <input
                    value={editingCourseName}
                    onChange={(event) => onEditingCourseNameChange(event.target.value)}
                    autoFocus
                  />
                  <button type="submit">Save</button>
                  <button type="button" onClick={() => onEditingCourseIdChange(null)}>
                    Cancel
                  </button>
                </form>
              ) : (
                <>
                  <div>
                    <strong>{course.name}</strong>
                    <span>
                      {course.archived ? 'Archived' : 'Active'} / {recorded} sessions
                    </span>
                  </div>
                  <div className="row-actions">
                    <button
                      className="icon-button"
                      title="Rename course"
                      onClick={() => {
                        onEditingCourseIdChange(course.id);
                        onEditingCourseNameChange(course.name);
                      }}
                    >
                      <Edit3 size={17} />
                    </button>
                    {course.archived ? (
                      <button className="icon-button" title="Restore course" onClick={() => onArchiveCourse(course.id, false)}>
                        <RotateCcw size={17} />
                      </button>
                    ) : (
                      <button className="icon-button" title="Archive course" onClick={() => onArchiveCourse(course.id, true)}>
                        <Archive size={17} />
                      </button>
                    )}
                    <button className="icon-button danger-icon" title="Remove course" onClick={() => onRemoveCourse(course)}>
                      <Trash2 size={17} />
                    </button>
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
