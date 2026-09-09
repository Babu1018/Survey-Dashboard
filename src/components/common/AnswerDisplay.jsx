/**
 * Renders a submitted answer for the people reviewing it.
 *
 * The richer answer types store structured JSON in answer_text (see
 * utils/questionTypes.js), which is unreadable shown raw — a matrix comes back
 * as `{"Pricing":"Good",...}` and an upload as `{"url":...}`. This turns each
 * of those back into something a Manager can actually read, and falls through
 * to the plain text for every other type.
 */

import { FileText, ExternalLink } from 'lucide-react';
import {
  parseLabelList, parseUploadAnswer, parseMatrixAnswer,
} from '../../utils/questionTypes';

const empty = <span style={{ color: 'var(--text-muted)' }}>No answer given</span>;

const prettySize = (bytes) => {
  if (!bytes && bytes !== 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const AnswerDisplay = ({ answer }) => {
  const raw = answer?.answer_text;
  const type = answer?.question_type;

  if (raw === null || raw === undefined || raw === '' || raw === '[]' || raw === '{}') return empty;

  // ── Media Upload — a link to the stored file, with a thumbnail if it's an image.
  if (type === 'file_upload') {
    const file = parseUploadAnswer(raw);
    if (!file) return empty;
    const isImage = /\.(jpe?g|png|gif|webp|bmp|svg|heic)$/i.test(file.url);
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        {isImage
          ? <img src={file.url} alt={file.filename} style={{ width: '48px', height: '48px', objectFit: 'cover', borderRadius: '6px', flexShrink: 0 }} />
          : <FileText size={24} style={{ color: 'var(--accent-primary)', flexShrink: 0 }} />}
        <a
          href={file.url} target="_blank" rel="noreferrer"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontWeight: 700, color: 'var(--accent-primary)', wordBreak: 'break-all' }}
        >
          {file.filename || 'Attached file'}
          <ExternalLink size={13} style={{ flexShrink: 0 }} />
        </a>
        {file.size ? <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem', flexShrink: 0 }}>{prettySize(file.size)}</span> : null}
      </div>
    );
  }

  // ── Ranking — the respondent's order, best first.
  if (type === 'ranking') {
    let order = [];
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) order = parsed;
    } catch { /* falls through to the raw text below */ }
    if (!order.length) return <>{raw}</>;
    return (
      <ol style={{ margin: 0, paddingLeft: '1.2rem', display: 'flex', flexDirection: 'column', gap: '3px' }}>
        {order.map((item, idx) => (
          <li key={`${item}-${idx}`} style={{ fontWeight: idx === 0 ? 700 : 500 }}>{item}</li>
        ))}
      </ol>
    );
  }

  // ── Matrix / Grid — one "row: choice" line per answered row.
  if (type === 'matrix') {
    const picked = parseMatrixAnswer(raw);
    const rows = Object.keys(picked);
    if (!rows.length) return empty;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {rows.map((row) => {
          const cell = picked[row];
          return (
            <div key={row} style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 700 }}>{row}:</span>
              <span>{Array.isArray(cell) ? cell.join(', ') : cell}</span>
            </div>
          );
        })}
      </div>
    );
  }

  // ── Rating — a word scale is stored as its position, so show the caption too.
  if (type === 'rating') {
    const position = parseInt(raw, 10);
    const words = parseLabelList(answer.rating_labels);
    if (!Number.isNaN(position)) {
      const caption = (answer.rating_style === 'word' && words[position - 1]) || null;
      const max = answer.rating_max || words.length || null;
      return (
        <span style={{ fontWeight: 700 }}>
          {caption ? `${caption} ` : ''}
          <span style={{ color: caption ? 'var(--text-muted)' : 'inherit', fontWeight: caption ? 500 : 700 }}>
            ({position}{max ? ` of ${max}` : ''})
          </span>
        </span>
      );
    }
  }

  // ── Checkbox — stored as a JSON array of the chosen option texts.
  if (type === 'checkbox') {
    let chosen = null;
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) chosen = parsed.join(', ');
    } catch { /* not JSON — fall through to the raw text */ }
    if (chosen !== null) return <>{chosen}</>;
  }

  return <>{raw}</>;
};

export default AnswerDisplay;
