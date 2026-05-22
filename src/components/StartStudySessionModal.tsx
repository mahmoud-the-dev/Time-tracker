import type { KeyboardEvent } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { CornerDownLeft, Play, Plus, Search } from 'lucide-react';
import type { Course } from '../types';
import { Modal } from './Modal';

type StartStudySessionModalProps = {
  courses: Course[];
  onClose: () => void;
  onAddCourse: (name: string) => void;
  onStart: (courseId: string) => void;
};

type PickerOption = { type: 'course'; course: Course } | { type: 'add'; name: string };

export function StartStudySessionModal({ courses, onAddCourse, onClose, onStart }: StartStudySessionModalProps) {
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
  const addCourseName = query.trim();
  const shouldShowAddCourse = Boolean(
    addCourseName && !courses.some((course) => course.name.toLocaleLowerCase() === addCourseName.toLocaleLowerCase()),
  );
  const pickerOptions = useMemo<PickerOption[]>(() => {
    const options: PickerOption[] = filteredCourses.map((course) => ({ type: 'course', course }));
    if (shouldShowAddCourse) options.push({ type: 'add', name: addCourseName });
    return options;
  }, [addCourseName, filteredCourses, shouldShowAddCourse]);

  const activeOption = pickerOptions[activeIndex] || null;

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  useEffect(() => {
    if (activeIndex >= pickerOptions.length) {
      setActiveIndex(Math.max(0, pickerOptions.length - 1));
    }
  }, [activeIndex, pickerOptions.length]);

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  function chooseOption(option: PickerOption | null): void {
    if (!option) return;
    if (option.type === 'add') {
      onAddCourse(option.name);
    } else {
      onStart(option.course.id);
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      chooseOption(activeOption);
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (!pickerOptions.length) return;
      setActiveIndex((current) => Math.min(current + 1, pickerOptions.length - 1));
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (!pickerOptions.length) return;
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
        {pickerOptions.length ? (
          pickerOptions.map((option, index) => {
            const isActive = index === activeIndex;
            const isAddOption = option.type === 'add';
            return (
              <button
                className={`picker-option subject-picker-option${isAddOption ? ' add-option' : ''}${isActive ? ' active' : ''}`}
                key={isAddOption ? `add-${option.name}` : option.course.id}
                type="button"
                role="option"
                aria-selected={isActive}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => chooseOption(option)}
              >
                <span>{isAddOption ? `Add "${option.name}"` : option.course.name}</span>
                {isActive && (
                  <span className="enter-hint" aria-label={isAddOption ? 'Press Enter to add course' : 'Press Enter to start'}>
                    {isAddOption ? <Plus size={16} /> : <CornerDownLeft size={16} />}
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
        <button className="primary-action compact" disabled={!activeOption} onClick={() => chooseOption(activeOption)}>
          {activeOption?.type === 'add' ? <Plus size={17} /> : <Play size={17} />}
          {activeOption?.type === 'add' ? 'Add Course' : 'Start'}
        </button>
      </div>
    </Modal>
  );
}
