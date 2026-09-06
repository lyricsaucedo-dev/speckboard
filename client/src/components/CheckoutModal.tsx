import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { LINK_MIN_PIXELS, formatUsd, type Region } from '../lib/api';
import { useAuth } from '../lib/auth';
import { PIXEL_SHAPES, type PixelShape } from '../lib/shapes';

type Props = {
  open: boolean;
  onClose: () => void;
  regions: Region[];
  pixels: number;
  priceCents: number;
  shape: PixelShape;
  onShapeChange: (s: PixelShape) => void;
  /** Prefill from Image → pixels (data URL or https). */
  initialImageUrl?: string;
  onSubmit: (data: {
    title: string;
    linkUrl: string;
    imageUrl: string;
    shape: string;
    acceptedTos: boolean;
  }) => Promise<void>;
};

export function CheckoutModal({
  open,
  onClose,
  regions,
  pixels,
  priceCents,
  shape,
  onShapeChange,
  initialImageUrl = '',
  onSubmit,
}: Props) {
  const { user, config } = useAuth();
  const [title, setTitle] = useState('');
  const [linkUrl, setLinkUrl] = useState('https://');
  const [imageUrl, setImageUrl] = useState('');
  const [acceptedTos, setAcceptedTos] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const linksUnlocked = pixels >= LINK_MIN_PIXELS;
  const imageIsDataUrl = imageUrl.startsWith('data:');

  useEffect(() => {
    if (!open) {
      setError('');
      setBusy(false);
      return;
    }
    setImageUrl(initialImageUrl || '');
  }, [open, initialImageUrl]);

  useEffect(() => {
    if (!linksUnlocked) setLinkUrl('');
    else if (!linkUrl) setLinkUrl('https://');
  }, [linksUnlocked]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!open) return null;

  const locked = !user;

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="checkout-title">
      <div className="modal-card">
        <div className="modal-head">
          <h2 id="checkout-title">Claim your pixels</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <div className={`auth-banner ${locked ? 'warn' : 'ok'}`}>
          {locked ? (
            <>
              <strong>Guest checkout locks creative after buy (no later edits).</strong>
              <p>
                Sign in to manage your pixels after purchase.{' '}
                <Link to="/auth">Create an account</Link> before paying if you want to edit later.
              </p>
            </>
          ) : (
            <>
              <strong>Signed in — your purchase stays editable.</strong>
              <p>You can update image, link, shape, and title anytime from the dashboard.</p>
            </>
          )}
        </div>

        <dl className="checkout-stats">
          <div>
            <dt>Regions</dt>
            <dd>{regions.length}</dd>
          </div>
          <div>
            <dt>Pixels</dt>
            <dd>{pixels.toLocaleString()}</dd>
          </div>
          <div>
            <dt>Total</dt>
            <dd>{formatUsd(priceCents)}</dd>
          </div>
        </dl>
        <p className="field-hint" style={{ marginTop: '-0.5rem' }}>
          {pixels} × $0.25 = {formatUsd(priceCents)}
          {regions[0] ? ` · first region ${regions[0].width}×${regions[0].height}` : ''}
        </p>

        <form
          className="checkout-form"
          onSubmit={async (e) => {
            e.preventDefault();
            setError('');
            setBusy(true);
            try {
              await onSubmit({
                title,
                linkUrl: linksUnlocked ? linkUrl : '',
                imageUrl,
                shape,
                acceptedTos,
              });
            } catch (err) {
              setError((err as Error).message);
              setBusy(false);
            }
          }}
        >
          <label>
            Title
            <input
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Your brand or message"
              maxLength={80}
            />
          </label>

          <fieldset className="shape-fieldset">
            <legend>Pixel shape</legend>
            <p className="field-hint">
              One silhouette for your whole block (not each cell). Purchased cells stay rectangular.
            </p>
            <div className="shape-grid">
              {PIXEL_SHAPES.map((s) => (
                <button
                  key={s}
                  type="button"
                  className={`shape-btn ${shape === s ? 'active' : ''}`}
                  onClick={() => onShapeChange(s)}
                >
                  {s}
                </button>
              ))}
            </div>
          </fieldset>

          <label>
            Destination link
            <input
              required={linksUnlocked}
              type={linksUnlocked ? 'url' : 'text'}
              value={linksUnlocked ? linkUrl : ''}
              onChange={(e) => setLinkUrl(e.target.value)}
              placeholder={linksUnlocked ? 'https://yoursite.com' : ''}
              disabled={!linksUnlocked}
            />
            <span className="field-hint">
              {linksUnlocked
                ? 'Outbound link included with this purchase.'
                : 'Links unlock at $5 (20 pixels)'}
            </span>
          </label>
          <label>
            Image URL
            <input
              required
              type={imageIsDataUrl ? 'text' : 'url'}
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="https://…/your-ad.png"
            />
            <span className="field-hint">
              {imageIsDataUrl
                ? `Pixel art from converter · clipped to your ${shape}.`
                : `Image is clipped to your ${shape}.`}{' '}
              Finalize before payment
              {locked ? ' — guest purchases cannot be edited later' : ''}.
            </span>
          </label>
          {imageIsDataUrl && imageUrl && (
            <div className="checkout-image-preview">
              <img src={imageUrl} alt="Checkout creative preview" />
            </div>
          )}

          <label className="check-row">
            <input
              type="checkbox"
              checked={acceptedTos}
              onChange={(e) => setAcceptedTos(e.target.checked)}
              required
            />
            <span>
              I am 18+, I have rights to this creative, and I accept the{' '}
              <Link to="/legal/terms" target="_blank">
                Terms
              </Link>
              ,{' '}
              <Link to="/legal/aup" target="_blank">
                Acceptable Use
              </Link>
              , and purchase disclaimers.
            </span>
          </label>

          {error && <p className="form-error">{error}</p>}

          <button type="submit" className="btn primary wide" disabled={busy || !acceptedTos}>
            {busy
              ? 'Starting checkout…'
              : config?.demoCheckout
                ? `Demo purchase · ${formatUsd(priceCents)}`
                : `Pay with Stripe · ${formatUsd(priceCents)}`}
          </button>
        </form>
      </div>
    </div>
  );
}
