import { BookOpen, Download } from 'lucide-react';

type TopbarProps = {
  onExport: () => void;
};

export function Topbar({ onExport }: TopbarProps) {
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
      <button className="ghost-button" onClick={onExport}>
        <Download size={18} />
        Export
      </button>
    </header>
  );
}
