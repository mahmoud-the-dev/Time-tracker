import { BookOpen } from 'lucide-react';

export function Topbar() {
  return (
    <header className="topbar">
      <div className="brand">
        <div className="brand-mark">
          <BookOpen size={24} />
        </div>
        <div className="brand-text">
          <strong className="brand-title">Study Clock</strong>
          <span className="brand-subtitle">Course time tracker</span>
        </div>
      </div>
      <nav className="nav-links">
        <a href="#timer">Timer</a>
        <a href="#dashboard">Dashboard</a>
        <a href="#courses">Courses</a>
      </nav>
    </header>
  );
}
