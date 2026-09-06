import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { PixelBoard } from '../components/PixelBoard';
import { api, type BoardAd } from '../lib/api';
import { useAuth } from '../lib/auth';

const TOTAL_PIXELS = 100_000;

export function HomePage() {
  const { config } = useAuth();
  const [ads, setAds] = useState<BoardAd[]>([]);

  const loadBoard = useCallback(async () => {
    try {
      const board = await api.board();
      setAds(board.ads);
    } catch {
      /* empty board ok */
    }
  }, []);

  useEffect(() => {
    loadBoard();
    const t = setInterval(loadBoard, 20000);
    return () => clearInterval(t);
  }, [loadBoard]);

  const gw = config?.gridWidth ?? 500;
  const gh = config?.gridHeight ?? 200;

  const claimed = useMemo(
    () => ads.reduce((sum, ad) => sum + ad.width * ad.height, 0),
    [ads]
  );
  const claimedPct = Math.min(100, (claimed / TOTAL_PIXELS) * 100);
  const recent = useMemo(() => [...ads].slice(-6).reverse(), [ads]);

  return (
    <div className="landing">
      <section className="landing-hero" aria-label="Speckboard live board">
        <div className="landing-board-bg">
          <PixelBoard
            ads={ads}
            gridWidth={gw}
            gridHeight={gh}
            interactMode="view"
            letterbox
            onAdClick={(ad) => window.open(ad.linkUrl, '_blank', 'noopener,noreferrer')}
          />
        </div>
        <div className="landing-veil" aria-hidden />

        <div className="scarcity-chip" aria-live="polite">
          <span>
            {claimed.toLocaleString()} / {TOTAL_PIXELS.toLocaleString()} claimed
          </span>
          <span className="scarcity-bar" aria-hidden>
            <span style={{ width: `${Math.max(2, claimedPct)}%` }} />
          </span>
        </div>

        <div className="landing-copy">
          <p className="hero-eyebrow">
            <img src="/brand/speckboard-pfp.svg" alt="" width={28} height={28} className="brand-mark" />
            Own a speck of the internet
          </p>
          <h1 className="hero-brand">SPECKBOARD</h1>
          <p className="hero-tag">Leave your speck.</p>
          <p className="hero-hook">$1 = 4 pixels · Creators, brands, or just for fun.</p>
          <Link to="/buy" className="btn primary hero-cta">
            Claim your speck
          </Link>
        </div>
      </section>

      <section className="landing-chapter" id="how">
        <h2>How it works</h2>
        <p className="chapter-lead">Put your link on the internet’s billboard.</p>
        <ol className="how-steps">
          <li>
            <strong>$1 = 4 pixels</strong>
            <span>Every cell is one pixel at $0.25. Mass-select your region on the board.</span>
          </li>
          <li>
            <strong>Paint your speck</strong>
            <span>Color cells or drop an image in the editor popup, then pick a shape mask.</span>
          </li>
          <li>
            <strong>Links from $5</strong>
            <span>Buy 20+ pixels and attach a clickable URL to your area.</span>
          </li>
          <li>
            <strong>Sign in to keep editing</strong>
            <span>Guest checkout locks creatives after purchase. Accounts can update later.</span>
          </li>
        </ol>
      </section>

      <section className="landing-chapter scarcity-chapter">
        <h2>The board is filling</h2>
        <p className="chapter-lead">
          {claimed.toLocaleString()} of {TOTAL_PIXELS.toLocaleString()} pixels claimed ·{' '}
          {(TOTAL_PIXELS - claimed).toLocaleString()} left
        </p>
        <div
          className="progress-track"
          role="progressbar"
          aria-valuenow={claimed}
          aria-valuemax={TOTAL_PIXELS}
        >
          <div className="progress-fill" style={{ width: `${Math.max(2, claimedPct)}%` }} />
        </div>
        {recent.length > 0 && (
          <div className="recent-specks">
            <h3>Recent specks</h3>
            <ul>
              {recent.map((ad) => (
                <li key={ad.id}>
                  <img src={ad.imageUrl} alt="" width={48} height={48} />
                  <span>{ad.title || 'Speck'}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        <Link to="/buy" className="btn primary">
          Buy pixels
        </Link>
      </section>

      <section className="landing-chapter trust-chapter">
        <p className="trust-line">
          Follow{' '}
          <a
            className="ig-cta"
            href="https://instagram.com/speckboard"
            target="_blank"
            rel="noopener noreferrer"
          >
            @speckboard
          </a>{' '}
          on Instagram · Ads are user-submitted. Speckboard does not endorse advertised products.{' '}
          <Link to="/legal/terms">Terms</Link> · <Link to="/legal/privacy">Privacy</Link> ·{' '}
          <Link to="/legal/aup">Acceptable Use</Link>
        </p>
      </section>
    </div>
  );
}
