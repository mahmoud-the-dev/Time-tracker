import type { RefObject } from 'react';
import { BookOpen, Download, Upload } from 'lucide-react';

type TopbarProps = {
  importInputRef: RefObject<HTMLInputElement | null>;
  onExport: () => void;
  onImportFile: (file: File) => void;
};

export function Topbar({ importInputRef, onExport, onImportFile }: TopbarProps) {
  return (
    <header className="topbar">
      <div className="brand">
        <div className="brand-mark">
          <BookOpen size={24} />
        </div>
        <div>
          <strong>Study Clock</strong>
          <span>Course time tracker</span>
        </div>
      </div>
      <nav className="nav-links">
        <a href="#timer">Timer</a>
        <a href="#dashboard">Dashboard</a>
        <a href="#courses">Courses</a>
      </nav>
      <div className="topbar-actions">
        <input
          ref={importInputRef}
          className="file-input"
          type="file"
          accept="application/json,.json"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) onImportFile(file);
          }}
        />
        <button className="ghost-button" onClick={() => importInputRef.current?.click()}>
          <Upload size={18} />
          Import
        </button>
        <button className="ghost-button" onClick={onExport}>
          <Download size={18} />
          Export
        </button>
      </div>
    </header>
  );
}
