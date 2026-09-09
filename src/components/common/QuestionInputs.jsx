/**
 * Respondent-side controls for the richer answer types: Rating Scale (in its
 * five styles), Ranking, Matrix/Grid and Media Upload.
 *
 * Each takes the question, the current answer string and an `onChange(value)`
 * that writes the answer back. Every answer is a *string*, because that is what
 * SurveyForm keeps in `answers[q.id]` and what the API's answer_text column
 * stores — the encodings are documented in utils/questionTypes.js.
 */

import { useEffect, useRef, useState } from 'react';
import { Star, Upload, FileText, X, GripVertical, Loader2 } from 'lucide-react';
import {
  parseLabelList, emojiForRating, ratingPointCount, barColorForRating,
  acceptAttribute, allowedFamilies, parseUploadAnswer,
  parseRankingAnswer, parseMatrixAnswer, matrixHas,
} from '../../utils/questionTypes';
import * as surveyService from '../../services/surveyService';
import useAuthStore from '../../store/useAuthStore';
import useNotificationStore from '../../store/useNotificationStore';

// ─────────────────────────────────────────────────────────────────────
// Rating Scale
// ─────────────────────────────────────────────────────────────────────

/**
 * Whatever the style, the stored answer is the 1-based position on the scale,
 * so a question's results stay comparable if its style is changed later and
 * existing scoring/reporting keeps working unchanged.
 */
