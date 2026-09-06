import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LINK_MIN_CENTS, api, formatUsd, regionPixels, type Region } from '../lib/api';
import { useAuth } from '../lib/auth';
import { PIXEL_SHAPES, normalizeShape, type PixelShape } from '../lib/shapes';

type MyAd = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  title: string;
  linkUrl: string;
  imageUrl: string;
  shape: string;
  locked: boolean;
  amountCents: number;
  createdAt: string;
  updatedAt: string;
};

type Draft = {
  id: string;
  title: string;
  regions: Region[];
  shape: string;
  imageDataUrl: string;
  status: string;
  createdAt: string;
  updatedAt: string;
};

export function DashboardPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [ads, setAds] = useState<MyAd[]>([]);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<MyAd | null>(null);
  const [title, setTitle] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [shape, setShape] = useState<PixelShape>('square');
  const [msg, setMsg] = useState('');

  async function load() {
    try {
      const [adsRes, draftsRes] = await Promise.all([api.myAds(), api.listDrafts()]);
      setAds(adsRes.ads);
      setDrafts(draftsRes.drafts);
      setError('');
    } catch (err) {
      setError((err as Error).message);
    }
  }

  useEffect(() => {
    if (user) load();
  }, [user]);

  if (loading) return <div className="page-narrow">Loading…</div>;

  if (!user) {
    return (
      <div className="page-narrow">
        <h1>Dashboard</h1>
        <p className="lead">
          Sign in to manage your pixels after purchase. Guest checkout locks creative after buy (no
          later edits).
        </p>
        <Link className="btn primary" to="/auth">
          Sign in
        </Link>
      </div>
    );
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setMsg('');
    try {
      const linkAllowed = editing.amountCents >= LINK_MIN_CENTS;
      await api.updateAd(editing.id, {
        title,
        linkUrl: linkAllowed ? linkUrl : '',
        imageUrl,
        shape,
      });
      setEditing(null);
      setMsg('Updated.');
      await load();
    } catch (err) {
      setMsg((err as Error).message);
    }
  }

  async function removeDraft(id: string) {
    try {
      await api.deleteDraft(id);
      setMsg('Draft deleted.');
      await load();
    } catch (err) {
      setMsg((err as Error).message);
    }
  }

  return (
    <div className="page-wide dashboard">
      <header className="dash-head">
        <div>
          <h1>Your pixels</h1>
          <p>
            Signed in as {user.email}. Buy more from the{' '}
            <Link to="/buy">board</Link> — new purchases attach to this account and stay editable.
          </p>
        </div>
        <Link className="btn primary" to="/buy">
          Buy more pixels
        </Link>
      </header>

      {error && <p className="form-error">{error}</p>}
      {msg && <p className="flash ok">{msg}</p>}

      <section className="dash-section">
        <h2 className="dash-section-title">Drafts</h2>
        <p className="lead" style={{ marginTop: 0 }}>
          Personal only — drafts never reserve board cells until you checkout.
        </p>
        {!drafts.length ? (
          <div className="empty-card compact">
            <p>No drafts yet. Select an area on the board, paint it, then Save draft.</p>
            <Link className="btn ghost compact" to="/buy">
              Open buy board
            </Link>
          </div>
        ) : (
          <div className="ad-grid">
            {drafts.map((d) => {
              const px = regionPixels(d.regions);
              const r = d.regions[0];
              return (
                <article key={d.id} className="ad-card draft-card">
                  <div className="ad-thumb">
                    <img src={d.imageDataUrl} alt={d.title} />
                  </div>
                  <div className="ad-body">
                    <h2>{d.title || 'Untitled draft'}</h2>
                    <p>
                      {r
                        ? `(${r.x},${r.y}) · ${r.width}×${r.height}`
                        : `${d.regions.length} region(s)`}{' '}
                      = {px} px · {normalizeShape(d.shape)}
                    </p>
                    <p className="field-hint" style={{ margin: 0 }}>
                      Updated {new Date(d.updatedAt).toLocaleString()}
                    </p>
                    <div className="draft-actions">
                      <button
                        type="button"
                        className="btn primary compact"
                        onClick={() => navigate(`/buy?draft=${d.id}`)}
                      >
                        Load
                      </button>
                      <button
                        type="button"
                        className="btn ghost compact"
                        onClick={() => void removeDraft(d.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="dash-section">
        <h2 className="dash-section-title">Purchased pixels</h2>
        {!ads.length ? (
          <div className="empty-card">
            <p>No account-linked pixels yet.</p>
            <Link className="btn primary" to="/buy">
              Claim pixels on the board
            </Link>
          </div>
        ) : (
          <div className="ad-grid">
            {ads.map((ad) => (
              <article key={ad.id} className="ad-card">
                <div className="ad-thumb">
                  <img src={ad.imageUrl} alt={ad.title} />
                </div>
                <div className="ad-body">
                  <h2>{ad.title}</h2>
                  <p>
                    ({ad.x},{ad.y}) · {ad.width}×{ad.height} = {ad.width * ad.height} px ·{' '}
                    {formatUsd(ad.amountCents)} · {normalizeShape(ad.shape)}
                  </p>
                  {ad.linkUrl ? (
                    <a href={ad.linkUrl} target="_blank" rel="noreferrer">
                      {ad.linkUrl}
                    </a>
                  ) : (
                    <p className="lead">No outbound link — unlocks at $5 (20 pixels)</p>
                  )}
                  {ad.locked ? (
                    <p className="locked-note">Locked guest purchase — cannot edit.</p>
                  ) : (
                    <button
                      type="button"
                      className="btn ghost compact"
                      onClick={() => {
                        setEditing(ad);
                        setTitle(ad.title);
                        setLinkUrl(ad.linkUrl);
                        setImageUrl(ad.imageUrl);
                        setShape(normalizeShape(ad.shape));
                      }}
                    >
                      Edit creative
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {editing && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <div className="modal-head">
              <h2>Edit pixel block</h2>
              <button type="button" className="icon-btn" onClick={() => setEditing(null)}>
                ×
              </button>
            </div>
            <form className="checkout-form" onSubmit={save}>
              <label>
                Title
                <input value={title} onChange={(e) => setTitle(e.target.value)} required />
              </label>
              <fieldset className="shape-fieldset">
                <legend>Pixel shape</legend>
                <div className="shape-grid">
                  {PIXEL_SHAPES.map((s) => (
                    <button
                      key={s}
                      type="button"
                      className={`shape-btn ${shape === s ? 'active' : ''}`}
                      onClick={() => setShape(s)}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </fieldset>
              <label>
                Link
                <input
                  type={editing.amountCents >= LINK_MIN_CENTS ? 'url' : 'text'}
                  value={editing.amountCents >= LINK_MIN_CENTS ? linkUrl : ''}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  required={editing.amountCents >= LINK_MIN_CENTS}
                  disabled={editing.amountCents < LINK_MIN_CENTS}
                />
                {editing.amountCents < LINK_MIN_CENTS && (
                  <span className="field-hint">Links unlock at $5 (20 pixels)</span>
                )}
              </label>
              <label>
                Image URL
                <input
                  type="url"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  required
                />
              </label>
              <button className="btn primary wide" type="submit">
                Save changes
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
