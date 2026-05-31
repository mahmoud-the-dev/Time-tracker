export function Topbar() {
  return (
    <header className="topbar">
      <div className="brand">
        <div className="brand-mark">
          <img className="brand-logo" src="/logo.png" alt="" aria-hidden="true" />
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