export const RatingInput = ({ question: q, value, onChange }) => {
  const style = q.rating_style || 'number';
  const max = ratingPointCount(q);
  const words = parseLabelList(q.rating_labels);
  const selected = value ? parseInt(value, 10) : null;
  const points = Array.from({ length: max }, (_, i) => i + 1);

  // The end captions sit above the control in small caps, so a scale reads as
  // "NOT AT ALL LIKELY … EXTREMELY LIKELY" without competing with the points.
  const endLabelStyle = {
    fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.06em',
    textTransform: 'uppercase', color: 'var(--text-muted)',
  };
  const endLabelRow = (low, high) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
      <span style={endLabelStyle}>{low}</span>
      <span style={endLabelStyle}>{high}</span>
    </div>
  );
  // Styles that only show the captions when the admin actually set one.
  const endLabels = (q.low_label || q.high_label)
    ? endLabelRow(q.low_label || '', q.high_label || '')
    : null;

  // Star and emoji styles fill up to the hovered/selected point, so they need
  // to know what the pointer is over as well as what is committed.
  const [hover, setHover] = useState(null);
  const active = hover ?? selected;

  if (style === 'star' || style === 'emoji') {
    const isStar = style === 'star';
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {endLabels}
        <div
          style={{ display: 'flex', gap: isStar ? '6px' : '10px', flexWrap: 'wrap', alignItems: isStar ? 'center' : 'flex-start' }}
          onMouseLeave={() => setHover(null)}
        >
          {points.map((val) => {
            // Stars read as a filled bar up to the chosen point; emoji faces
            // each stand for their own point, so only the chosen one lights up.
            const on = isStar ? active != null && val <= active : selected === val;
            // Emoji points reuse the word captions, so a face can be labelled
            // "Poor … Very impressive" instead of standing on its own.
            const caption = isStar ? null : words[val - 1];
            return (
              <button
                key={val}
                type="button"
                aria-label={caption ? `${caption} (${val} of ${max})` : `${val} of ${max}`}
                aria-pressed={selected === val}
                onMouseEnter={() => setHover(val)}
                onFocus={() => setHover(val)}
                onClick={() => onChange(String(val))}
                style={{
                  border: `1.5px solid ${on && !isStar ? 'var(--accent-primary)' : 'transparent'}`,
                  background: on && !isStar ? 'rgba(var(--accent-primary-rgb), 0.08)' : 'none',
                  borderRadius: '12px',
                  padding: isStar ? '2px' : '10px 12px',
                  cursor: 'pointer', lineHeight: 1.35, transition: 'all 0.15s',
                  transform: on ? 'scale(1.06)' : 'scale(1)',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px',
                  // Emoji points share the row evenly so a five-point scale
                  // stays on one line instead of wrapping the last face.
                  flex: isStar ? '0 0 auto' : '1 1 0',
                  minWidth: isStar ? 0 : '62px',
                }}
              >
                {isStar
                  ? <Star size={38} fill={on ? '#f59e0b' : 'none'} color={on ? '#f59e0b' : '#cbd5e1'} />
                  : <span style={{ fontSize: '2.4rem' }}>{emojiForRating(val, max)}</span>}
                {caption && (
                  <span style={{
                    fontSize: '0.8rem', textAlign: 'center',
                    fontWeight: on ? 800 : 600,
                    color: on ? 'var(--accent-primary)' : 'var(--text-muted)',
                  }}>
                    {caption}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        {selected != null && (
          <span style={{ fontWeight: 800, color: 'var(--accent-primary)', fontSize: '1.05rem' }}>
            {selected} / {max}
          </span>
        )}
      </div>
    );
  }

  if (style === 'bar') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {endLabelRow(q.low_label || 'Low', q.high_label || 'High')}
        {/* A segmented colour bar running red at the low end to green at the
            high end. Before anything is chosen the whole gradient shows; once a
            point is picked the segments past it fade back so the choice reads. */}
        <div
          style={{
            display: 'flex', gap: '2px', padding: '5px',
            background: 'var(--bg-sidebar)', border: '1.5px solid var(--border)',
            borderRadius: '999px',
          }}
          onMouseLeave={() => setHover(null)}
        >
          {points.map((val, idx) => {
            const on = active != null && val <= active;
            const isFirst = idx === 0;
            const isLast = idx === points.length - 1;
            return (
              <button
                key={val}
                type="button"
                aria-label={`${val} of ${max}`}
                aria-pressed={selected === val}
                onMouseEnter={() => setHover(val)}
                onFocus={() => setHover(val)}
                onClick={() => onChange(String(val))}
                style={{
                  flex: 1, height: '34px', border: 'none', cursor: 'pointer',
                  background: barColorForRating(val, max),
                  opacity: active == null ? 0.9 : (on ? 1 : 0.18),
                  transition: 'opacity 0.15s',
                  borderTopLeftRadius: isFirst ? '999px' : 0,
                  borderBottomLeftRadius: isFirst ? '999px' : 0,
                  borderTopRightRadius: isLast ? '999px' : 0,
                  borderBottomRightRadius: isLast ? '999px' : 0,
                }}
              />
            );
          })}
        </div>
        <div style={{ textAlign: 'center', fontWeight: 800, fontSize: '1.15rem', color: selected == null ? 'var(--text-muted)' : 'var(--accent-primary)' }}>
          {selected == null ? 'Select a rating' : `${selected} / ${max}`}
        </div>
      </div>
    );
  }

  if (style === 'word') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {points.map((val) => {
          const on = selected === val;
          return (
            <label
              key={val}
              style={{
                display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer',
                padding: '14px 18px', borderRadius: '12px',
                background: on ? 'rgba(var(--accent-primary-rgb), 0.06)' : 'var(--bg-sidebar)',
                border: `2px solid ${on ? 'var(--accent-primary)' : 'var(--border)'}`,
                transition: 'all 0.2s', fontWeight: 600, fontSize: '1rem',
              }}
            >
              <input
                type="radio" name={`q-${q.id}`} value={val} checked={on}
                onChange={() => onChange(String(val))}
                style={{ width: '17px', height: '17px', accentColor: 'var(--accent-primary)', flexShrink: 0 }}
              />
              <span style={{ flexGrow: 1 }}>{words[val - 1] || `Option ${val}`}</span>
              <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)' }}>{val}</span>
            </label>
          );
        })}
      </div>
    );
  }

  // 'number' — one contiguous strip of numbered cells, so a long scale stays
  // compact instead of wrapping into rows of oversized tiles.
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      {endLabelRow(q.low_label || 'Low', q.high_label || 'High')}
      <div
        style={{
          display: 'flex', background: 'var(--bg-sidebar)',
          border: '1.5px solid var(--border)', borderRadius: '10px', overflow: 'hidden',
        }}
        onMouseLeave={() => setHover(null)}
      >
        {points.map((val, idx) => {
          const on = selected === val;
          const hot = hover === val && !on;
          return (
            <label
              key={val}
              onMouseEnter={() => setHover(val)}
              style={{
                flex: 1, minWidth: '38px', cursor: 'pointer',
                borderLeft: idx === 0 ? 'none' : '1px solid var(--border)',
              }}
            >
              <input
                type="radio" name={`q-${q.id}`} value={val} checked={on}
                onChange={(e) => onChange(e.target.value)}
                style={{ display: 'none' }}
              />
              <div style={{
                height: '46px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 700, fontSize: '1rem', transition: 'all 0.15s',
                background: on
                  ? 'var(--accent-primary)'
                  : (hot ? 'rgba(var(--accent-primary-rgb), 0.08)' : 'transparent'),
                color: on ? '#fff' : 'var(--text-main)',
              }}>
                {val}
              </div>
            </label>
          );
        })}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────
