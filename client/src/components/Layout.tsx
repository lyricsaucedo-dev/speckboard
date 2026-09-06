import { useEffect, useId, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { COMPACT_NAV_MQ, useMediaQuery } from '../lib/useMediaQuery';

function InstagramIcon({ size = 18 }: { size?: number }) {
  return (
    <svg
      className="nav-social-icon"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645.069 4.849.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
    </svg>
  );
}

export function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const { pathname } = useLocation();
  const isLanding = pathname === '/';
  const isBuy = pathname === '/buy';
  const layoutClass = isLanding ? 'layout-landing' : isBuy ? 'layout-buy' : '';
  const compactNav = useMediaQuery(COMPACT_NAV_MQ);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuId = useId();

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  useEffect(() => {
    if (!compactNav) setMenuOpen(false);
  }, [compactNav]);

  const navLinks = (
    <>
      {!isLanding && (
        <NavLink to="/" end onClick={() => setMenuOpen(false)}>
          Home
        </NavLink>
      )}
      <NavLink to="/buy" onClick={() => setMenuOpen(false)}>
        Buy
      </NavLink>
      <NavLink to="/dashboard" onClick={() => setMenuOpen(false)}>
        Dashboard
      </NavLink>
      <a
        className="nav-social"
        href="https://instagram.com/speckboard"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Instagram @speckboard"
        title="@speckboard"
      >
        <InstagramIcon />
        <span className="sr-only">@speckboard</span>
      </a>
      {user ? (
        <>
          <span className="nav-user">{user.displayName || user.email}</span>
          <button
            type="button"
            className="btn ghost compact"
            onClick={() => {
              setMenuOpen(false);
              logout();
            }}
          >
            Sign out
          </button>
        </>
      ) : (
        <NavLink to="/auth" className="btn primary compact" onClick={() => setMenuOpen(false)}>
          Sign in
        </NavLink>
      )}
    </>
  );

  return (
    <div className={`app-shell ${layoutClass}`.trim()}>
      <header className="site-header">
        <Link to="/" className="brand-lockup" aria-label="Speckboard home">
          <img
            src="/brand/speckboard-pfp.svg"
            alt=""
            className="brand-mark"
            width={40}
            height={40}
          />
          <span className="brand-name">SPECKBOARD</span>
        </Link>

        {compactNav ? (
          <div className="nav-compact">
            <a
              className="nav-social nav-compact-ig"
              href="https://instagram.com/speckboard"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Instagram @speckboard"
            >
              <InstagramIcon size={20} />
            </a>
            <button
              type="button"
              className={`nav-menu-btn${menuOpen ? ' is-open' : ''}`}
              aria-expanded={menuOpen}
              aria-controls={menuId}
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              onClick={() => setMenuOpen((o) => !o)}
            >
              <span className="nav-menu-bars" aria-hidden />
            </button>
          </div>
        ) : (
          <nav className="nav-links">{navLinks}</nav>
        )}
      </header>

      {compactNav && menuOpen && (
        <>
          <button
            type="button"
            className="nav-drawer-backdrop"
            aria-label="Close menu"
            onClick={() => setMenuOpen(false)}
          />
          <nav id={menuId} className="nav-drawer" aria-label="Site">
            {navLinks}
          </nav>
        </>
      )}

      <main>{children}</main>
      {!isLanding && !isBuy && (
        <footer className="site-footer">
          <div className="footer-brand">
            <img
              src="/brand/speckboard-pfp.svg"
              alt=""
              width={40}
              height={40}
              className="brand-mark"
            />
            <div>
              <strong>Speckboard</strong>
              <p>$0.25 per pixel · 100,000 pixels · $25,000 capacity</p>
            </div>
          </div>
          <div className="footer-links">
            <a
              className="footer-social"
              href="https://instagram.com/speckboard"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Instagram @speckboard"
            >
              <InstagramIcon size={16} />
              @speckboard
            </a>
            <Link to="/legal/terms">Terms</Link>
            <Link to="/legal/privacy">Privacy</Link>
            <Link to="/legal/aup">Acceptable Use</Link>
            <Link to="/legal/dmca">DMCA</Link>
          </div>
          <p className="footer-note">
            Ads are user-submitted. Speckboard does not endorse advertised products or services.
            Outbound links unlock at $5 (20 pixels).
          </p>
        </footer>
      )}
    </div>
  );
}
