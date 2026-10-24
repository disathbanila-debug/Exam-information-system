import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchPdfUrl } from '../api.js';
import { useToast } from '../context/ToastContext.jsx';
import { STAGE_TONE } from '../utils/stages.js';
import Icon from './Icon.jsx';

export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="page-header">
      <div>
        <h1>{title}</h1>
        {subtitle && <p className="muted">{subtitle}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </div>
  );
}

export function StatCard({ label, value, hint, tone = 'default', to }) {
  const body = (
    <>
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value}</span>
      {hint && <span className="stat-hint">{hint}</span>}
    </>
  );
  return to ? (
    <Link to={to} className={`stat-card tone-${tone} clickable`}>
      {body}
    </Link>
  ) : (
    <div className={`stat-card tone-${tone}`}>{body}</div>
  );
}

export function Loader({ text = 'Loading…' }) {
  return (
    <div className="loader">
      <span className="spinner" /> {text}
    </div>
  );
}

export function ErrorBox({ message, onRetry }) {
  return (
    <div className="error-box">
      <span>{message}</span>
      {onRetry && (
        <button className="btn btn-sm" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}

export function EmptyState({ title, text }) {
  return (
    <div className="empty">
      <Icon name="inbox" size={28} />
      <strong>{title}</strong>
      {text && <span className="muted">{text}</span>}
    </div>
  );
}

export function StageBadge({ paper }) {
  return <span className={`badge tone-${STAGE_TONE[paper.stage] || 'gray'}`}>{paper.stage_label}</span>;
}

export function ProgressBar({ step, total }) {
  return (
    <div className="progress" title={`Step ${step} of ${total}`}>
      <div className="progress-fill" style={{ width: `${Math.round((step / total) * 100)}%` }} />
    </div>
  );
}

export function Modal({ title, onClose, children, footer, wide }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${wide ? 'modal-wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <Icon name="x" />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

/**
 * A modal containing a form. `onSubmit` may be async; errors are shown as toasts
 * and success closes the modal.
 */
export function FormModal({ title, submitLabel = 'Save', onSubmit, onClose, children, wide, danger }) {
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  async function handle(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const msg = await onSubmit();
      if (msg) toast.success(msg);
      onClose(true);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={title} onClose={() => onClose(false)} wide={wide}>
      <form onSubmit={handle} className="form">
        {children}
        <div className="form-actions">
          <button type="button" className="btn btn-ghost" onClick={() => onClose(false)}>
            Cancel
          </button>
          <button type="submit" className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`} disabled={busy}>
            {busy ? 'Saving…' : submitLabel}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export function Field({ label, hint, children, full }) {
  return (
    <label className={`field ${full ? 'field-full' : ''}`}>
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  );
}

/** Shows an uploaded PDF in a viewer inside the app (works even where pop-ups are blocked). */
export function PdfButton({ file, children = 'View PDF', small = true }) {
  const toast = useToast();
  const [url, setUrl] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => () => url && URL.revokeObjectURL(url), [url]);

  if (!file) return <span className="muted">—</span>;

  async function open() {
    setBusy(true);
    try {
      setUrl(await fetchPdfUrl(file));
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button type="button" className={`btn btn-outline ${small ? 'btn-sm' : ''}`} onClick={open} disabled={busy}>
        <Icon name="file" size={14} /> {busy ? 'Opening…' : children}
      </button>
      {url && (
        <Modal
          title={typeof children === 'string' ? children : 'Document'}
          onClose={() => setUrl(null)}
          wide
          footer={
            <a className="btn btn-primary" href={url} download={file}>
              Download PDF
            </a>
          }
        >
          <iframe className="pdf-frame" src={url} title={file} />
        </Modal>
      )}
    </>
  );
}

export function Tabs({ tabs, active, onChange }) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map((t) => (
        <button
          key={t.key}
          role="tab"
          aria-selected={active === t.key}
          className={`tab ${active === t.key ? 'active' : ''}`}
          onClick={() => onChange(t.key)}
        >
          {t.label}
          {t.count !== undefined && <span className="tab-count">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function DueTag({ days, done }) {
  if (done || days === null || days === undefined) return null;
  const tone = days < 0 ? 'red' : days <= 14 ? 'orange' : 'gray';
  const text = days < 0 ? `${-days} days overdue` : days === 0 ? 'Due today' : `${days} days left`;
  return <span className={`badge tone-${tone}`}>{text}</span>;
}
