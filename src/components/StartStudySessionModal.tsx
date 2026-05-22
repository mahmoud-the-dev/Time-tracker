import type { KeyboardEvent } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { CornerDownLeft, Play, Search } from 'lucide-react';
import type { Course } from '../types';
import { Modal } from './Modal';

type StartStudySessionModalProps = {
  courses: Course[];
  onClose: () => void;
  onStart: (courseId: string) => void;
};

export function StartStudySessionModal({ courses, onClose, onStart }: StartStudySessionModalProps) {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const activeCourses = useMemo(() => courses.filter((course) => !course.archived), [courses]);
  const filteredCourses = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    if (!normalizedQuery) return activeCourses;
    return activeCourses.filter((course) => course.name.toLocaleLowerCase().includes(normalizedQuery));
  }, [activeCourses, query]);

  const activeCourse = filteredCourses[activeIndex] || null;

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  useEffect(() => {
    if (activeIndex >= filteredCourses.length) {
      setActiveIndex(Math.max(0, filteredCourses.length - 1));
    }
  }, [activeIndex, filteredCourses.length]);

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      if (activeCourse) onStart(activeCourse.id);
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (!filteredCourses.length) return;
      setActiveIndex((current) => Math.min(current + 1, filteredCourses.length - 1));
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (!filteredCourses.length) return;
      setActiveIndex((current) => Math.max(current - 1, 0));
    }
  }

  return (
    <Modal title="Start Study Session" onClose={onClose}>
      <div className="subject-search">
        <Search size={18} aria-hidden="true" />
        <input
          ref={inputRef}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Filter subjects"
          aria-label="Filter subjects"
        />
      </div>

      <div ref={listRef} className="picker-list subject-picker-list" role="listbox" aria-label="Subjects">
        {filteredCourses.length ? (
          filteredCourses.map((course, index) => {
            const isActive = index === activeIndex;
            return (
              <button
                className={`picker-option subject-picker-option${isActive ? ' active' : ''}`}
                key={course.id}
                type="button"
                role="option"
                aria-selected={isActive}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => onStart(course.id)}
              >
                <span>{course.name}</span>
                {isActive && (
                  <span className="enter-hint" aria-label="Press Enter to start">
                    <CornerDownLeft size={16} />
                  </span>
                )}
              </button>
            );
          })
        ) : (
          <div className="picker-empty">No matching subjects.</div>
        )}
      </div>

      <div className="modal-actions">
        <button onClick={onClose}>Cancel</button>
        <button className="primary-action compact" disabled={!activeCourse} onClick={() => activeCourse && onStart(activeCourse.id)}>
          <Play size={17} />
          Start
        </button>
      </div>
    </Modal>
  );
}
