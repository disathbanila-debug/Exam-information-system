import { useState } from 'react';
import { api } from '../../api.js';
import PaperDetailModal from '../../components/PaperDetail.jsx';
import { DueTag, EmptyState, ErrorBox, Field, FormModal, Loader, PageHeader, StageBadge, Tabs } from '../../components/ui.jsx';
import { fmtDate, fmtDateTime, nowLocalInput, paperTitle, todayISO } from '../../utils/format.js';
import { useApi } from '../../utils/useApi.js';

function ReceiveModal({ paper, onClose }) {
  const [count, setCount] = useState('');
  return (
    <FormModal
      title="Record answer scripts received"
      submitLabel="Save and notify lecturer"
      onClose={onClose}
      onSubmit={async () => (await api(`/ar/papers/${paper.paper_id}/scripts-received`, { method: 'POST', body: { no_of_scripts: count } })).message}
    >
      <p className="muted">
        {paperTitle(paper)} · exam held {fmtDate(paper.exam_date)}. {paper.lecturer_name} will be notified to collect the scripts.
      </p>
      <Field label="Number of answer scripts">
        <input type="number" min={1} value={count} onChange={(e) => setCount(e.target.value)} required autoFocus />
      </Field>
    </FormModal>
  );
}

function CollectModal({ paper, onClose }) {
  const [name, setName] = useState(paper.lecturer_name || '');
  const [at, setAt] = useState(nowLocalInput());
  return (
    <FormModal
      title="Record script collection"
      submitLabel="Record collection"
      onClose={onClose}
      onSubmit={async () =>
        (await api(`/ar/papers/${paper.paper_id}/collection`, { method: 'POST', body: { collected_by_name: name, collected_at: at } })).message
      }
    >
      <p className="muted">
        {paperTitle(paper)} · {paper.no_of_scripts} scripts. The lecturer must return them within 3 months.
      </p>
      <div className="form-grid">
        <Field label="Collected by" hint="Name of the person who took the scripts">
          <input value={name} onChange={(e) => setName(e.target.value)} required />
        </Field>
        <Field label="Date and time">
          <input type="datetime-local" value={at} onChange={(e) => setAt(e.target.value)} required />
        </Field>
      </div>
    </FormModal>
  );
}

function ReturnModal({ paper, onClose }) {
  const [date, setDate] = useState(todayISO());
  return (
    <FormModal
      title="Record return of marked scripts"
      submitLabel="Record return"
      onClose={onClose}
      onSubmit={async () => (await api(`/ar/papers/${paper.paper_id}/return`, { method: 'POST', body: { returned_at: date } })).message}
    >
      <p className="muted">
        {paperTitle(paper)} · collected {fmtDateTime(paper.collected_at)} by {paper.collected_by_name}.
      </p>
      {!paper.latest_version && <div className="warn-box">The lecturer has not uploaded the marking report (detail marksheet) yet.</div>}
      <Field label="Returned on">
        <input type="date" value={date} max={todayISO()} onChange={(e) => setDate(e.target.value)} required />
      </Field>
    </FormModal>
  );
}

const FILTERS = {
  receive: { label: 'To record', test: (p) => p.stage === 'SCHEDULED' && p.exam_held },
  collect: { label: 'Awaiting collection', test: (p) => p.stage === 'AT_AR_OFFICE' },
  with: { label: 'With lecturers', test: (p) => p.stage === 'WITH_LECTURER' },
  returned: { label: 'Returned', test: (p) => !!p.returned_at },
  upcoming: { label: 'Upcoming exams', test: (p) => p.stage === 'SCHEDULED' && !p.exam_held },
};

export default function ArScripts() {
  const { data, loading, error, reload } = useApi('/ar/papers');
  const [tab, setTab] = useState('receive');
  const [modal, setModal] = useState(null);
  const [view, setView] = useState(null);

  if (loading && !data) return <Loader />;
  if (error && !data) return <ErrorBox message={error} onRetry={reload} />;

  const papers = data.papers.filter(FILTERS[tab].test);
  const close = (saved) => {
    setModal(null);
    if (saved) reload();
  };

  return (
    <>
      <PageHeader title="Answer scripts" subtitle="Record scripts received after each exam, who collected them, and when they came back" />
      <Tabs
        active={tab}
        onChange={setTab}
        tabs={Object.entries(FILTERS).map(([key, f]) => ({ key, label: f.label, count: data.papers.filter(f.test).length }))}
      />
      <div className="card">
        {papers.length ? (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Subject</th>
                  <th>Exam date</th>
                  <th>Lecturer</th>
                  <th>Scripts</th>
                  <th>Collection</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {papers.map((p) => (
                  <tr key={p.paper_id} className={p.lecturer_overdue ? 'row-danger' : ''}>
                    <td>
                      <strong>{p.subject_code}</strong>
                      <div className="muted small">{p.subject_name}</div>
                    </td>
                    <td>{fmtDate(p.exam_date)}</td>
                    <td>{p.lecturer_name || <span className="muted">Not assigned</span>}</td>
                    <td>{p.no_of_scripts ?? '—'}</td>
                    <td className="small">
                      {p.collected_at ? (
                        <>
                          {p.collected_by_name}, {fmtDateTime(p.collected_at)}
                          <div>
                            {p.returned_at ? `Returned ${fmtDate(p.returned_at)}` : `Due ${fmtDate(p.collection_due_date)}`}{' '}
                            <DueTag days={p.lecturer_days_left} done={!!p.returned_at} />
                          </div>
                        </>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                    <td>
                      <StageBadge paper={p} />
                    </td>
                    <td className="right nowrap">
                      <button className="btn btn-sm btn-ghost" onClick={() => setView(p.paper_id)}>
                        View
                      </button>
                      {tab === 'receive' && (
                        <button className="btn btn-sm btn-primary" onClick={() => setModal({ type: 'receive', paper: p })}>
                          Scripts received
                        </button>
                      )}
                      {tab === 'collect' && (
                        <button className="btn btn-sm btn-primary" onClick={() => setModal({ type: 'collect', paper: p })}>
                          Record collection
                        </button>
                      )}
                      {tab === 'with' && (
                        <button className="btn btn-sm btn-primary" onClick={() => setModal({ type: 'return', paper: p })}>
                          Record return
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title="Nothing in this list" />
        )}
      </div>
      {modal?.type === 'receive' && <ReceiveModal paper={modal.paper} onClose={close} />}
      {modal?.type === 'collect' && <CollectModal paper={modal.paper} onClose={close} />}
      {modal?.type === 'return' && <ReturnModal paper={modal.paper} onClose={close} />}
      {view && <PaperDetailModal paperId={view} onClose={() => setView(null)} />}
    </>
  );
}
