import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, formatUsd } from '../lib/api';

export function SuccessPage() {
  const [params] = useSearchParams();
  const checkoutId = params.get('checkout') || '';
  const sessionId = params.get('session_id') || '';
  const [status, setStatus] = useState<'loading' | 'ok' | 'error'>('loading');
  const [locked, setLocked] = useState(false);
  const [amount, setAmount] = useState(0);
  const [hadAccount, setHadAccount] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    async function run() {
      try {
        if (checkoutId && sessionId) {
          await api.confirmCheckout(checkoutId, sessionId);
        }
        if (checkoutId) {
          const s = await api.checkoutStatus(checkoutId);
          setLocked(s.locked);
          setAmount(s.amountCents);
          setHadAccount(s.hadAccount);
          setStatus(s.status === 'completed' ? 'ok' : 'error');
          if (s.status !== 'completed') {
            setMessage(
              s.status === 'conflict'
                ? 'Payment recorded but pixels were already taken — contact support.'
                : `Checkout status: ${s.status}`
            );
          }
        } else {
          setStatus('ok');
        }
      } catch (err) {
        setStatus('error');
        setMessage((err as Error).message);
      }
    }
    run();
  }, [checkoutId, sessionId]);

  return (
    <div className="page-narrow success-page">
      {status === 'loading' && <p>Confirming purchase…</p>}
      {status === 'error' && (
        <>
          <h1>Something went wrong</h1>
          <p>{message || 'We could not confirm this checkout.'}</p>
          <Link className="btn primary" to="/buy">
            Back to board
          </Link>
        </>
      )}
      {status === 'ok' && (
        <>
          <h1>You&apos;re on the board</h1>
          {amount > 0 && <p className="lead">Paid {formatUsd(amount)}.</p>}
          {locked || !hadAccount ? (
            <div className="auth-banner warn">
              <strong>Guest checkout locks creative after buy (no later edits).</strong>
              <p>
                Your image, link, and title are permanent for this purchase. Next time,{' '}
                <Link to="/auth">sign in before buying</Link> so you can manage pixels after
                purchase and add more under one account.
              </p>
            </div>
          ) : (
            <div className="auth-banner ok">
              <strong>Account purchase — editable anytime.</strong>
              <p>
                Update creatives or buy more from your <Link to="/dashboard">dashboard</Link>.
              </p>
            </div>
          )}
          <div className="hero-ctas">
            <Link className="btn primary" to="/buy">
              View board
            </Link>
            <Link className="btn ghost" to="/dashboard">
              Dashboard
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