// Ranking
// ─────────────────────────────────────────────────────────────────────

/**
 * Drag the items into preference order, 1st at the top. Up/down buttons do the
 * same job for keyboard and touch users, since HTML5 drag events don't fire on
 * most touch devices.
 */
export const RankingInput = ({ question: q, value, onChange }) => {
  const optionTexts = (q.options || [])
    .slice()
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map((o) => o.option_text);

  const order = parseRankingAnswer(value, optionTexts);
  const [dragIndex, setDragIndex] = useState(null);

  // The order shown is already a complete ranking, so commit it once on mount.
  // Without this an untouched Ranking question would read as unanswered and a
  // required one could never be passed without pointlessly reordering it.
  const seeded = useRef(false);
  useEffect(() => {
    if (!seeded.current && !value && optionTexts.length) {
      seeded.current = true;
      onChange(JSON.stringify(order));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, optionTexts.length]);

  const move = (from, to) => {
    if (to < 0 || to >= order.length || from === to) return;
    const next = [...order];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    onChange(JSON.stringify(next));
  };

  if (!optionTexts.length) {
    return <div style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>This ranking question has no items to order.</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '2px' }}>
        Drag to arrange from 1st preference (top) to {order.length}{order.length === 2 ? 'nd' : order.length === 3 ? 'rd' : 'th'} (bottom).
      </div>
      {order.map((text, idx) => (
        <div
          key={text}
          draggable
          onDragStart={() => setDragIndex(idx)}
          onDragEnd={() => setDragIndex(null)}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); if (dragIndex != null) move(dragIndex, idx); setDragIndex(null); }}
          style={{
            display: 'flex', alignItems: 'center', gap: '12px',
            padding: '14px 16px', borderRadius: '12px',
            background: dragIndex === idx ? 'rgba(var(--accent-primary-rgb), 0.08)' : 'var(--bg-sidebar)',
            border: `2px solid ${dragIndex === idx ? 'var(--accent-primary)' : 'var(--border)'}`,
            cursor: 'grab', transition: 'border-color 0.15s, background 0.15s',
            opacity: dragIndex != null && dragIndex !== idx ? 0.75 : 1,
          }}
        >
          <GripVertical size={18} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          <span style={{
            width: '30px', height: '30px', borderRadius: '50%', flexShrink: 0,
            background: 'var(--accent-primary)', color: 'white',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 800, fontSize: '0.85rem',
          }}>
            {idx + 1}
          </span>
          <span style={{ flexGrow: 1, fontWeight: 600, fontSize: '1rem' }}>{text}</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', flexShrink: 0 }}>
            <button
              type="button" aria-label={`Move ${text} up`} disabled={idx === 0}
              onClick={() => move(idx, idx - 1)}
              style={{ background: 'none', border: 'none', cursor: idx === 0 ? 'not-allowed' : 'pointer', opacity: idx === 0 ? 0.3 : 1, padding: '0 4px', fontSize: '0.8rem', color: 'var(--text-main)' }}
            >
              ▲
            </button>
            <button
              type="button" aria-label={`Move ${text} down`} disabled={idx === order.length - 1}
              onClick={() => move(idx, idx + 1)}
              style={{ background: 'none', border: 'none', cursor: idx === order.length - 1 ? 'not-allowed' : 'pointer', opacity: idx === order.length - 1 ? 0.3 : 1, padding: '0 4px', fontSize: '0.8rem', color: 'var(--text-main)' }}
            >
              ▼
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────
// Matrix / Grid
// ─────────────────────────────────────────────────────────────────────

/**
 * Rows are statements, columns the shared choices. `matrix_multi` decides
 * whether each row takes one answer (radio grid) or many (checkbox grid).
 */
export const MatrixInput = ({ question: q, value, onChange }) => {
  const rows = parseLabelList(q.matrix_rows);
  const columns = parseLabelList(q.matrix_columns);
  const answer = parseMatrixAnswer(value);
  const multi = !!q.matrix_multi;

  if (!rows.length || !columns.length) {
    return <div style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>This grid question has no rows or columns configured.</div>;
  }

  const toggle = (row, column) => {
    const next = { ...answer };
    if (multi) {
      const cell = Array.isArray(next[row]) ? next[row] : (next[row] ? [next[row]] : []);
      next[row] = cell.includes(column) ? cell.filter((c) => c !== column) : [...cell, column];
      if (!next[row].length) delete next[row];
    } else {
      // Clicking the selected cell again clears the row, so a non-required
      // row can be un-answered without reloading the survey.
      if (next[row] === column) delete next[row];
      else next[row] = column;
    }
    onChange(JSON.stringify(next));
  };

  return (
    <div style={{ overflowX: 'auto' }}>
      {/* The statement column takes the room the choice columns don't need, and
          each choice column is only as wide as its caption needs to wrap into,
          so a five-point scale fits the card instead of scrolling out of it.
          Scales too wide even for that still scroll rather than squash. */}
      <table style={{
        width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed',
        minWidth: `${150 + columns.length * 74}px`,
      }}>
        <thead>
          <tr>
            {/* The statement column takes a fixed share and the choice columns
                split the rest evenly, so the scale spreads across the grid
                instead of bunching up on the right of a wide empty column. */}
            <th style={{ width: '30%', textAlign: 'left', padding: '10px 12px', fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }} />
            {columns.map((col) => (
              <th key={col} style={{
                width: `${70 / columns.length}%`,
                padding: '10px 6px', fontSize: '0.76rem', fontWeight: 600,
                color: 'var(--text-muted)', textAlign: 'center',
                lineHeight: 1.25, overflowWrap: 'break-word', hyphens: 'auto',
              }}>
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rIdx) => {
            const rowAnswered = answer[row] !== undefined;
            return (
              <tr key={row} style={{ background: rIdx % 2 === 0 ? 'rgba(148, 163, 184, 0.09)' : 'transparent' }}>
                <td style={{
                  padding: '12px', fontWeight: 500, fontSize: '0.92rem',
                  borderLeft: `3px solid ${rowAnswered ? 'var(--accent-primary)' : 'transparent'}`,
                  // Fixed layout would otherwise let a long statement spill
                  // over the choice columns instead of wrapping.
                  overflowWrap: 'break-word', lineHeight: 1.35,
                }}>
                  {row}
                </td>
                {columns.map((col) => {
                  const on = matrixHas(answer, row, col);
                  return (
                    <td key={col} style={{ padding: '12px 8px', textAlign: 'center' }}>
                      <input
                        type={multi ? 'checkbox' : 'radio'}
                        name={multi ? undefined : `q-${q.id}-row-${rIdx}`}
                        checked={on}
                        onChange={() => toggle(row, col)}
                        // A radio can't be un-checked by re-selecting it, so the
                        // clear-the-row path above needs the click directly.
                        onClick={multi ? undefined : () => { if (on) toggle(row, col); }}
                        aria-label={`${row}: ${col}`}
                        style={{ width: '19px', height: '19px', accentColor: 'var(--accent-primary)', cursor: 'pointer' }}
                      />
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────
// Media Upload
// ─────────────────────────────────────────────────────────────────────

const prettySize = (bytes) => {
  if (!bytes && bytes !== 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

/**
 * Uploads the chosen file immediately and stores { url, filename, size } as
 * the answer. The size/type rules shown here are the admin's configuration,
 * but the upload endpoint enforces them independently — this is only to fail
 * fast and explain why before a large file is sent.
 */
export const FileUploadInput = ({ question: q, value, onChange, disabled = false }) => {
  const { token } = useAuthStore();
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef(null);
  const uploaded = parseUploadAnswer(value);
  const limitMb = q.max_file_size_mb ?? 10;
  const families = allowedFamilies(q);

  const handleFile = async (file) => {
    if (!file) return;
    const { showError, showSuccess } = useNotificationStore.getState();

    if (file.size > limitMb * 1024 * 1024) {
      showError(`"${file.name}" is ${prettySize(file.size)} — the limit for this question is ${limitMb}MB.`);
      return;
    }

    setUploading(true);
    try {
      const result = await surveyService.uploadAnswerFile(token, q.id, file);
      onChange(JSON.stringify({ url: result.url, filename: result.filename || file.name, size: result.size ?? file.size }));
      showSuccess('File attached.');
    } catch (err) {
      showError(err.message || 'Upload failed');
    } finally {
      setUploading(false);
      // Clear the picker so re-choosing the same file still fires onChange.
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  if (uploaded) {
    const isImage = /\.(jpe?g|png|gif|webp|bmp|svg|heic)$/i.test(uploaded.url);
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: '14px', padding: '16px',
        borderRadius: '12px', background: 'var(--bg-sidebar)', border: '2px solid #10b981',
      }}>
        {isImage
          ? <img src={uploaded.url} alt={uploaded.filename} style={{ width: '56px', height: '56px', objectFit: 'cover', borderRadius: '8px', flexShrink: 0 }} />
          : <FileText size={30} style={{ color: '#10b981', flexShrink: 0 }} />}
        <div style={{ minWidth: 0, flexGrow: 1 }}>
          <a
            href={uploaded.url} target="_blank" rel="noreferrer"
            className="truncate"
            style={{ display: 'block', fontWeight: 700, color: 'var(--text-main)', textDecoration: 'none' }}
          >
            {uploaded.filename}
          </a>
          <div style={{ fontSize: '0.78rem', color: '#10b981', fontWeight: 600 }}>
            Attached{uploaded.size ? ` · ${prettySize(uploaded.size)}` : ''}
          </div>
        </div>
        {!disabled && (
          <button
            type="button"
            onClick={() => onChange('')}
            title="Remove this file"
            style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', display: 'flex', flexShrink: 0 }}
          >
            <X size={20} />
          </button>
        )}
      </div>
    );
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept={acceptAttribute(q)}
        disabled={disabled || uploading}
        onChange={(e) => handleFile(e.target.files?.[0])}
        style={{ display: 'none' }}
        id={`upload-${q.id}`}
      />
      <label
        htmlFor={`upload-${q.id}`}
        style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          gap: '10px', padding: '2rem 1rem', borderRadius: '14px',
          border: '2px dashed var(--border)', background: 'var(--bg-sidebar)',
          cursor: uploading ? 'wait' : 'pointer', textAlign: 'center',
        }}
      >
        {uploading
          ? <Loader2 size={30} className="spin" style={{ color: 'var(--accent-primary)' }} />
          : <Upload size={30} style={{ color: 'var(--accent-primary)' }} />}
        <span style={{ fontWeight: 700, fontSize: '1rem' }}>
          {uploading ? 'Uploading…' : 'Choose a file to upload'}
        </span>
        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>
          {families.join(', ')} · up to {limitMb}MB
        </span>
      </label>
    </div>
  );
};
