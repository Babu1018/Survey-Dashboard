import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import useSurveyStore from '../store/useSurveyStore';
import useAuthStore from '../store/useAuthStore';
import { 
  Plus,
  Eye, 
  Save,
  Trash2,
  Mic,
  ClipboardList,
  Play,
  X,
  Upload,
  Loader2,
  Image as ImageIcon,
  Edit3,
  ListOrdered,
  Copy,
  Flag,
  Languages,
  Sparkles,
  UserCheck,
  FileDown,
  ChevronDown,
  GitBranch,
  GripVertical,
  MoreVertical,
  ArrowLeft
} from 'lucide-react';
import React from 'react';
import useNotificationStore from '../store/useNotificationStore';
import * as XLSX from 'xlsx';
import { INDIC_LANGUAGES, translateSurvey } from '../utils/translater';
import { parseExcelSheet, downloadExcelTemplate, downloadManualExcelTemplate } from '../utils/excelTemplate';
import { computeQuestionLabels } from '../utils/questionLabels';
import { parseParentRef, formatParentRef, parseScoreRules } from '../utils/surveyRouting';
import { parseMediaItems, stringifyMediaItems } from '../utils/mediaItems';
import { validateSurvey, draftToDbShape } from '../utils/surveyValidation';
import ValidationReportModal from '../components/common/ValidationReportModal';
import SurveyForm from './SurveyForm';
import * as surveyService from '../services/surveyService';
import {
  parseLabelList, serializeLabelList,
  RATING_STYLES, WORD_SCALE_PRESETS, FILE_TYPE_FAMILIES,
} from '../utils/questionTypes';

// ─── Question card spacing / sizing scale ────────────────────────────
// The card is built from these so vertical rhythm and control heights stay
// consistent instead of drifting field by field.
const SECTION_GAP = '0.875rem';  // between major sections (question / answer / options)
const ROW_GAP = '0.75rem';       // between rows inside one section
const CTRL_H = '36px';           // primary control height
const CTRL_H_SM = '32px';        // dense control height, inside option cards
const RADIUS = '8px';

// One label style for every field label in the card. These previously drifted
// between 0.75rem and 0.62rem, and 0.04em and 0.05em letter-spacing.
const cardLabel = {
  fontSize: '0.68rem',
  fontWeight: 700,
  color: 'var(--text-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  display: 'block',
  marginBottom: '4px',
};

const reqMark = <span style={{ color: '#ef4444' }}>*</span>;

const detectMediaKind = (file) => {
  if (file.type.startsWith('image/')) return 'image';
  if (file.type.startsWith('audio/')) return 'audio';
  return null;
};

// Uploaded filenames carry a "<unix-timestamp>_" prefix (see Backend's
// upload endpoint) so two uploads of the same filename never collide on
// disk — strip that back off for display so the caption under each tile
// reads as the file the user actually picked, not a stray number.
const cleanFileName = (url) => (url.split('/').pop() || '').replace(/^\d+_/, '');

const MEDIA_TILE = '38px';

// Shared multi-file uploader for question- and choice-level attachments.
// Accepts any number of images and audio clips, uploads each independently
// (so one slow/failed file doesn't block the rest), and shows every
// in-flight upload as its own chip until it resolves to a thumbnail/icon.
const MultiMediaUpload = ({ items, onChange }) => {
  const [pending, setPending] = useState([]); // { key, name, status: 'uploading' | 'error' }
  const [isDragging, setIsDragging] = useState(false);
  const token = useAuthStore(state => state.token);
  const fileInputRef = useRef(null);
  // Uploads within one batch resolve one at a time via `await`, each calling
  // onChange with items appended onto whatever the parent holds *now* — a
  // stale `items` closure would make every completion after the first
  // clobber the ones before it instead of appending to them.
  const itemsRef = useRef(items);
  itemsRef.current = items;

  const uploadFiles = async (fileList) => {
    const { showError } = useNotificationStore.getState();
    for (const file of Array.from(fileList)) {
      const kind = detectMediaKind(file);
      if (!kind) {
        showError(`${file.name}: only images and audio can be attached.`);
        continue;
      }
      const key = `${Date.now()}-${Math.random()}`;
      setPending(prev => [...prev, { key, name: file.name, status: 'uploading' }]);
      const formData = new FormData();
      formData.append('file', file);
      try {
        const data = await surveyService.uploadMedia(token, formData);
        onChange([...(itemsRef.current || []), { url: data.url, type: kind }]);
      } catch (error) {
        console.error('Upload failed', error);
        setPending(prev => prev.map(p => p.key === key ? { ...p, status: 'error' } : p));
        continue;
      }
      setPending(prev => prev.filter(p => p.key !== key));
    }
  };

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer.files?.length) uploadFiles(e.dataTransfer.files);
      }}
      style={{
        display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'flex-start',
        width: 'fit-content', maxWidth: '100%', borderRadius: RADIUS, boxSizing: 'border-box',
        padding: '7px', transition: 'all 0.15s',
        border: isDragging ? '1.5px dashed var(--accent-primary)' : '1px solid var(--border)',
        background: isDragging ? 'rgba(76, 140, 228, 0.06)' : 'var(--bg-main)'
      }}
    >
      {(items || []).map((item, idx) => (
        <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', width: MEDIA_TILE, flexShrink: 0 }}>
          <div style={{ position: 'relative', width: MEDIA_TILE, height: MEDIA_TILE }}>
            {item.type === 'image' ? (
              <img
                src={item.url}
                alt=""
                style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '8px', border: '1px solid var(--border)', display: 'block' }}
              />
            ) : (
              <div style={{
                width: '100%', height: '100%', borderRadius: '8px',
                background: 'rgba(76, 140, 228, 0.1)', border: '1px solid var(--border)',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                <Mic size={15} style={{ color: 'var(--accent-primary)', flexShrink: 0 }} />
              </div>
            )}
            <button
              type="button"
              onClick={() => onChange(items.filter((_, i) => i !== idx))}
              title="Remove"
              style={{
                position: 'absolute', top: '-5px', right: '-5px', width: '14px', height: '14px',
                borderRadius: '50%', background: '#ef4444', color: 'white', border: '1.5px solid var(--bg-card)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0
              }}
            >
              <X size={8} strokeWidth={3} style={{ flexShrink: 0 }} />
            </button>
          </div>
          <span
            className="truncate"
            title={cleanFileName(item.url)}
            style={{ fontSize: '0.58rem', color: 'var(--text-muted)', width: '100%', textAlign: 'center' }}
          >
            {cleanFileName(item.url)}
          </span>
        </div>
      ))}

      {pending.map(p => (
        <div key={p.key} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', width: MEDIA_TILE, flexShrink: 0 }}>
          <div style={{
            position: 'relative', width: MEDIA_TILE, height: MEDIA_TILE, borderRadius: '8px',
            background: p.status === 'error' ? 'rgba(239, 68, 68, 0.08)' : 'var(--bg-hover)',
            border: `1px solid ${p.status === 'error' ? 'rgba(239, 68, 68, 0.3)' : 'var(--border)'}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            {p.status === 'error'
              ? <X size={14} style={{ color: '#ef4444', flexShrink: 0 }} />
              : <Loader2 className="spin" size={14} style={{ color: 'var(--accent-primary)', flexShrink: 0 }} />}
            {p.status === 'error' && (
              <button
                type="button"
                onClick={() => setPending(prev => prev.filter(x => x.key !== p.key))}
                title="Dismiss"
                style={{
                  position: 'absolute', top: '-5px', right: '-5px', width: '14px', height: '14px',
                  borderRadius: '50%', background: '#ef4444', color: 'white', border: '1.5px solid var(--bg-card)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0
                }}
              >
                <X size={8} strokeWidth={3} style={{ flexShrink: 0 }} />
              </button>
            )}
          </div>
          <span className="truncate" style={{ fontSize: '0.58rem', color: p.status === 'error' ? '#ef4444' : 'var(--text-muted)', width: '100%', textAlign: 'center' }}>
            {p.status === 'error' ? 'Failed' : 'Uploading'}
          </span>
        </div>
      ))}

      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*,audio/*"
        style={{ display: 'none' }}
        onChange={(e) => {
          if (e.target.files?.length) uploadFiles(e.target.files);
          e.target.value = null;
        }}
      />
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        title="Add images or audio"
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: MEDIA_TILE, height: MEDIA_TILE, borderRadius: '8px', flexShrink: 0,
          border: 'none', background: 'var(--accent-primary)',
          color: 'var(--bg-card)', cursor: 'pointer', transition: 'opacity 0.15s'
        }}
        onMouseEnter={e => { e.currentTarget.style.opacity = '0.8'; }}
        onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}
      >
        <Plus size={18} strokeWidth={2.5} style={{ flexShrink: 0 }} />
      </button>
    </div>
  );
};

const QuestionCard = React.memo(({
  q,
  i,
  label,
  questionLabels,
  total,
  questions,
  updateQuestion,
  updateQuestionMultiple,
  removeQuestion,
  duplicateQuestion,
  addOption,
  updateOption,
  updateOptionMultiple,
  removeOption,
  addFollowUpQuestion,
  openPreview
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen]);

  // Score-Based Routing state, shared between the three-dot menu (which owns
  // only the on/off toggle) and the editor panel at the bottom of this card.
  const isChoiceQuestion = q.question_type === 'radio' || q.question_type === 'checkbox';
  const scoreEnabled = q.score_threshold !== null && q.score_threshold !== undefined;
  const clusterMembers = (q.scale || '').split(',').filter(x => x !== '');
  const scoreRules = parseScoreRules(q);

  // Other questions whose own "Combine Scores From" cluster already pulls
  // this question's points in. Each question's Score Rules only ever look at
  // its own scale/score_rules, so a question can be feeding another's total
  // while its own panel here shows nothing selected and no rules — without a
  // flag for that, switching between the two looks like the setup went
  // missing rather than "this one's score already routes through Q2".
  const referencedByOthers = (questions || []).reduce((acc, otherQ, qIdx) => {
    if (qIdx === i) return acc;
    const otherMembers = (otherQ.scale || '').split(',').filter(x => x !== '');
    if (otherMembers.includes(String(i))) acc.push(qIdx);
    return acc;
  }, []);

  // Rules live in `score_rules` as JSON. The legacy
  // score_threshold/threshold_next_question pair is kept in sync with the
  // first rule so older readers (and the scoreEnabled gate above) keep
  // working unchanged.
  const writeScoreRules = (rules) => {
    const first = rules[0];
    updateQuestionMultiple(i, {
      score_rules: JSON.stringify(rules),
      score_threshold: first ? (first.min ?? 0) : 0,
      threshold_next_question: first ? first.target : null,
    });
  };

  return (
    <div className="panel" style={{ borderLeft: '6px solid var(--accent-primary)', padding: '1rem 1.25rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.875rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <div style={{
            minWidth: '28px',
            height: '28px',
            padding: '0 8px',
            borderRadius: '14px',
            background: 'var(--accent-primary)',
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 800,
            fontSize: '0.9rem'
          }}>{label ?? (i + 1)}</div>
          {!(Number(q.tier) > 1) && (
            <div style={{ fontWeight: 700, color: 'var(--accent-primary)', fontSize: '0.9rem' }}>NEW QUESTION</div>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div ref={menuRef} style={{ position: 'relative' }}>
            <button
              onClick={() => setMenuOpen(o => !o)}
              title="Question Options"
              style={{ padding: '8px', background: menuOpen ? 'rgba(99, 102, 241, 0.12)' : 'none', border: 'none', borderRadius: '6px', color: 'var(--accent-primary)', cursor: 'pointer', display: 'flex' }}
            >
              <MoreVertical size={18} />
            </button>
            {menuOpen && (
              <div style={{
                position: 'absolute',
                top: '100%',
                right: 0,
                marginTop: '6px',
                width: '400px',
                maxHeight: '520px',
                overflowY: 'auto',
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                borderRadius: '10px',
                boxShadow: '0 10px 28px rgba(0,0,0,0.18)',
                zIndex: 30,
                padding: '14px'
              }}>
                <div style={{ marginBottom: '14px', paddingBottom: '14px', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      Required <span style={{ color: '#ef4444' }}>*</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => updateQuestion(i, 'required', !q.required)}
                      role="switch"
                      aria-checked={!!q.required}
                      title="Require an answer to this question"
                      style={{
                        width: '38px', height: '20px', borderRadius: '999px', border: 'none', padding: '2px',
                        background: q.required ? 'var(--accent-primary)' : 'var(--border)', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: q.required ? 'flex-end' : 'flex-start',
                        transition: 'background 0.2s'
                      }}
                    >
                      <span style={{ width: '16px', height: '16px', borderRadius: '50%', background: 'white', boxShadow: '0 1px 3px rgba(0,0,0,0.3)', display: 'block' }} />
                    </button>
                  </div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '6px' }}>
                    Respondents must answer this question before they can continue.
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <GitBranch size={13} /> Backward Route
                  </div>
                  <select
                    value={q.backward_question === null || q.backward_question === undefined || q.backward_question === '' ? '' : q.backward_question}
                    onChange={e => updateQuestion(i, 'backward_question', e.target.value === '' ? null : parseInt(e.target.value))}
                    title="Once this question is answered, go straight to the selected question — whichever answer was given"
                    style={{ width: '100%', padding: '6px', fontSize: '0.75rem', background: 'var(--bg-main)', border: '1px solid var(--border)', borderRadius: '6px', fontWeight: 600, height: '32px' }}
                  >
                    <option value="">No jump</option>
                    {Array.from({ length: total }).map((_, targetIdx) => {
                       if (targetIdx === i) return null;
                       const targetQ = questions?.[targetIdx];
                       if (targetQ?._is_section || targetQ?.question_type === '_section') return null;
                       return <option key={targetIdx} value={targetIdx}>Go to Q{questionLabels?.[targetIdx] ?? (targetIdx + 1)}</option>;
                    })}
                  </select>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '6px' }}>
                    Fires once this question is answered, regardless of which answer was picked, and overrides this question's own Jump Route.
                    It only changes where the respondent goes next: once the target is answered the survey carries on with the questions
                    that were skipped over, and finishes only when nothing unanswered is left on their path.
                  </div>
                </div>

                {(q.question_type === 'radio' || q.question_type === 'checkbox') && (
                  <div style={{ marginTop: '14px', paddingTop: '14px', borderTop: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <ListOrdered size={13} /> Enable Score
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          if (scoreEnabled) {
                            updateQuestionMultiple(i, { score_threshold: null, threshold_next_question: null, score_rules: null, scale: '' });
                          } else {
                            updateQuestionMultiple(i, {
                              score_threshold: 0,
                              threshold_next_question: null,
                              score_rules: JSON.stringify([{ min: 1, target: null }]),
                              scale: String(i),
                            });
                          }
                        }}
                        role="switch"
                        aria-checked={scoreEnabled}
                        title="Score-Based Routing: give the options of this question points, and route to another question once a combined score clears a threshold"
                        style={{
                          width: '38px', height: '20px', borderRadius: '999px', border: 'none', padding: '2px',
                          background: scoreEnabled ? 'var(--accent-primary)' : 'var(--border)', cursor: 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: scoreEnabled ? 'flex-end' : 'flex-start',
                          transition: 'background 0.2s', flexShrink: 0,
                        }}
                      >
                        <span style={{ width: '16px', height: '16px', borderRadius: '50%', background: 'white', boxShadow: '0 1px 3px rgba(0,0,0,0.3)', display: 'block' }} />
                      </button>
                    </div>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '6px' }}>
                      Give each option a score in Choice Options, then set the routing rules in the
                      Score-Based Routing panel at the bottom of this question.
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
          <button
            onClick={() => duplicateQuestion(i)}
            title="Duplicate Question"
            style={{ padding: '8px', background: 'none', border: 'none', color: 'var(--accent-primary)', cursor: 'pointer' }}
          >
            <Copy size={18} />
          </button>
            <button
              onClick={() => removeQuestion(i)}
              style={{ padding: '8px', background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}
            >
              <Trash2 size={18} />
            </button>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: SECTION_GAP }}>
        <div style={{ display: 'grid', gridTemplateColumns: '6fr 4fr', gap: ROW_GAP, alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <label style={cardLabel}>QUESTION {reqMark}</label>
            <input 
              value={q.question_text} 
              onChange={e => updateQuestion(i, 'question_text', e.target.value)}
              placeholder="Enter your question here..."
              style={{ height: CTRL_H, width: '100%', borderRadius: RADIUS }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <label style={cardLabel}>MEDIA ATTACHMENTS</label>
            <MultiMediaUpload
              items={parseMediaItems(q)}
              onChange={(newItems) => updateQuestionMultiple(i, {
                media_items: stringifyMediaItems(newItems),
                media_type: newItems[0]?.type || 'none',
                media_url: newItems[0]?.url || '',
              })}
            />
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: ROW_GAP, borderTop: '1px solid var(--border)', paddingTop: SECTION_GAP }}>
          <div style={{ display: 'grid', gridTemplateColumns: '6fr 4fr', gap: ROW_GAP, alignItems: 'flex-start' }}>
            <div style={{ maxWidth: '340px' }}>
              <label style={cardLabel}>ANSWER TYPE {reqMark}</label>
              <select
                value={q.question_type}
                onChange={e => updateQuestion(i, 'question_type', e.target.value)}
                style={{ height: CTRL_H, padding: '0 12px', fontWeight: 600, borderRadius: RADIUS, width: '100%' }}
              >
                <option value="text">Short Text Answer</option>
                <option value="long_text">Paragraph Answer</option>
                <option value="number">Number Input</option>
                <option value="phone">Phone Number (10 digits)</option>
                <option value="radio">Single Choice (Radio Buttons)</option>
                <option value="checkbox">Multiple Choice (Checkboxes)</option>
                <option value="rating">Rating Scale</option>
                <option value="ranking">Ranking (Drag to Order)</option>
                <option value="matrix">Matrix / Grid</option>
                <option value="file_upload">Media Upload</option>
              </select>
            </div>
            {(q.question_type === 'radio' || q.question_type === 'checkbox' || q.question_type === 'select' || q.question_type === 'ranking') && (
              <div>
                <label style={cardLabel}>Choice Options</label>
                <button
                  onClick={() => addOption(i)}
                  style={{
                    fontSize: '0.8rem',
                    height: CTRL_H,
                    padding: '0 14px',
                    border: '1px solid var(--accent-primary)',
                    background: 'rgba(76, 140, 228, 0.1)',
                    color: 'var(--accent-primary)',
                    borderRadius: RADIUS,
                    fontWeight: 700,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = 'var(--accent-primary)';
                    e.currentTarget.style.color = 'white';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = 'rgba(76, 140, 228, 0.1)';
                    e.currentTarget.style.color = 'var(--accent-primary)';
                  }}
                >
                  <Plus size={15} /> Add Option
                </button>
              </div>
            )}
           </div>

          <div style={{ width: '100%' }}>
            {q.question_type === 'rating' && (() => {
              const style = q.rating_style || 'number';
              const isWord = style === 'word';
              // The emoji style labels each face with the same caption list the
              // word scale uses, so both offer the captions editor. A word scale
              // is *defined* by its captions; for emoji they are optional.
              const isEmoji = style === 'emoji';
              const words = parseLabelList(q.rating_labels);
              return (
                <div style={{ background: 'var(--bg-main)', padding: '1.25rem', borderRadius: '10px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block' }}>RATING SETTINGS</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 2fr 2fr', gap: '10px' }}>
                    <div>
                      <label style={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--text-muted)' }}>Rating Style</label>
                      <select
                        value={style}
                        onChange={e => updateQuestion(i, 'rating_style', e.target.value)}
                        style={{ height: CTRL_H_SM, fontSize: '0.8rem', width: '100%', padding: '0 8px' }}
                      >
                        {RATING_STYLES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                        {isWord ? 'Points' : 'Max (e.g. 10)'}
                      </label>
                      <input
                        type="number"
                        value={isWord ? (words.length || 0) : (q.rating_max || 5)}
                        disabled={isWord}
                        title={isWord ? 'Set by the number of word captions below' : undefined}
                        onChange={e => updateQuestion(i, 'rating_max', parseInt(e.target.value))}
                        style={{ height: CTRL_H_SM, fontSize: '0.8rem', opacity: isWord ? 0.6 : 1 }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--text-muted)' }}>Low Label (Optional)</label>
                      <input
                        value={q.low_label || ''}
                        onChange={e => updateQuestion(i, 'low_label', e.target.value)}
                        placeholder="e.g. Disagree"
                        style={{ height: CTRL_H_SM, fontSize: '0.8rem' }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--text-muted)' }}>High Label (Optional)</label>
                      <input
                        value={q.high_label || ''}
                        onChange={e => updateQuestion(i, 'high_label', e.target.value)}
                        placeholder="e.g. Agree"
                        style={{ height: CTRL_H_SM, fontSize: '0.8rem' }}
                      />
                    </div>
                  </div>

                  {(isWord || isEmoji) && (
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
                        <label style={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                          {isWord
                            ? 'Word Captions (one per line, lowest first)'
                            : 'Face Captions (optional, one per line, lowest first)'}
                        </label>
                        {Object.entries(WORD_SCALE_PRESETS).map(([key, preset]) => (
                          <button
                            key={key}
                            type="button"
                            onClick={() => updateQuestionMultiple(i, {
                              rating_labels: JSON.stringify(preset),
                              rating_max: preset.length,
                            })}
                            style={{
                              fontSize: '0.65rem', fontWeight: 700, padding: '2px 8px', borderRadius: '6px',
                              border: '1px solid var(--accent-primary)', background: 'rgba(76, 140, 228, 0.1)',
                              color: 'var(--accent-primary)', cursor: 'pointer',
                            }}
                          >
                            Use {preset[0]}…{preset[preset.length - 1]}
                          </button>
                        ))}
                      </div>
                      <textarea
                        value={words.join('\n')}
                        onChange={e => {
                          const labels = serializeLabelList(e.target.value);
                          // A word scale's point count *is* its caption count, so
                          // the two move together. Emoji captions are optional
                          // decoration, so they leave the admin's Max alone.
                          updateQuestionMultiple(i, isWord
                            ? { rating_labels: labels, rating_max: parseLabelList(labels).length }
                            : { rating_labels: labels });
                        }}
                        rows={5}
                        placeholder={isWord
                          ? 'Very Bad\nBad\nAverage\nGood\nVery Good'
                          : 'Poor\nBelow average\nAverage\nGood\nVery impressive'}
                        style={{ fontSize: '0.8rem', padding: '8px', width: '100%', boxSizing: 'border-box' }}
                      />
                    </div>
                  )}
                </div>
              );
            })()}

            {q.question_type === 'matrix' && (() => {
              const rows = parseLabelList(q.matrix_rows);
              const cols = parseLabelList(q.matrix_columns);
              return (
                <div style={{ background: 'var(--bg-main)', padding: '1.25rem', borderRadius: '10px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>MATRIX / GRID SETTINGS</label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={!!q.matrix_multi}
                        onChange={e => updateQuestion(i, 'matrix_multi', e.target.checked)}
                        style={{ width: '15px', height: '15px', accentColor: 'var(--accent-primary)' }}
                      />
                      Allow multiple answers per row (checkbox grid)
                    </label>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div>
                      <label style={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                        Rows — statements ({rows.length}), one per line
                      </label>
                      <textarea
                        value={rows.join('\n')}
                        onChange={e => updateQuestion(i, 'matrix_rows', serializeLabelList(e.target.value))}
                        rows={5}
                        placeholder={'Product Quality\nCustomer Service\nSupport\nPricing'}
                        style={{ fontSize: '0.8rem', padding: '8px', width: '100%', boxSizing: 'border-box' }}
                      />
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <label style={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                          Columns — choices ({cols.length}), one per line
                        </label>
                        {Object.entries(WORD_SCALE_PRESETS).map(([key, preset]) => (
                          <button
                            key={key}
                            type="button"
                            onClick={() => updateQuestion(i, 'matrix_columns', JSON.stringify(preset))}
                            style={{
                              fontSize: '0.6rem', fontWeight: 700, padding: '2px 7px', borderRadius: '6px',
                              border: '1px solid var(--accent-primary)', background: 'rgba(76, 140, 228, 0.1)',
                              color: 'var(--accent-primary)', cursor: 'pointer',
                            }}
                          >
                            {preset[0]}…{preset[preset.length - 1]}
                          </button>
                        ))}
                      </div>
                      <textarea
                        value={cols.join('\n')}
                        onChange={e => updateQuestion(i, 'matrix_columns', serializeLabelList(e.target.value))}
                        rows={5}
                        placeholder={'Very Bad\nBad\nAverage\nGood\nVery Good'}
                        style={{ fontSize: '0.8rem', padding: '8px', width: '100%', boxSizing: 'border-box' }}
                      />
                    </div>
                  </div>
                  {rows.length > 0 && cols.length > 0 && (
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                      Respondents will answer {rows.length} row{rows.length === 1 ? '' : 's'} against {cols.length} choice{cols.length === 1 ? '' : 's'}
                      {q.matrix_multi ? ', picking any number per row.' : ', picking one per row.'}
                    </div>
                  )}
                </div>
              );
            })()}

            {q.question_type === 'file_upload' && (() => {
              // Empty config means "accept every family we know about", which
              // is what the backend falls back to as well.
              const selected = String(q.allowed_file_types || '').split(',').map(s => s.trim()).filter(Boolean);
              const toggleFamily = (value, on) => {
                const next = on ? [...new Set([...selected, value])] : selected.filter(v => v !== value);
                updateQuestion(i, 'allowed_file_types', next.join(','));
              };
              return (
                <div style={{ background: 'var(--bg-main)', padding: '1.25rem', borderRadius: '10px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block' }}>MEDIA UPLOAD SETTINGS</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '3fr 1fr', gap: '12px', alignItems: 'flex-start' }}>
                    <div>
                      <label style={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
                        Accepted File Types {selected.length === 0 && <span style={{ color: 'var(--text-muted)' }}>(none picked — all allowed)</span>}
                      </label>
                      <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
                        {FILE_TYPE_FAMILIES.map(f => (
                          <label key={f.value} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer' }}>
                            <input
                              type="checkbox"
                              checked={selected.includes(f.value)}
                              onChange={e => toggleFamily(f.value, e.target.checked)}
                              style={{ width: '15px', height: '15px', accentColor: 'var(--accent-primary)' }}
                            />
                            {f.label}
                          </label>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label style={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--text-muted)' }}>Max Size (MB)</label>
                      <input
                        type="number"
                        min={1}
                        value={q.max_file_size_mb ?? 10}
                        onChange={e => updateQuestion(i, 'max_file_size_mb', parseInt(e.target.value) || 1)}
                        style={{ height: CTRL_H_SM, fontSize: '0.8rem' }}
                      />
                    </div>
                  </div>
                </div>
              );
            })()}

            {(q.question_type === 'radio' || q.question_type === 'checkbox' || q.question_type === 'select' || q.question_type === 'ranking') && (
              <div>
                <div style={
                  (q.question_type === 'radio' || q.question_type === 'checkbox')
                    ? { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '8px' }
                    : { display: 'flex', flexDirection: 'column', gap: '8px' }
                }>
                  {q.options.map((opt, oIdx) => (
                    <div key={oIdx} style={{ display: 'flex', flexDirection: 'column', gap: '6px', background: 'var(--bg-main)', padding: '8px', borderRadius: '10px', border: '1px solid var(--border)', position: 'relative', minWidth: 0 }}>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <input
                          value={opt.option_text || ''}
                          onChange={e => updateOption(i, oIdx, 'option_text', e.target.value)}
                          placeholder={`Choice ${oIdx + 1} text...`}
                          style={{ flexGrow: 1, padding: '4px 10px', fontSize: '0.82rem', fontWeight: 600, height: CTRL_H_SM, borderRadius: RADIUS }}
                        />
                        {(q.question_type === 'radio' || q.question_type === 'checkbox') &&
                          q.score_threshold !== null && q.score_threshold !== undefined && (
                          <div
                            title="Points this option contributes to the question's score when selected"
                            style={{ width: '78px', flexShrink: 0, display: 'flex', alignItems: 'center', gap: '2px', background: 'var(--bg-card)', padding: '0 6px', borderRadius: '8px', border: '1px solid var(--border)', height: CTRL_H_SM }}
                          >
                            <input
                              type="number"
                              min="0"
                              value={opt.score ?? 0}
                              // Clamped at 0 — a negative option score would
                              // let one answer cancel out another's points,
                              // which the "at least N" rules can't express.
                              onChange={e => updateOption(i, oIdx, 'score', Math.max(0, parseInt(e.target.value) || 0))}
                              // padding:0 is load-bearing — the global `input`
                              // rule in index.css sets 0.65rem/0.85rem, which
                              // in a box this small squeezes the digit out of
                              // view entirely behind the number spinners.
                              style={{ width: '100%', minWidth: 0, border: 'none', background: 'transparent', fontSize: '0.85rem', fontWeight: 800, textAlign: 'center', outline: 'none', padding: 0, color: 'var(--accent-primary)' }}
                            />
                            <span style={{ fontSize: '0.6rem', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.03em' }}>pts</span>
                          </div>
                        )}
                        <button 
                          onClick={() => removeOption(i, oIdx)}
                          style={{ 
                            width: CTRL_H_SM,
                            height: CTRL_H_SM,
                            padding: 0,
                            background: 'rgba(239, 68, 68, 0.05)', 
                            color: '#ef4444', 
                            border: '1px solid rgba(239, 68, 68, 0.15)',
                            borderRadius: RADIUS,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'all 0.2s',
                            flexShrink: 0
                          }}
                          onMouseEnter={e => {
                            e.currentTarget.style.background = '#ef4444';
                            e.currentTarget.style.color = 'white';
                            e.currentTarget.style.borderColor = '#ef4444';
                          }}
                          onMouseLeave={e => {
                            e.currentTarget.style.background = 'rgba(239, 68, 68, 0.05)';
                            e.currentTarget.style.color = '#ef4444';
                            e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.15)';
                          }}
                          title="Remove Choice"
                        >
                          <X size={16} strokeWidth={2.5} />
                        </button>
                      </div>

                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'flex-end' }}>
                        {q.question_type !== 'select' && q.question_type !== 'ranking' && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: '1 1 140px', minWidth: '140px' }}>
                            <label style={{ ...cardLabel, marginBottom: 0 }}>Jump Route</label>
                            <select
                              value={opt.next_question === null || opt.next_question === undefined ? '' : opt.next_question}
                              onChange={e => updateOption(i, oIdx, 'next_question', e.target.value === '' ? null : parseInt(e.target.value))}
                              style={{ width: '100%', padding: '4px 8px', fontSize: '0.75rem', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: RADIUS, fontWeight: 600, height: CTRL_H_SM }}
                              title="Where picking this specific answer sends the respondent. Different answers can lead to different questions."
                            >
                              <option value="">Next Question</option>
                              <option value="-1">End of Survey</option>
                              {Array.from({ length: total }).map((_, targetIdx) => {
                                 const targetQ = questions?.[targetIdx];
                                 if (targetQ?._is_section || targetQ?.question_type === '_section') return null;
                                 return <option key={targetIdx} value={targetIdx}>Go to Q{questionLabels?.[targetIdx] ?? (targetIdx + 1)}</option>;
                              })}
                            </select>
                          </div>
                        )}
                        {q.question_type !== 'select' && q.question_type !== 'ranking' && (
                          <button
                            onClick={() => addFollowUpQuestion(i, oIdx)}
                            title="Add a question to the subsection this answer switches on. Every question in it is skipped when a different answer is picked."
                            style={{
                              flexShrink: 0,
                              padding: '0 10px',
                              fontSize: '0.7rem',
                              fontWeight: 700,
                              background: 'rgba(99, 102, 241, 0.05)',
                              color: 'var(--accent-primary)',
                              border: '1px solid var(--accent-primary)',
                              borderRadius: '8px',
                              height: CTRL_H_SM,
                              cursor: 'pointer',
                              whiteSpace: 'nowrap'
                            }}
                          >
                            + Sub Section
                          </button>
                        )}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: '0 0 auto' }}>
                          <label style={{ ...cardLabel, marginBottom: 0 }}>Media</label>
                          <MultiMediaUpload
                            items={parseMediaItems(opt)}
                            onChange={(newItems) => updateOptionMultiple(i, oIdx, {
                              media_items: stringifyMediaItems(newItems),
                              media_type: newItems[0]?.type || null,
                              media_url: newItems[0]?.url || '',
                            })}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

              </div>
            )}
          </div>
        </div>
      </div>

      {isChoiceQuestion && referencedByOthers.length > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '6px',
          marginTop: '1rem', padding: '0.6rem 0.875rem',
          background: 'rgba(99,102,241,0.08)',
          border: '1px solid var(--accent-primary)',
          borderRadius: '8px',
          fontSize: '0.7rem', fontWeight: 700, color: 'var(--accent-primary)',
        }}
        title="This question's option points are added into the listed question's own Score-Based Routing total — no separate rules are needed here for that to work."
        >
          <GitBranch size={13} style={{ flexShrink: 0 }} />
          <span>
            This question&rsquo;s score is combined into{' '}
            {referencedByOthers.map((qIdx, k) => (
              <span key={qIdx}>
                {k > 0 && (k === referencedByOthers.length - 1 ? ' and ' : ', ')}
                Q{questionLabels?.[qIdx] ?? (qIdx + 1)}
              </span>
            ))}
            &rsquo;s Score-Based Routing.
          </span>
        </div>
      )}

      {isChoiceQuestion && scoreEnabled && (
        <div style={{
          marginTop: '1rem', padding: '0.875rem 1rem',
          background: 'rgba(99,102,241,0.03)',
          border: '1px dashed var(--accent-primary)',
          borderRadius: '10px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
            <ListOrdered size={14} style={{ color: 'var(--accent-primary)' }} />
            <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--accent-primary)', letterSpacing: '0.03em' }}>
              SCORE-BASED ROUTING
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.4fr)', gap: '16px', alignItems: 'start' }}>
            <div>
              <label style={{ ...cardLabel, marginBottom: '4px' }}>COMBINE SCORES FROM</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', padding: '8px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '8px', minHeight: '38px' }}>
                {(() => {
                  // Grouped by section so it is clear which questions a cluster
                  // reaches across - a survey can score within one section or
                  // combine questions from several.
                  const groups = [];
                  let current = { label: null, items: [] };
                  (questions || []).forEach((otherQ, qIdx) => {
                    if (otherQ._is_section || otherQ.question_type === '_section') {
                      if (current.items.length) groups.push(current);
                      current = { label: otherQ.section_label || 'Untitled section', items: [] };
                      return;
                    }
                    if (otherQ.question_type !== 'radio' && otherQ.question_type !== 'checkbox') return;
                    current.items.push(qIdx);
                  });
                  if (current.items.length) groups.push(current);

                  if (!groups.length) {
                    return <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>No scoreable questions yet.</span>;
                  }

                  return groups.map((group, gIdx) => (
                    <div key={gIdx} style={{ width: '100%', display: 'flex', flexWrap: 'wrap', gap: '4px', alignItems: 'center' }}>
                      {group.label && (
                        <span style={{ width: '100%', fontSize: '0.6rem', fontWeight: 800, color: 'var(--text-muted)', letterSpacing: '0.05em', marginTop: gIdx ? '6px' : 0 }}>
                          {group.label.toUpperCase()}
                        </span>
                      )}
                      {group.items.map((qIdx) => {
                        const isSelected = clusterMembers.includes(String(qIdx));
                        const isSelf = qIdx === i;
                        return (
                          <button
                            key={qIdx}
                            type="button"
                            onClick={() => {
                              const next = isSelected
                                ? clusterMembers.filter(x => x !== String(qIdx))
                                : [...clusterMembers, String(qIdx)];
                              updateQuestion(i, 'scale', next.join(','));
                            }}
                            style={{
                              padding: '3px 9px', borderRadius: '6px', fontSize: '0.68rem', fontWeight: 700, cursor: 'pointer',
                              background: isSelected ? 'var(--accent-primary)' : 'var(--bg-main)',
                              color: isSelected ? 'white' : 'var(--text-muted)',
                              border: '1px solid ' + (isSelected ? 'var(--accent-primary)' : 'var(--border)'),
                            }}
                          >
                            Q{questionLabels?.[qIdx] ?? (qIdx + 1)}{isSelf ? ' (Self)' : ''}
                          </button>
                        );
                      })}
                    </div>
                  ));
                })()}
              </div>
              <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '6px', lineHeight: 1.5 }}>
                Pick the questions whose points add together. Select just this one to route on its own score.
              </div>
            </div>

            <div>
              <label style={{ ...cardLabel, marginBottom: '4px' }}>SCORE RULES</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {scoreRules.map((rule, rIdx) => (
                  <div key={rIdx} style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', flexShrink: 0 }}>If &ge;</span>
                    <input
                      type="number"
                      min="0"
                      value={rule.min ?? ''}
                      onChange={e => writeScoreRules(scoreRules.map((r, k) =>
                        k === rIdx ? { ...r, min: Math.max(0, parseInt(e.target.value) || 0) } : r
                      ))}
                      title="Minimum combined score for this rule to apply"
                      style={{ width: '58px', flexShrink: 0, height: CTRL_H_SM, fontSize: '0.78rem', borderRadius: RADIUS, border: '1px solid var(--border)', padding: '0 6px', fontWeight: 800, textAlign: 'center', color: 'var(--accent-primary)' }}
                    />
                    <select
                      value={rule.target ?? ''}
                      onChange={e => writeScoreRules(scoreRules.map((r, k) =>
                        k === rIdx ? { ...r, target: e.target.value === '' ? null : parseInt(e.target.value) } : r
                      ))}
                      title="Where to go when this rule wins"
                      style={{ flexGrow: 1, minWidth: 0, height: CTRL_H_SM, fontSize: '0.78rem', borderRadius: RADIUS, border: '1px solid var(--border)', padding: '0 6px', fontWeight: 600 }}
                    >
                      <option value="">Choose a target...</option>
                      <option value="-1">End of Survey</option>
                      {Array.from({ length: total }).map((_, targetIdx) => {
                        if (targetIdx === i) return null;
                        const targetQ = questions?.[targetIdx];
                        if (targetQ?._is_section || targetQ?.question_type === '_section') return null;
                        return <option key={targetIdx} value={targetIdx}>Go to Q{questionLabels?.[targetIdx] ?? (targetIdx + 1)}</option>;
                      })}
                    </select>
                    <button
                      type="button"
                      onClick={() => writeScoreRules(scoreRules.filter((_, k) => k !== rIdx))}
                      title="Remove this rule"
                      style={{ flexShrink: 0, width: '28px', height: CTRL_H_SM, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(239,68,68,0.05)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.15)', borderRadius: RADIUS, cursor: 'pointer' }}
                    >
                      <X size={14} strokeWidth={2.5} />
                    </button>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => writeScoreRules([
                  ...scoreRules,
                  { min: Math.max(0, (scoreRules[scoreRules.length - 1]?.min ?? 0) + 1), target: null },
                ])}
                style={{ marginTop: '8px', padding: '5px 12px', fontSize: '0.7rem', fontWeight: 700, background: 'rgba(99,102,241,0.05)', color: 'var(--accent-primary)', border: '1px solid var(--accent-primary)', borderRadius: RADIUS, cursor: 'pointer' }}
              >
                + Add Rule
              </button>
              <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '6px', lineHeight: 1.5 }}>
                Each rule means &ldquo;score is at least this many points&rdquo;. When several match, the highest one wins.
                If no rule matches, the survey continues normally.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

const isSectionRow = (q) => !!q && (q._is_section || q.question_type === '_section');

// Which option of `parentQ` switches on the subsection `childQ` belongs to —
// the authoring-side mirror of resolveActivatingOptionIndex in
// surveyRouting.js, working on the builder's own in-memory question shape
// (parent refs as "q_<id>", jump targets as raw array indices) so the
// condition shown while authoring is the one the respondent-side flow applies.
//
// Returns null when the subsection has no condition, i.e. it is shown whenever
// its parent is answered.
const subsectionActivatorOf = (childQ, parentQ, childIdx = null) => {
  if (!childQ || !parentQ || Number(childQ.tier || 1) <= 1) return null;
  const { parentRef, optionIndex } = parseParentRef(childQ.parent_question_key);
  if (parentRef !== `q_${parentQ.id}`) return null;
  if (optionIndex != null) return optionIndex;
  if (childIdx == null) return null;
  const direct = (parentQ.options || []).findIndex((o) => o.next_question === childIdx);
  return direct >= 0 ? direct : null;
};

const SurveyBuilder = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { 
    createSurvey, 
    updateSurvey, 
    addQuestions, 
    clearQuestions, 
    fetchSurveyDetail, 
    currentSurvey,
    loading,
    surveys,
    fetchSurveys
  } = useSurveyStore();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('AI');
  const [isNewBatch, setIsNewBatch] = useState(false);
  const [questions, setQuestions] = useState([]);
  const [dragIndex, setDragIndex] = useState(null);
  const [dropTarget, setDropTarget] = useState(null); // { index, position: 'before' | 'after' }
  const [isEditMode, setIsEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [previewIdx, setPreviewIdx] = useState(null);
  const closePreview = () => setPreviewIdx(null);
  const openPreview = (i) => setPreviewIdx(i);

  const [isTranslationModalOpen, setIsTranslationModalOpen] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [translationLanguage, setTranslationLanguage] = useState(null);
  const [translationCompleted, setTranslationCompleted] = useState(false);
  const [translatedSurveyData, setTranslatedSurveyData] = useState(null);

  const [isUploadPreviewModalOpen, setIsUploadPreviewModalOpen] = useState(false);
  const [uploadedSurveyData, setUploadedSurveyData] = useState(null);
  const [selectedLanguages, setSelectedLanguages] = useState([]);
  const [uploadedTranslatedSurveys, setUploadedTranslatedSurveys] = useState({});
  const [activePreviewLang, setActivePreviewLang] = useState('');
  const [isUploadingTranslation, setIsUploadingTranslation] = useState(false);
  const [uploadTranslationCompleted, setUploadTranslationCompleted] = useState(false);
  const [isManualUpload, setIsManualUpload] = useState(false);
  // Validate & Test (Play): the report popup, and the live test run that a
  // clean report unlocks.
  const [validationResult, setValidationResult] = useState(null);
  const [isTestModeOpen, setIsTestModeOpen] = useState(false);
  const [isTemplateDropdownOpen, setIsTemplateDropdownOpen] = useState(false);
  const [isUploadDropdownOpen, setIsUploadDropdownOpen] = useState(false);
  const [isToolsMenuOpen, setIsToolsMenuOpen] = useState(false);
  const dropdownRef = useRef(null);
  const uploadDropdownRef = useRef(null);
  const toolsMenuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsTemplateDropdownOpen(false);
      }
      if (uploadDropdownRef.current && !uploadDropdownRef.current.contains(event.target)) {
        setIsUploadDropdownOpen(false);
      }
      if (toolsMenuRef.current && !toolsMenuRef.current.contains(event.target)) {
        setIsToolsMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleAutomationUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        // The Instructions sheet is always added first — skip it explicitly
        // rather than blindly taking SheetNames[0], which would otherwise
        // try to parse survey questions out of the instructions prose.
        const sheetName = workbook.SheetNames.find(name => name.trim().toLowerCase() !== 'instructions') || workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];

        const parsedData = parseExcelSheet(sheet);
        if (!parsedData) {
          throw new Error("Could not find headers in Excel template. Please make sure header row exists.");
        }

        setIsManualUpload(false);
        setUploadedSurveyData(parsedData);
        setSelectedLanguages([]);
        setUploadedTranslatedSurveys({});
        setActivePreviewLang('');
        setUploadTranslationCompleted(false);
        setIsUploadPreviewModalOpen(true);
        
        const { showSuccess } = useNotificationStore.getState();
        showSuccess(`Successfully parsed automation template with ${parsedData.questions.length} questions.`);
      } catch (err) {
        console.error(err);
        const { showError } = useNotificationStore.getState();
        showError(`Failed to parse Excel: ${err.message || 'Check template format.'}`);
      }
    };

    reader.readAsArrayBuffer(file);
    e.target.value = null;
  };

  const handleManualUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        
        let baseSurveyData = null;
        const tempTranslatedMap = {};
        const foundLangCodes = [];

        workbook.SheetNames.forEach((sheetName) => {
          const sheet = workbook.Sheets[sheetName];
          const parsedData = parseExcelSheet(sheet);
          if (!parsedData) return;

          if (parsedData.questions && parsedData.questions.length > 0) {
            const matchedLang = INDIC_LANGUAGES.find(l => 
              l.name.toLowerCase() === sheetName.trim().toLowerCase() ||
              l.code.toLowerCase() === sheetName.trim().toLowerCase() ||
              l.nativeName.toLowerCase() === sheetName.trim().toLowerCase()
            );

            if (matchedLang) {
              if (matchedLang.code === 'en') {
                baseSurveyData = parsedData;
              } else {
                tempTranslatedMap[matchedLang.code] = parsedData;
                foundLangCodes.push(matchedLang.code);
              }
            }
          }
        });

        // Fallback if no English sheet is explicitly found, use the first successfully parsed
        // sheet — skipping Instructions, which isn't survey data even when it happens to parse.
        if (!baseSurveyData && workbook.SheetNames.length > 0) {
          for (const sheetName of workbook.SheetNames) {
            if (sheetName.trim().toLowerCase() === 'instructions') continue;
            const sheet = workbook.Sheets[sheetName];
            const parsedData = parseExcelSheet(sheet);
            if (parsedData && parsedData.questions && parsedData.questions.length > 0) {
              baseSurveyData = parsedData;
              break;
            }
          }
        }

        if (!baseSurveyData) {
          throw new Error("Could not parse any valid survey sheets. Please ensure at least one sheet contains the correct headers.");
        }

        setIsManualUpload(true);
        setUploadedSurveyData(baseSurveyData);
        setUploadedTranslatedSurveys(tempTranslatedMap);
        setSelectedLanguages(foundLangCodes);
        setUploadTranslationCompleted(true);
        setActivePreviewLang(foundLangCodes.length > 0 ? foundLangCodes[0] : 'en');
        setIsUploadPreviewModalOpen(true);

        const { showSuccess } = useNotificationStore.getState();
        showSuccess(`Successfully parsed manual template: loaded base survey and ${foundLangCodes.length} translation sheet(s).`);
      } catch (err) {
        console.error(err);
        const { showError } = useNotificationStore.getState();
        showError(`Failed to parse manual template: ${err.message || 'Check multi-sheet format.'}`);
      }
    };

    reader.readAsArrayBuffer(file);
    e.target.value = null;
  };

  
  const renderPreview = () => {
    if (previewIdx === null) return null;
    const q = questions[previewIdx];
    if (!q) return null;
    const renderMedia = (type, url) => {
      if (!url) return null;
      switch (type) {
        case 'image':
          return <img src={url} alt="Media" style={{ maxWidth: '100%', maxHeight: '300px', objectFit: 'contain' }} />;
        case 'video':
          return (
            <video controls style={{ maxWidth: '100%', maxHeight: '300px' }}>
              <source src={url} />
            </video>
          );
        case 'audio':
          return (
            <audio controls style={{ width: '100%' }}>
              <source src={url} />
            </audio>
          );
        default:
          return null;
      }
    };
    return (
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3000
      }} onClick={closePreview}>
        <div style={{ background: 'var(--bg-card)', padding: '2rem', borderRadius: '12px', maxWidth: '600px', width: '90%' }} onClick={e => e.stopPropagation()}>
          <h3 style={{ marginBottom: '1rem' }}>{q.question_text}</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {parseMediaItems(q).map((item, idx) => (
              <div key={idx}>{renderMedia(item.type, item.url)}</div>
            ))}
          </div>
          {(q.question_type === 'radio' || q.question_type === 'checkbox' || q.question_type === 'select' || q.question_type === 'ranking') && (
            <ul style={{ marginTop: '1rem' }}>
              {q.options?.map((opt, idx) => (
                <li key={idx}>{opt.option_text}</li>
              ))}
            </ul>
          )}
          <button onClick={closePreview} style={{ marginTop: '1rem', padding: '8px 16px', background: 'var(--accent-primary)', color: 'white', border: 'none', borderRadius: '6px' }}>Close</button>
        </div>
      </div>
    );
  };

  const handleToggleLanguage = (langCode) => {
    setSelectedLanguages(prev => 
      prev.includes(langCode) 
        ? prev.filter(c => c !== langCode) 
        : [...prev, langCode]
    );
  };

  const handleTranslateUploaded = async () => {
    if (selectedLanguages.length === 0) return;
    setIsUploadingTranslation(true);
    setUploadTranslationCompleted(false);
    setUploadedTranslatedSurveys({});
    
    try {
      const translatedMap = {};
      await Promise.all(selectedLanguages.map(async (langCode) => {
        const result = await translateSurvey(uploadedSurveyData, langCode);
        translatedMap[langCode] = result;
      }));
      setUploadedTranslatedSurveys(translatedMap);
      setUploadTranslationCompleted(true);
      setActivePreviewLang(selectedLanguages[0]);
    } catch (error) {
      console.error(error);
      const { showError } = useNotificationStore.getState();
      showError("Translation failed. Please try again.");
    } finally {
      setIsUploadingTranslation(false);
    }
  };

  const handleSaveUploadedOriginal = async () => {
    if (!uploadedSurveyData) return;
    const { showSuccess, showError } = useNotificationStore.getState();
    setSaving(true);
    try {
      const survey = await createSurvey({ 
        title: uploadedSurveyData.title, 
        category: uploadedSurveyData.category, 
        description: uploadedSurveyData.description 
      });
      if (survey && survey.id) {
        const preparedQuestions = prepareQuestionsForSave(uploadedSurveyData.questions).map((q, idx) => ({ ...q, order: idx }));
        await addQuestions(survey.id, preparedQuestions);
        showSuccess(`New Survey Created from Upload: ${uploadedSurveyData.title}`);
        setIsUploadPreviewModalOpen(false);
        navigate('/surveys');
      }
    } catch (err) {
      showError("Error saving uploaded survey: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveUploadedTranslatedOnly = async () => {
    if (Object.keys(uploadedTranslatedSurveys).length === 0) return;
    const { showSuccess, showError } = useNotificationStore.getState();
    setSaving(true);
    try {
      for (const langCode of selectedLanguages) {
        const data = uploadedTranslatedSurveys[langCode];
        if (!data) continue;
        const langObj = INDIC_LANGUAGES.find(l => l.code === langCode);
        const newTitle = `${data.title} (${langObj.name})`;
        const survey = await createSurvey({
          title: newTitle,
          category: uploadedSurveyData.category,
          description: data.description
        });
        if (survey && survey.id) {
          const preparedQuestions = prepareQuestionsForSave(data.questions).map((q, idx) => ({ ...q, order: idx }));
          await addQuestions(survey.id, preparedQuestions);
        }
      }
      showSuccess(`Successfully saved all ${selectedLanguages.length} translated surveys!`);
      setIsUploadPreviewModalOpen(false);
      navigate('/surveys');
    } catch (err) {
      showError("Error saving translated surveys: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveUploadedBoth = async () => {
    if (!uploadedSurveyData || Object.keys(uploadedTranslatedSurveys).length === 0) return;
    const { showSuccess, showError } = useNotificationStore.getState();
    setSaving(true);
    try {
      // 1. Save original
      const originalSurvey = await createSurvey({ 
        title: uploadedSurveyData.title, 
        category: uploadedSurveyData.category, 
        description: uploadedSurveyData.description 
      });
      if (originalSurvey && originalSurvey.id) {
        const preparedQuestions = prepareQuestionsForSave(uploadedSurveyData.questions).map((q, idx) => ({ ...q, order: idx }));
        await addQuestions(originalSurvey.id, preparedQuestions);
      }

      // 2. Save all translations
      for (const langCode of selectedLanguages) {
        const data = uploadedTranslatedSurveys[langCode];
        if (!data) continue;
        const langObj = INDIC_LANGUAGES.find(l => l.code === langCode);
        const newTitle = `${data.title} (${langObj.name})`;
        const survey = await createSurvey({
          title: newTitle,
          category: uploadedSurveyData.category,
          description: data.description
        });
        if (survey && survey.id) {
          const preparedQuestions = prepareQuestionsForSave(data.questions).map((q, idx) => ({ ...q, order: idx }));
          await addQuestions(survey.id, preparedQuestions);
        }
      }

      showSuccess(`Successfully saved original and all ${selectedLanguages.length} translated surveys!`);
      setIsUploadPreviewModalOpen(false);
      navigate('/surveys');
    } catch (err) {
      showError("Error saving uploaded surveys: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleImportUploadedToBuilder = () => {
    if (!uploadedSurveyData) return;
    setTitle(uploadedSurveyData.title);
    setDescription(uploadedSurveyData.description);
    setCategory(uploadedSurveyData.category);
    setQuestions(uploadedSurveyData.questions);
    setIsUploadPreviewModalOpen(false);
    
    const { showSuccess } = useNotificationStore.getState();
    showSuccess("Uploaded survey imported to Builder form. Review and edit before saving.");
  };

  const handleImportUploadedTranslatedToBuilder = () => {
    const data = uploadedTranslatedSurveys[activePreviewLang];
    if (!data) return;
    const langObj = INDIC_LANGUAGES.find(l => l.code === activePreviewLang);
    setTitle(data.title);
    setDescription(data.description);
    setCategory(uploadedSurveyData.category);
    setQuestions(data.questions);
    setIsUploadPreviewModalOpen(false);
    
    const { showSuccess } = useNotificationStore.getState();
    showSuccess(`Uploaded translated survey (${langObj.name}) imported to Builder form.`);
  };

  const renderUploadPreviewModal = () => {
    if (!isUploadPreviewModalOpen || !uploadedSurveyData) return null;

    const activeTranslatedData = uploadedTranslatedSurveys[activePreviewLang];
    const activeLangObj = INDIC_LANGUAGES.find(l => l.code === activePreviewLang);

    return (
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        background: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 3400,
        animation: 'fade-in 0.3s ease-out'
      }} onClick={() => !saving && !isUploadingTranslation && setIsUploadPreviewModalOpen(false)}>
        <div style={{
          background: 'var(--bg-card)',
          padding: '2.5rem',
          borderRadius: '20px',
          maxWidth: '1200px', // Spacious premium layout
          width: '95%',
          maxHeight: '95vh',
          overflowY: 'auto',
          border: '1px solid var(--border)',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.3)',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.5rem',
          color: 'var(--text-main)'
        }} onClick={e => e.stopPropagation()}>
          
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                width: '40px', height: '40px', borderRadius: '10px',
                background: 'rgba(76, 140, 228, 0.1)', color: 'var(--accent-primary)',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                <Upload size={22} />
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0 }}>Uploaded Survey Preview</h3>
                  <span style={{
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    padding: '3px 8px',
                    borderRadius: '12px',
                    background: isManualUpload ? 'rgba(16, 185, 129, 0.15)' : 'rgba(76, 140, 228, 0.15)',
                    color: isManualUpload ? '#10B981' : '#4C8CE4',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}>
                    {isManualUpload ? 'Manual (Multi-Sheet)' : 'Automation (AI Translation)'}
                  </span>
                </div>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>
                  {isManualUpload 
                    ? 'Review the manual translations loaded from Excel, then save all versions at once' 
                    : 'Review the template questions, select languages via checkboxes, and save all versions at once'}
                </p>
              </div>
            </div>
            {!saving && !isUploadingTranslation && (
              <button 
                onClick={() => setIsUploadPreviewModalOpen(false)}
                style={{ background: 'var(--bg-hover)', border: 'none', padding: '6px', borderRadius: '50%', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                <X size={18} />
              </button>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
            
            {/* Left Side: Original Upload Content Preview */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={{ borderBottom: '2px solid var(--border)', paddingBottom: '10px' }}>
                <h4 style={{ fontWeight: 800, fontSize: '1.05rem', color: 'var(--text-main)', margin: '0 0 4px' }}>Original Document</h4>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '4px 0 0' }}>Survey Title: <strong style={{ color: 'var(--text-main)' }}>{uploadedSurveyData.title}</strong></p>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '2px 0 0' }}>Category: <strong>{uploadedSurveyData.category}</strong></p>
              </div>

              {/* Scrollable Questions list (Taller to support scale) */}
              <div style={{ 
                background: 'var(--bg-main)', 
                padding: '1.25rem', 
                borderRadius: '12px', 
                height: '450px', 
                overflowY: 'auto',
                border: '1px solid var(--border)'
              }}>
                <ul style={{ margin: 0, paddingLeft: '1.2rem', fontSize: '0.9rem', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {uploadedSurveyData.questions.map((q, idx) => (
                    <li key={idx}>
                      <strong>Q{idx + 1}:</strong> {q.question_text} <span style={{ fontSize: '0.7rem', color: 'var(--accent-primary)', fontWeight: 600 }}>({q.question_type})</span>
                      {q.options && q.options.length > 0 && (
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px', paddingLeft: '6px', borderLeft: '2px solid var(--border)' }}>
                          Options: {q.options.map(o => o.option_text).join('; ')}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button 
                  onClick={handleSaveUploadedOriginal}
                  disabled={saving || isUploadingTranslation}
                  style={{
                    flexGrow: 1, height: '48px', borderRadius: '10px', fontWeight: 700, fontSize: '0.9rem',
                    background: 'var(--accent-primary)', color: 'white', border: 'none', cursor: 'pointer',
                    boxShadow: '0 4px 10px rgba(76, 140, 228, 0.15)'
                  }}
                >
                  Save Original Only
                </button>
                <button 
                  onClick={handleImportUploadedToBuilder}
                  disabled={saving || isUploadingTranslation}
                  style={{
                    height: '48px', padding: '0 16px', borderRadius: '10px', fontWeight: 600, fontSize: '0.9rem',
                    background: 'none', border: '1px solid var(--border)', color: 'var(--text-main)', cursor: 'pointer'
                  }}
                  title="Import to Form Builder to edit/review questions"
                >
                  Import Original to Form
                </button>
              </div>
            </div>

            {/* Right Side: Translation Preview / Action */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', borderLeft: '1px solid var(--border)', paddingLeft: '2rem' }}>
              
              {!isUploadingTranslation && !uploadTranslationCompleted && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', height: '100%' }}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <h4 style={{ fontWeight: 800, fontSize: '1.05rem', color: 'var(--text-main)', margin: 0 }}>Translate Survey (Select Languages)</h4>
                      <div style={{ display: 'flex', gap: '10px' }}>
                        <button 
                          onClick={() => setSelectedLanguages(INDIC_LANGUAGES.map(l => l.code))}
                          style={{ background: 'none', border: 'none', color: 'var(--accent-primary)', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}
                        >
                          Select All
                        </button>
                        <button 
                          onClick={() => setSelectedLanguages([])}
                          style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}
                        >
                          Clear All
                        </button>
                      </div>
                    </div>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>Select one or multiple languages using checkboxes to translate simultaneously:</p>
                  </div>

                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
                    gap: '10px',
                    height: '380px', 
                    overflowY: 'auto',
                    padding: '8px',
                    background: 'var(--bg-main)',
                    borderRadius: '12px',
                    border: '1px solid var(--border)'
                  }}>
                    {INDIC_LANGUAGES.map(lang => {
                      const isChecked = selectedLanguages.includes(lang.code);
                      return (
                        <label
                          key={lang.code}
                          style={{
                            padding: '10px 12px',
                            borderRadius: '10px',
                            background: isChecked ? 'rgba(76, 140, 228, 0.08)' : 'var(--bg-card)',
                            border: `1.5px solid ${isChecked ? 'var(--accent-primary)' : 'var(--border)'}`,
                            color: 'var(--text-main)',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            userSelect: 'none',
                            transition: 'all 0.2s'
                          }}
                        >
                          <input 
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handleToggleLanguage(lang.code)}
                            style={{ 
                              width: '16px', 
                              height: '16px', 
                              accentColor: 'var(--accent-primary)',
                              cursor: 'pointer'
                            }}
                          />
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                            <span style={{ fontWeight: 700, fontSize: '0.8rem' }}>{lang.name}</span>
                            <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>{lang.nativeName}</span>
                          </div>
                        </label>
                      );
                    })}
                  </div>

                  <button
                    onClick={handleTranslateUploaded}
                    disabled={selectedLanguages.length === 0}
                    style={{
                      height: '48px',
                      borderRadius: '10px',
                      fontWeight: 800,
                      fontSize: '0.9rem',
                      background: selectedLanguages.length === 0 ? 'var(--border)' : 'var(--accent-primary)',
                      color: selectedLanguages.length === 0 ? 'var(--text-muted)' : 'white',
                      border: 'none',
                      cursor: selectedLanguages.length === 0 ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      marginTop: 'auto',
                      boxShadow: selectedLanguages.length === 0 ? 'none' : '0 4px 12px rgba(76, 140, 228, 0.2)'
                    }}
                  >
                    <Languages size={18} />
                    Translate to {selectedLanguages.length} Selected Languages
                  </button>
                </div>
              )}

              {isUploadingTranslation && (
                <div style={{ textAlign: 'center', padding: '6rem 0', margin: 'auto' }}>
                  <Loader2 className="spin" size={48} color="var(--accent-primary)" style={{ margin: '0 auto 1.5rem' }} />
                  <h4 style={{ fontWeight: 700, margin: '0 0 8px' }}>Translating Survey...</h4>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    Please wait while Google Translate processes {INDIC_LANGUAGES.find(l => l.code === activePreviewLang)?.name || 'translation'}.
                  </p>
                </div>
              )}

              {!isUploadingTranslation && uploadTranslationCompleted && Object.keys(uploadedTranslatedSurveys).length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', height: '100%' }}>
                  
                  {/* Lang Selection Header */}
                  <div style={{ borderBottom: '2px solid var(--border)', paddingBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>PREVIEW TRANSLATION:</span>
                      <select
                        value={activePreviewLang}
                        onChange={e => setActivePreviewLang(e.target.value)}
                        style={{ padding: '6px 12px', borderRadius: '6px', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer', background: 'var(--bg-card)', color: 'var(--text-main)', border: '1px solid var(--border)' }}
                      >
                        {Object.keys(uploadedTranslatedSurveys).map(langCode => {
                          const langObj = INDIC_LANGUAGES.find(l => l.code === langCode);
                          return (
                            <option key={langCode} value={langCode}>{langObj?.name || langCode}</option>
                          );
                        })}
                      </select>
                    </div>
                    {!isManualUpload && (
                      <button 
                        onClick={() => { setUploadTranslationCompleted(false); setUploadedTranslatedSurveys({}); }}
                        style={{ background: 'none', border: 'none', color: 'var(--accent-primary)', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}
                      >
                        Change Languages
                      </button>
                    )}
                  </div>

                  {/* Checklist of languages to save */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 800, letterSpacing: '0.5px' }}>
                        SELECT TRANSLATIONS TO SAVE:
                      </span>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', userSelect: 'none', color: 'var(--text-main)' }}>
                        <input 
                          type="checkbox" 
                          checked={selectedLanguages.length === Object.keys(uploadedTranslatedSurveys).length}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedLanguages(Object.keys(uploadedTranslatedSurveys));
                            } else {
                              setSelectedLanguages([]);
                            }
                          }}
                          style={{ accentColor: 'var(--accent-primary)', width: '14px', height: '14px', cursor: 'pointer' }}
                        />
                        Select All
                      </label>
                    </div>
                    
                    <div style={{ 
                      display: 'flex', 
                      flexWrap: 'wrap', 
                      gap: '6px', 
                      padding: '8px', 
                      background: 'var(--bg-main)', 
                      borderRadius: '8px', 
                      border: '1px solid var(--border)',
                      maxHeight: '75px',
                      overflowY: 'auto'
                    }}>
                      {Object.keys(uploadedTranslatedSurveys).map(langCode => {
                        const langObj = INDIC_LANGUAGES.find(l => l.code === langCode);
                        if (!langObj) return null;
                        const isChecked = selectedLanguages.includes(langCode);
                        return (
                          <label 
                            key={langCode} 
                            style={{ 
                              display: 'flex', 
                              alignItems: 'center', 
                              gap: '6px', 
                              fontSize: '0.7rem', 
                              fontWeight: 600,
                              padding: '3px 8px', 
                              borderRadius: '6px', 
                              background: isChecked ? 'rgba(76, 140, 228, 0.08)' : 'var(--bg-card)', 
                              border: `1px solid ${isChecked ? 'var(--accent-primary)' : 'var(--border)'}`,
                              cursor: 'pointer',
                              userSelect: 'none',
                              color: 'var(--text-main)',
                              transition: 'all 0.15s'
                            }}
                          >
                            <input 
                              type="checkbox" 
                              checked={isChecked}
                              onChange={() => {
                                setSelectedLanguages(prev => 
                                  prev.includes(langCode) 
                                    ? prev.filter(c => c !== langCode) 
                                    : [...prev, langCode]
                                );
                              }}
                              style={{ accentColor: 'var(--accent-primary)', width: '12px', height: '12px', cursor: 'pointer' }}
                            />
                            {langObj.name}
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  {activeTranslatedData && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <div>
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>Survey Title: <strong style={{ color: 'var(--text-main)' }}>{activeTranslatedData.title}</strong></p>
                      </div>

                      {/* Scrollable Questions list (Taller height for scale) */}
                      <div style={{ 
                        background: 'var(--bg-main)', 
                        padding: '1.25rem', 
                        borderRadius: '12px', 
                        height: '350px', 
                        overflowY: 'auto',
                        border: '1px solid var(--border)'
                      }}>
                        <ul style={{ margin: 0, paddingLeft: '1.2rem', fontSize: '0.9rem', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          {activeTranslatedData.questions.map((q, idx) => (
                            <li key={idx}>
                              <strong>Q{idx + 1}:</strong> {q.question_text} <span style={{ fontSize: '0.7rem', color: 'var(--accent-primary)', fontWeight: 600 }}>({q.question_type})</span>
                              {q.options && q.options.length > 0 && (
                                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px', paddingLeft: '6px', borderLeft: '2px solid var(--border)' }}>
                                  Options: {q.options.map(o => o.option_text).join('; ')}
                                </div>
                              )}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: 'auto' }}>
                    <button 
                      onClick={handleSaveUploadedBoth}
                      disabled={saving || selectedLanguages.length === 0}
                      style={{
                        height: '48px', borderRadius: '10px', fontWeight: 800, fontSize: '0.9rem',
                        background: selectedLanguages.length === 0 ? 'var(--border)' : 'var(--accent-primary)',
                        color: selectedLanguages.length === 0 ? 'var(--text-muted)' : 'white',
                        border: 'none',
                        cursor: selectedLanguages.length === 0 ? 'not-allowed' : 'pointer',
                        boxShadow: selectedLanguages.length === 0 ? 'none' : '0 4px 12px rgba(99, 102, 241, 0.2)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
                      }}
                    >
                      <Save size={18} />
                      Save Both (Original & All {selectedLanguages.length} Selected Translations)
                    </button>

                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button 
                        onClick={handleSaveUploadedTranslatedOnly}
                        disabled={saving || selectedLanguages.length === 0}
                        style={{
                          flexGrow: 1, height: '40px', borderRadius: '8px', fontWeight: 700, fontSize: '0.8rem',
                          background: 'none', border: '1px solid var(--border)', color: 'var(--text-main)',
                          cursor: selectedLanguages.length === 0 ? 'not-allowed' : 'pointer',
                          opacity: selectedLanguages.length === 0 ? 0.5 : 1
                        }}
                        title={`Saves only the ${selectedLanguages.length} translated surveys`}
                      >
                        Save {selectedLanguages.length} Translated Only
                      </button>
                      <button 
                        onClick={handleImportUploadedTranslatedToBuilder}
                        disabled={saving}
                        style={{
                          height: '40px', padding: '0 10px', borderRadius: '8px', fontWeight: 600, fontSize: '0.8rem',
                          background: 'none', border: '1px solid var(--border)', color: 'var(--text-main)', cursor: 'pointer'
                        }}
                        title={`Import currently viewed translated survey (${activeLangObj?.name}) to Builder form`}
                      >
                        Import Translated
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

          </div>

        </div>
      </div>
    );
  };

  useEffect(() => {
    fetchSurveys();
  }, []);

  const baseBatches = ['AI', 'Developer', 'DevOps'];
  const allBatches = [...new Set([...baseBatches, ...(surveys || []).map(s => s.category).filter(Boolean)])];

  // Initial Load for Edit Mode
  useEffect(() => {
    if (id) {
      setIsEditMode(true);
      fetchSurveyDetail(id);
    } else {
      setIsEditMode(false);
      setTitle('');
      setDescription('');
      setCategory('AI');
      setQuestions([]);
    }
  }, [id]);

  // Populate state when data arrives
  useEffect(() => {
    if (id && currentSurvey && currentSurvey.id === parseInt(id)) {
      setTitle(currentSurvey.title || '');
      setCategory(currentSurvey.category || 'AI');
      setDescription(currentSurvey.description || '');
      
      // Transform backend question structure to builder structure
      if (currentSurvey.questions) {
        const sortedDbQuestions = currentSurvey.questions.slice().sort((a, b) => a.order - b.order);

        // parent_question_key is stored as "idx_<arrayPosition>" (see
        // prepareQuestionsForSave) since ids aren't stable across saves —
        // resolve it back to "q_<id>" here using the ids the backend just
        // assigned, so the rest of the builder's UI/logic (dropdowns,
        // nested-branch rendering) can keep working off the id-based form
        // it already expects. Any older "q_<id>" value is passed through
        // unchanged as a fallback.
        // A trailing ":opt_<n>" (the option that activates this subsection —
        // see surveyRouting.parseParentRef) is position-independent, so it
        // rides through the conversion untouched.
        const resolveParentKey = (rawKey) => {
          if (!rawKey) return null;
          const { parentRef, optionIndex } = parseParentRef(rawKey);
          const m = /^idx_(\d+)$/.exec(String(parentRef || ''));
          if (!m) return formatParentRef(parentRef, optionIndex);
          const parentRow = sortedDbQuestions[parseInt(m[1], 10)];
          return parentRow ? formatParentRef(`q_${parentRow.id}`, optionIndex) : null;
        };

        const mappedQuestions = sortedDbQuestions
          .map(q => {
            // Section dividers are stored as real Question rows (question_type
            // '_section') so they persist and reload with the survey; rebuild
            // the local pseudo-question shape the builder UI renders.
            if (q.question_type === '_section') {
              return {
                id: q.id,
                _is_section: true,
                section_label: q.question_text || '',
                question_text: '',
                question_type: '_section',
                options: [],
              };
            }
            return {
              id: q.id,
              question_text: q.question_text,
              question_type: q.question_type,
              media_type: q.media_type,
              media_url: q.media_url,
              media_items: q.media_items || null,
              required: q.required,
              options: q.options?.sort((a,b) => a.order - b.order).map(o => ({
                option_text: o.option_text || '',
                next_question: o.next_question ?? null,
                score: o.score || 0,
                is_red_flag: o.is_red_flag || false,
                media_url: o.media_url || '',
                media_type: o.media_type || 'image',
                media_items: o.media_items || null,
                emoji: o.emoji || ''
              })) || [],
              rating_max: q.rating_max || 5,
              low_label: q.low_label || '',
              high_label: q.high_label || '',
              rating_style: q.rating_style || 'number',
              rating_labels: q.rating_labels || null,
              allowed_file_types: q.allowed_file_types || '',
              max_file_size_mb: q.max_file_size_mb ?? 10,
              matrix_rows: q.matrix_rows || null,
              matrix_columns: q.matrix_columns || null,
              matrix_multi: q.matrix_multi || false,
              scale: q.scale || '',
              score_threshold: q.score_threshold ?? null,
              score_rules: q.score_rules ?? null,
              threshold_next_question: q.threshold_next_question ?? null,
              backward_question: q.backward_question ?? null,
              tier: q.tier ?? 1,
              parent_question_key: resolveParentKey(q.parent_question_key)
            };
          });
        setQuestions(mappedQuestions);
      }
    }
  }, [currentSurvey, id]);

  const addQuestion = () => {
    setQuestions([...questions, {
      id: `temp-${Date.now()}-${Math.random()}`,
      question_text: '',
      question_type: 'text',
      media_type: 'none',
      media_url: '',
      media_items: null,
      required: true,
      options: [],
      rating_max: 5,
      low_label: '',
      high_label: '',
      rating_style: 'number',
      rating_labels: null,
      allowed_file_types: '',
      max_file_size_mb: 10,
      matrix_rows: null,
      matrix_columns: null,
      matrix_multi: false,
      scale: '',
      score_threshold: null,
      score_rules: null,
      threshold_next_question: null,
      backward_question: null,
      tier: 1,
      parent_question_key: null
    }]);
  };

  const addSection = (label = 'New Section') => {
    setQuestions(prev => [...prev, {
      id: `section-${Date.now()}-${Math.random()}`,
      _is_section: true,
      section_label: label,
      question_text: '',
      question_type: '_section',
      required: false,
      options: [],
    }]);
  };

  // Section dividers round-trip through the DB as real Question rows (no
  // schema change needed) so they persist and reload with the survey. This
  // maps the local pseudo-question shape back to a savable question payload,
  // carrying the editable label into question_text.
  //
  // parent_question_key also gets rewritten here, from the in-memory
  // "q_<id>" form into a stable "idx_<arrayPosition>" form. Every save does
  // a full delete-all + insert-all of a survey's questions (there's no
  // per-question update endpoint), so every question gets a brand new DB id
  // each time — a saved "q_<id>" reference would already be pointing at a
  // row that no longer exists by the time the insert finishes. Array
  // position survives that cycle (the same trick option jumps already rely
  // on via next_question), so it's what gets persisted; the reload effect
  // below converts it back to "q_<id>" using the freshly assigned ids.
  const prepareQuestionsForSave = (arr) => {
    const idxByLocalKey = new Map();
    arr.forEach((q, idx) => {
      if (isSectionRow(q)) return;
      idxByLocalKey.set(`q_${q.id}`, idx);
    });

    return arr.map(q => {
      if (isSectionRow(q)) {
        return {
          question_text: q.section_label || '',
          question_type: '_section',
          media_type: 'none',
          media_url: null,
          required: false,
          options: [],
          rating_max: 5,
          low_label: '',
          high_label: '',
          scale: '',
          score_threshold: null,
          score_rules: null,
          threshold_next_question: null,
          backward_question: null,
          tier: 1,
          parent_question_key: null,
        };
      }
      const { parentRef, optionIndex } = parseParentRef(q.parent_question_key);
      const parentIdx = Number(q.tier) > 1 && parentRef
        ? idxByLocalKey.get(parentRef)
        : undefined;
      return {
        ...q,
        parent_question_key:
          parentIdx !== undefined ? formatParentRef(`idx_${parentIdx}`, optionIndex) : null,
      };
    });
  };

  // Group tier-N (follow-up, tier 2-5) questions under their parent so each
  // branch renders as a nested block in the builder, and compute a
  // hierarchical display label for every question: root questions get
  // sequential whole numbers (1, 2, 3...), and any question with a valid
  // parent gets "<parent label>.<sibling index>" (3.1, 3.2, 3.1.1, ...),
  // recursively — so tiers 2 through 5 all nest and number correctly no
  // matter how deep the chain goes. This is purely a rendering concern —
  // the underlying array order, indices and saved next_question jump
  // targets are untouched.
  const { questionLabels, childrenByParentIdx, nestedChildIndexSet } = useMemo(
    () => computeQuestionLabels(questions),
    [questions]
  );

  // Which option on the parent switches THIS specific child on — used so each
  // branch gets its own "shown when … " label rather than one label being
  // applied to every child lumped together.
  const branchOptionForChild = (parentQ, childIdx) => {
    const index = subsectionActivatorOf(questions[childIdx], parentQ, childIdx);
    if (index == null || !parentQ?.options?.[index]) return null;
    return { option: parentQ.options[index], index };
  };

  // Recursively renders a question card and, one by one, each of its
  // tier-2..5 follow-up branches to arbitrary depth. Every child gets its
  // own individually-labeled block (rather than being merged into a single
  // shared block) so questions reached by different options are never
  // shown as if they belonged to the same branch.
  const renderQuestionBlock = (idx) => {
    const bq = questions[idx];
    const kids = childrenByParentIdx[idx] || [];
    return (
      <div key={bq.id || idx} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        <QuestionCard
          q={bq}
          i={idx}
          label={questionLabels[idx]}
          questionLabels={questionLabels}
          total={questions.length}
          questions={questions}
          updateQuestion={updateQuestion}
          updateQuestionMultiple={updateQuestionMultiple}
          removeQuestion={removeQuestion}
          duplicateQuestion={duplicateQuestion}
          moveQuestion={moveQuestion}
          addOption={addOption}
          updateOption={updateOption}
          updateOptionMultiple={updateOptionMultiple}
          autoAssignScores={autoAssignScores}
          openPreview={openPreview}
          removeOption={removeOption}
          addFollowUpQuestion={addFollowUpQuestion}
        />
        {kids.map(childIdx => (
          <div key={`branch-${questions[childIdx].id || childIdx}`} style={{
            marginLeft: '28px',
            paddingLeft: '24px',
            borderLeft: '3px dashed rgba(99,102,241,0.35)',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.25rem',
          }}>
            {(() => {
              // Subsection Routing header: the condition that switches this
              // group on, editable in place. Only the first question of a
              // subsection shows the picker — the rest inherit the same
              // condition by belonging to the branch, and are labelled as
              // continuations so it's clear they aren't separately gated.
              const tierLabel = questionLabels?.[childIdx] ?? String(childIdx + 1);
              const found = branchOptionForChild(bq, childIdx);
              const siblings = childrenByParentIdx[idx] || [];
              const isBranchEntry =
                found == null ||
                siblings.findIndex(sib => branchOptionForChild(bq, sib)?.index === found.index) === siblings.indexOf(childIdx);
              const pickable = (bq.options || []).length > 0;

              return (
                <div style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '4px 12px',
                  borderRadius: '999px',
                  background: 'rgba(99,102,241,0.08)',
                  border: '1px solid var(--accent-primary)',
                  color: 'var(--accent-primary)',
                  fontSize: '0.7rem',
                  fontWeight: 800,
                  letterSpacing: '0.04em',
                  width: 'fit-content',
                }}>
                  <GitBranch size={12} />
                  <span>SUBSECTION {tierLabel}</span>
                  {pickable && isBranchEntry ? (
                    <>
                      <span style={{ fontWeight: 700, opacity: 0.8 }}>
                        SHOWN WHEN Q{questionLabels?.[idx] ?? (idx + 1)} =
                      </span>
                      <select
                        value={found?.index ?? ''}
                        onChange={e => setSubsectionActivator(
                          childIdx,
                          idx,
                          e.target.value === '' ? null : parseInt(e.target.value, 10)
                        )}
                        title="Which answer to the parent question switches this subsection on. Any other answer skips every question inside it."
                        style={{
                          padding: '2px 6px',
                          fontSize: '0.7rem',
                          fontWeight: 800,
                          color: 'var(--accent-primary)',
                          background: 'var(--bg-card)',
                          border: '1px solid var(--accent-primary)',
                          borderRadius: '6px',
                          height: '22px',
                        }}
                      >
                        <option value="">Any answer</option>
                        {(bq.options || []).map((opt, oi) => (
                          <option key={oi} value={oi}>
                            {opt.option_text?.trim() || `Option ${oi + 1}`}
                          </option>
                        ))}
                      </select>
                    </>
                  ) : (
                    <span style={{ fontWeight: 700, opacity: 0.8 }}>
                      {found
                        ? `CONTINUES THE "${found.option?.option_text?.trim() || `Option ${found.index + 1}`}" BRANCH`
                        : 'FOLLOW-UP QUESTION'}
                    </span>
                  )}
                </div>
              );
            })()}
            {renderQuestionBlock(childIdx)}
          </div>
        ))}
      </div>
    );
  };

  const removeQuestion = (index) => {
    setQuestions(questions.filter((_, i) => i !== index));
  };

  const duplicateQuestion = (index) => {
    setQuestions(prev => {
      const q = prev[index];
      const newQ = {
        ...q,
        id: `temp-${Date.now()}-${Math.random()}`,
        options: q.options.map(o => ({ ...o })),
        low_label: q.low_label,
        high_label: q.high_label,
        scale: q.scale
      };
      const newQuestions = [...prev];
      newQuestions.splice(index + 1, 0, newQ);
      return newQuestions;
    });
  };

  // Relocates a single top-level row (a question or a section divider) to a
  // new position via drag-and-drop, remapping every next_question /
  // threshold_next_question jump target elsewhere in the array so existing
  // branching logic keeps pointing at the same question after the move.
  // Nested follow-up children don't need remapping — they stay linked to
  // their parent via the id-based parent_question_key, not by position.
  const reorderQuestions = (fromIndex, toIndex) => {
    setQuestions(prev => {
      if (fromIndex == null || toIndex == null) return prev;
      if (fromIndex === toIndex || fromIndex + 1 === toIndex) return prev; // dropped back where it started

      const arr = [...prev];
      const [moved] = arr.splice(fromIndex, 1);
      const insertAt = toIndex > fromIndex ? toIndex - 1 : toIndex;
      arr.splice(insertAt, 0, moved);

      const oldToNew = new Map();
      for (let oldIdx = 0; oldIdx < prev.length; oldIdx++) {
        if (oldIdx === fromIndex) { oldToNew.set(oldIdx, insertAt); continue; }
        let pos = oldIdx;
        if (oldIdx > fromIndex) pos -= 1;
        if (pos >= insertAt) pos += 1;
        oldToNew.set(oldIdx, pos);
      }
      const remap = (val) => (val === null || val === undefined || val === -1 || !oldToNew.has(val)) ? val : oldToNew.get(val);

      // Score-Based Routing stores its own positional references — the
      // "Combine Scores From" cluster in `scale` (comma-joined indices) and
      // each rule's `target` inside `score_rules` (JSON) — separately from
      // threshold_next_question. threshold_next_question is only kept as a
      // legacy mirror of score_rules[0].target (see writeScoreRules), so
      // remapping it alone left the real score_rules list, and the scale
      // cluster, pointing at stale indices after a drag-and-drop move —
      // silently breaking Score-Based Routing on the next edit.
      const remapScale = (scale) => String(scale ?? '')
        .split(',')
        .map(s => s.trim())
        .filter(Boolean)
        .map(s => {
          const n = parseInt(s, 10);
          return Number.isInteger(n) ? remap(n) : s;
        })
        .join(',');
      const remapScoreRules = (raw) => {
        if (!raw) return raw;
        let rules;
        try { rules = JSON.parse(raw); } catch { return raw; }
        if (!Array.isArray(rules)) return raw;
        return JSON.stringify(rules.map(r => ({ ...r, target: remap(r?.target) })));
      };

      return arr.map(item => ({
        ...item,
        threshold_next_question: remap(item.threshold_next_question),
        backward_question: remap(item.backward_question),
        options: item.options ? item.options.map(opt => ({ ...opt, next_question: remap(opt.next_question) })) : item.options,
        scale: remapScale(item.scale),
        score_rules: remapScoreRules(item.score_rules),
      }));
    });
  };

  const moveQuestion = (index, direction) => {
    setQuestions(prev => {
      if (direction === 'up' && index === 0) return prev;
      if (direction === 'down' && index === prev.length - 1) return prev;

      const targetIndex = direction === 'up' ? index - 1 : index + 1;

      const newQuestions = [...prev];
      [newQuestions[index], newQuestions[targetIndex]] = [newQuestions[targetIndex], newQuestions[index]];
      return newQuestions;
    });
  };

  const updateQuestion = (index, field, value) => {
    setQuestions(prev => prev.map((q, i) => 
      i === index ? { ...q, [field]: value } : q
    ));
  };

  const updateQuestionMultiple = (index, updates) => {
    setQuestions(prev => prev.map((q, i) => 
      i === index ? { ...q, ...updates } : q
    ));
  };

  const addOption = (qIndex) => {
    setQuestions(prev => prev.map((q, i) =>
      i === qIndex ? { ...q, options: [...q.options, { option_text: '', next_question: null, score: 0, is_red_flag: false, media_url: '', media_type: 'image', media_items: null, emoji: '' }] } : q
    ));
  };

  const updateOption = (qIndex, oIndex, field, value) => {
    setQuestions(prev => prev.map((q, i) =>
      i === qIndex ? {
        ...q,
        options: q.options.map((opt, oi) => oi === oIndex ? { ...opt, [field]: value } : opt)
      } : q
    ));
  };

  const updateOptionMultiple = (qIndex, oIndex, updates) => {
    setQuestions(prev => prev.map((q, i) =>
      i === qIndex ? {
        ...q,
        options: q.options.map((opt, oi) => oi === oIndex ? { ...opt, ...updates } : opt)
      } : q
    ));
  };

  const removeOption = (qIndex, oIndex) => {
    setQuestions(prev => prev.map((q, i) =>
      i === qIndex ? {
        ...q,
        options: q.options.filter((_, oi) => oi !== oIndex)
      } : q
    ));
  };

  // Creates a new tier-N follow-up question in one step: appends it to the
  // end of the list (never inserted mid-array, so no other saved
  // next_question jump indices anywhere in the survey can shift), sets its
  // tier one below its parent's and points its parent_question_key at the
  // source question, and wires the clicked option's next_question straight
  // at it — replacing what used to be 4 separate manual steps (add question,
  // set tier, set parent, find it in the option's jump dropdown).
  // Adds a question to the subsection hanging off one option of question
  // `qIndex` — the Subsection Routing of survey_navigation_routing_logic.md.
  //
  // The activating option is written into the child's parent_question_key as
  // "<parent>:opt_<n>" so the condition is recorded explicitly rather than
  // inferred from whichever option happens to jump at the child. That matters
  // once a subsection holds more than one question: only the first is the
  // branch entry the parent option jumps to, and the rest are reached by
  // walking the subsection, so they would otherwise have no condition of their
  // own and could be mistaken for questions on every path.
  const addFollowUpQuestion = (qIndex, oIndex) => {
    setQuestions(prev => {
      const parentQ = prev[qIndex];
      if (!parentQ) return prev;
      const followUp = {
        id: `temp-${Date.now()}-${Math.random()}`,
        question_text: '',
        question_type: 'text',
        media_type: 'none',
        media_url: '',
        media_items: null,
        required: true,
        options: [],
        rating_max: 5,
        low_label: '',
        high_label: '',
        rating_style: 'number',
        rating_labels: null,
        allowed_file_types: '',
        max_file_size_mb: 10,
        matrix_rows: null,
        matrix_columns: null,
        matrix_multi: false,
        scale: '',
        score_threshold: null,
        score_rules: null,
        threshold_next_question: null,
        backward_question: null,
        tier: Math.min((Number(parentQ.tier) || 1) + 1, 5),
        parent_question_key: `q_${parentQ.id}:opt_${oIndex}`
      };
      const followUpIndex = prev.length;

      // Only the first question of a subsection is the option's jump target.
      // Later ones join the existing branch, so the option keeps pointing at
      // the entry question and the respondent walks the subsection in order.
      const branchAlreadyOpen = prev.some(
        (q, qi) => subsectionActivatorOf(q, parentQ, qi) === oIndex
      );
      const updated = branchAlreadyOpen ? prev : prev.map((q, i) => i === qIndex ? {
        ...q,
        options: q.options.map((opt, oi) => oi === oIndex ? { ...opt, next_question: followUpIndex } : opt)
      } : q);
      return [...updated, followUp];
    });
  };

  // Re-points an existing subsection at a different option of its parent, so
  // an author can change "shown when Do you drink? = Yes" to any other option
  // without rebuilding the branch. The parent's Jump Route moves with it when
  // this question is the branch entry, keeping the two halves consistent.
  const setSubsectionActivator = (childIdx, parentIdx, optionIndex) => {
    setQuestions(prev => {
      const child = prev[childIdx];
      const parentQ = prev[parentIdx];
      if (!child || !parentQ) return prev;

      const previousActivator = subsectionActivatorOf(child, parentQ, childIdx);
      const isBranchEntry = (parentQ.options || []).some(
        (opt, oi) => oi === previousActivator && opt.next_question === childIdx
      );
      const { parentRef } = parseParentRef(child.parent_question_key);

      return prev.map((q, i) => {
        if (i === childIdx) {
          return { ...q, parent_question_key: formatParentRef(parentRef || `q_${parentQ.id}`, optionIndex) };
        }
        if (i === parentIdx && isBranchEntry) {
          return {
            ...q,
            options: q.options.map((opt, oi) => {
              if (oi === previousActivator) return { ...opt, next_question: null };
              if (oi === optionIndex) return { ...opt, next_question: childIdx };
              return opt;
            }),
          };
        }
        return q;
      });
    });
  };

  const autoAssignScores = (qIndex) => {
    setQuestions(prev => prev.map((q, i) => 
      i === qIndex ? { 
        ...q, 
        options: q.options.map((opt, oi) => ({ ...opt, score: oi + 1 })) 
      } : q
    ));
  };

  const handleTranslate = async (lang) => {
    setIsTranslating(true);
    setTranslationLanguage(lang);
    setTranslationCompleted(false);
    
    const surveyToTranslate = {
      title,
      description,
      questions
    };

    try {
      const result = await translateSurvey(surveyToTranslate, lang.code);
      setTranslatedSurveyData(result);
      setTranslationCompleted(true);
    } catch (error) {
      console.error(error);
      const { showError } = useNotificationStore.getState();
      showError("Translation failed. Please try again.");
    } finally {
      setIsTranslating(false);
    }
  };

  const handleSaveTranslationAsNew = async () => {
    if (!translatedSurveyData) return;
    const { showSuccess, showError } = useNotificationStore.getState();
    setSaving(true);
    try {
      const newTitle = `${translatedSurveyData.title} (${translationLanguage.name})`;
      const survey = await createSurvey({ 
        title: newTitle, 
        category, 
        description: translatedSurveyData.description 
      });
      if (survey && survey.id) {
        await addQuestions(survey.id, prepareQuestionsForSave(translatedSurveyData.questions).map((q, idx) => ({ ...q, order: idx })));
        showSuccess(`New Survey Created: ${newTitle}`);
        setIsTranslationModalOpen(false);
        navigate('/surveys');
      }
    } catch (err) {
      showError("Error saving translated survey: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleOverwriteCurrentWithTranslation = () => {
    if (!translatedSurveyData) return;
    const { showSuccess } = useNotificationStore.getState();
    
    setTitle(translatedSurveyData.title);
    setDescription(translatedSurveyData.description);
    setQuestions(translatedSurveyData.questions);
    
    setIsTranslationModalOpen(false);
    showSuccess(`Survey updated in form to ${translationLanguage.name}. Click 'Save' to database to commit.`);
  };

  const handleOverwriteDatabase = async () => {
    if (!translatedSurveyData) return;
    const { showSuccess, showError } = useNotificationStore.getState();
    setSaving(true);
    try {
      await updateSurvey(id, { 
        title: translatedSurveyData.title, 
        category, 
        description: translatedSurveyData.description 
      });
      await clearQuestions(id);
      await addQuestions(id, prepareQuestionsForSave(translatedSurveyData.questions).map((q, idx) => ({ ...q, order: idx })));
      showSuccess('Changes Saved Successfully');
      setIsTranslationModalOpen(false);
      navigate('/surveys');
    } catch (err) {
      showError("Error overwriting survey: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveBoth = async () => {
    if (!translatedSurveyData) return;
    const { showSuccess, showError } = useNotificationStore.getState();
    if (!title) return showError('Survey title is required');
    const realQuestions = questions.filter(q => !q._is_section && q.question_type !== '_section');
    if (realQuestions.length === 0) return showError('Please add at least one question');

    setSaving(true);
    try {
      // 1. Save original
      let originalSurveyId = id;
      if (isEditMode) {
        await updateSurvey(id, { title, category, description });
        await clearQuestions(id);
        await addQuestions(id, prepareQuestionsForSave(questions).map((q, idx) => ({ ...q, order: idx })));
      } else {
        const survey = await createSurvey({ title, category, description });
        if (survey && survey.id) {
          originalSurveyId = survey.id;
          await addQuestions(survey.id, prepareQuestionsForSave(questions).map((q, idx) => ({ ...q, order: idx })));
        }
      }

      // 2. Save translated as new
      const translatedTitle = `${translatedSurveyData.title} (${translationLanguage.name})`;
      const translatedSurvey = await createSurvey({
        title: translatedTitle,
        category,
        description: translatedSurveyData.description
      });
      if (translatedSurvey && translatedSurvey.id) {
        await addQuestions(translatedSurvey.id, prepareQuestionsForSave(translatedSurveyData.questions).map((q, idx) => ({ ...q, order: idx })));
      }
      
      showSuccess(`Successfully saved both original and translated (${translationLanguage.name}) surveys!`);
      setIsTranslationModalOpen(false);
      navigate('/surveys');
    } catch (err) {
      showError("Error saving surveys: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const renderTranslationModal = () => {
    if (!isTranslationModalOpen) return null;

    return (
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        background: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 3500,
        animation: 'fade-in 0.3s ease-out'
      }} onClick={() => !isTranslating && setIsTranslationModalOpen(false)}>
        <div style={{
          background: 'var(--bg-card)',
          padding: '2.5rem',
          borderRadius: '20px',
          maxWidth: '650px',
          width: '90%',
          border: '1px solid var(--border)',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.3)',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.5rem',
          color: 'var(--text-main)'
        }} onClick={e => e.stopPropagation()}>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                width: '40px', height: '40px', borderRadius: '10px',
                background: 'rgba(99, 102, 241, 0.1)', color: 'var(--accent-primary)',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                <Languages size={22} />
              </div>
              <div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0 }}>Translate Survey</h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>Translate your entire survey to Indic languages</p>
              </div>
            </div>
            {!isTranslating && (
              <button 
                onClick={() => setIsTranslationModalOpen(false)}
                style={{ background: 'var(--bg-hover)', border: 'none', padding: '6px', borderRadius: '50%', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                <X size={18} />
              </button>
            )}
          </div>

          {isTranslating && (
            <div style={{ textAlign: 'center', padding: '3rem 0' }}>
              <Loader2 className="spin" size={48} color="var(--accent-primary)" style={{ margin: '0 auto 1.5rem' }} />
              <h4 style={{ fontWeight: 700, margin: '0 0 0.5rem' }}>Translating...</h4>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Translating your survey into <strong>{translationLanguage?.name}</strong> using Google Translate...</p>
            </div>
          )}

          {!isTranslating && translationCompleted && (
            <div style={{ textAlign: 'center', padding: '1.5rem 0' }}>
              <div style={{
                width: '64px', height: '64px', borderRadius: '50%',
                background: 'rgba(16, 185, 129, 0.1)', color: '#10b981',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 1.5rem'
              }}>
                <Save size={32} />
              </div>
              <h4 style={{ fontWeight: 800, fontSize: '1.4rem', margin: '0 0 0.5rem' }}>Translation Ready!</h4>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
                Your survey has been successfully translated to <strong>{translationLanguage?.name}</strong>.
              </p>

              {/* Translation Preview Box */}
              <div style={{ 
                textAlign: 'left', 
                background: 'var(--bg-main)', 
                padding: '1.25rem', 
                borderRadius: '12px', 
                maxHeight: '220px', 
                overflowY: 'auto', 
                marginBottom: '1.5rem',
                border: '1px solid var(--border)' 
              }}>
                <h5 style={{ fontWeight: 800, margin: '0 0 6px', fontSize: '0.85rem', color: 'var(--text-main)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Translated Title:</h5>
                <p style={{ margin: '0 0 14px', fontSize: '0.9rem', fontWeight: 600 }}>{translatedSurveyData?.title}</p>
                <h5 style={{ fontWeight: 800, margin: '0 0 6px', fontSize: '0.85rem', color: 'var(--text-main)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Translated Questions Preview:</h5>
                <ul style={{ margin: 0, paddingLeft: '1.2rem', fontSize: '0.85rem', color: 'var(--text-main)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {translatedSurveyData?.questions.map((q, idx) => (
                    <li key={idx} style={{ lineHeight: '1.4' }}>
                      <strong>Q{idx + 1}:</strong> {q.question_text} <span style={{ fontSize: '0.7rem', color: 'var(--accent-primary)', fontWeight: 600 }}>({q.question_type})</span>
                    </li>
                  ))}
                </ul>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <button 
                  className="primary" 
                  onClick={handleSaveBoth} 
                  disabled={saving}
                  style={{
                    height: '50px', borderRadius: '12px', fontSize: '0.95rem', fontWeight: 800,
                    boxShadow: '0 4px 15px rgba(99, 102, 241, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
                  }}
                >
                  {saving ? <Loader2 className="spin" size={18} /> : <Save size={18} />}
                  Save Both (Original & {translationLanguage?.name})
                </button>

                <button 
                  onClick={handleSaveTranslationAsNew} 
                  disabled={saving}
                  style={{
                    height: '50px', borderRadius: '12px', fontSize: '0.95rem', fontWeight: 700,
                    background: 'var(--bg-card)', border: '1px solid var(--border)', cursor: 'pointer',
                    color: 'var(--text-main)'
                  }}
                >
                  Save Translated Only (as New)
                </button>

                <button 
                  onClick={handleSave} 
                  disabled={saving}
                  style={{
                    height: '50px', borderRadius: '12px', fontSize: '0.95rem', fontWeight: 700,
                    background: 'var(--bg-card)', border: '1px solid var(--border)', cursor: 'pointer',
                    color: 'var(--text-main)'
                  }}
                >
                  Save Original Only
                </button>
                
                {isEditMode && (
                  <button 
                    onClick={handleOverwriteDatabase} 
                    disabled={saving}
                    style={{
                      height: '50px', borderRadius: '12px', fontSize: '0.95rem', fontWeight: 700,
                      background: 'none', border: '1px solid var(--border)', cursor: 'pointer',
                      color: 'var(--text-main)'
                    }}
                  >
                    Overwrite Database Entry
                  </button>
                )}

                <button 
                  onClick={handleOverwriteCurrentWithTranslation}
                  style={{
                    height: '50px', borderRadius: '12px', fontSize: '0.95rem', fontWeight: 700,
                    background: 'none', border: '1px solid var(--border)', cursor: 'pointer',
                    color: 'var(--text-main)'
                  }}
                >
                  Apply to Current Form (Review first)
                </button>
              </div>
            </div>
          )}

          {!isTranslating && !translationCompleted && (
            <div>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>Select a target Indic language to automatically translate this survey:</p>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
                gap: '12px',
                maxHeight: '300px',
                overflowY: 'auto',
                paddingRight: '6px'
              }}>
                {INDIC_LANGUAGES.map(lang => (
                  <button
                    key={lang.code}
                    onClick={() => handleTranslate(lang)}
                    style={{
                      padding: '12px',
                      borderRadius: '12px',
                      background: 'var(--bg-main)',
                      border: '1px solid var(--border)',
                      color: 'var(--text-main)',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.borderColor = 'var(--accent-primary)';
                      e.currentTarget.style.background = 'rgba(99, 102, 241, 0.05)';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.borderColor = 'var(--border)';
                      e.currentTarget.style.background = 'var(--bg-main)';
                    }}
                  >
                    <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>{lang.name}</span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{lang.nativeName}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  // Validate & Test (Play). Runs every structural check over the draft as it
  // stands right now — unsaved edits included — and shows the report. Test Mode
  // is only unlocked from that report, and only when there are no errors.
  const handleValidate = () => {
    setValidationResult(validateSurvey(questions, { title, description, category }));
  };

  const handleStartTestMode = () => {
    setValidationResult(null);
    setIsTestModeOpen(true);
  };

  // The draft in the exact shape the real respondent flow consumes, so Test
  // Mode exercises the same adapter, engine and branching rules as a live run.
  const testModeQuestions = useMemo(
    () => (isTestModeOpen ? draftToDbShape(questions) : null),
    [isTestModeOpen, questions]
  );

  const handleSave = async () => {
    const { showSuccess, showError } = useNotificationStore.getState();
    if (!title) return showError('Survey title is required');
    const realQuestions = questions.filter(q => !q._is_section && q.question_type !== '_section');
    if (realQuestions.length === 0) return showError('Please add at least one question');
    
    setSaving(true);
    try {
      if (isEditMode) {
        // Update Cycle
        await updateSurvey(id, { title, category, description });
        await clearQuestions(id);
        await addQuestions(id, prepareQuestionsForSave(questions).map((q, idx) => ({ ...q, order: idx })));
        showSuccess('Changes Saved Successfully');
        navigate('/surveys');
      } else {
        // Create Cycle
        const survey = await createSurvey({ title, category, description });
        if (survey && survey.id) {
          await addQuestions(survey.id, prepareQuestionsForSave(questions).map((q, idx) => ({ ...q, order: idx })));
          showSuccess('New Survey Created');
          navigate('/surveys');
        }
      }
    } catch (err) {
      showError("Error saving survey: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  if (id && loading && !title) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', color: 'var(--text-muted)' }}>
        <Loader2 className="spin" size={48} />
      {renderPreview()}
    </div>
  );
  }

  return (
    <div style={{ animation: 'fade-in 0.4s ease-out', maxWidth: '1400px', margin: '0 auto', paddingBottom: '5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              onClick={() => navigate('/surveys')}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer', padding: 0 }}
            >
              <ArrowLeft size={16} /> Back
            </button>
            <div style={{ width: '1px', height: '16px', background: 'var(--border)' }} />
            <h1 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0 }}>{isEditMode ? 'Edit Survey' : 'Create Survey'}</h1>
          </div>
          {isEditMode && (
            <p className="truncate" style={{ maxWidth: '100%', margin: 0, color: 'var(--text-muted)', fontSize: '0.8rem' }} title={`Modify the configuration for "${title}" in the ${category} category.`}>
              Modify the configuration for <span style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>"{title || '...'}"</span> in the <span style={{ fontWeight: 600 }}>{category}</span>.
            </p>
          )}
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            {isEditMode && <button disabled={saving} onClick={() => navigate('/surveys')} style={{ background: 'none', border: '1px solid var(--border)', height: '48px', padding: '0 1.5rem', borderRadius: '10px', cursor: 'pointer' }}>Cancel</button>}

            {!isEditMode && (
              <>
                <div ref={dropdownRef} style={{ position: 'relative' }}>
                  <button
                    onClick={() => setIsTemplateDropdownOpen(!isTemplateDropdownOpen)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      fontSize: '0.85rem',
                      fontWeight: 700,
                      padding: '0 1.5rem',
                      borderRadius: 'var(--radius)',
                      background: 'var(--bg-card)',
                      border: `1.5px solid ${isTemplateDropdownOpen ? 'var(--accent-primary)' : 'var(--border)'}`,
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      height: '48px',
                      color: 'var(--text-main)',
                      boxSizing: 'border-box',
                      boxShadow: isTemplateDropdownOpen ? '0 0 0 3px rgba(76, 140, 228, 0.15)' : 'none'
                    }}
                  >
                    <FileDown size={16} />
                    Download Template
                    <ChevronDown size={14} style={{
                      transition: 'transform 0.2s',
                      transform: isTemplateDropdownOpen ? 'rotate(180deg)' : 'none'
                    }} />
                  </button>
                  {isTemplateDropdownOpen && (
                    <div style={{
                      position: 'absolute',
                      top: 'calc(100% + 8px)',
                      right: 0,
                      width: '280px',
                      background: 'var(--bg-card)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius)',
                      boxShadow: 'var(--shadow)',
                      zIndex: 1000,
                      padding: '0.5rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px',
                      animation: 'fade-in 0.15s ease-out'
                    }}>
                      <button
                        onClick={() => {
                          downloadExcelTemplate().catch(err => {
                            console.error('Failed to generate Excel template:', err);
                            useNotificationStore.getState().showError('Failed to generate Excel template: ' + err.message);
                          });
                          setIsTemplateDropdownOpen(false);
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          padding: '10px',
                          borderRadius: '8px',
                          border: 'none',
                          background: 'none',
                          color: 'var(--text-main)',
                          cursor: 'pointer',
                          textAlign: 'left',
                          width: '100%',
                          transition: 'background 0.2s'
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'none'}
                      >
                        <Sparkles size={16} style={{ color: 'var(--accent-primary)' }} />
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontSize: '0.8rem', fontWeight: 700 }}>Automation Template</span>
                          <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Single sheet. AI translates it.</span>
                        </div>
                      </button>
                      <button
                        onClick={() => {
                          downloadManualExcelTemplate().catch(err => {
                            console.error('Failed to generate Manual Excel template:', err);
                            useNotificationStore.getState().showError('Failed to generate Manual Excel template: ' + err.message);
                          });
                          setIsTemplateDropdownOpen(false);
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          padding: '10px',
                          borderRadius: '8px',
                          border: 'none',
                          background: 'none',
                          color: 'var(--text-main)',
                          cursor: 'pointer',
                          textAlign: 'left',
                          width: '100%',
                          transition: 'background 0.2s'
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'none'}
                      >
                        <UserCheck size={16} style={{ color: '#10B981' }} />
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontSize: '0.8rem', fontWeight: 700 }}>Manual Template (13 Sheets)</span>
                          <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>All 13 sheets for manual translations.</span>
                        </div>
                      </button>
                    </div>
                  )}
                </div>
                
                <div ref={uploadDropdownRef} style={{ position: 'relative' }}>
                  <button
                    onClick={() => setIsUploadDropdownOpen(!isUploadDropdownOpen)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      fontSize: '0.85rem',
                      fontWeight: 700,
                      padding: '0 1.5rem',
                      borderRadius: 'var(--radius)',
                      background: 'var(--bg-card)',
                      border: `1.5px solid ${isUploadDropdownOpen ? 'var(--accent-primary)' : 'var(--border)'}`,
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      height: '48px',
                      color: 'var(--text-main)',
                      boxSizing: 'border-box',
                      boxShadow: isUploadDropdownOpen ? '0 0 0 3px rgba(76, 140, 228, 0.15)' : 'none'
                    }}
                  >
                    <Upload size={16} />
                    Upload Type
                    <ChevronDown size={14} style={{
                      transition: 'transform 0.2s',
                      transform: isUploadDropdownOpen ? 'rotate(180deg)' : 'none'
                    }} />
                  </button>
                  {isUploadDropdownOpen && (
                    <div style={{
                      position: 'absolute',
                      top: 'calc(100% + 8px)',
                      right: 0,
                      width: '280px',
                      background: 'var(--bg-card)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius)',
                      boxShadow: 'var(--shadow)',
                      zIndex: 1000,
                      padding: '0.5rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px',
                      animation: 'fade-in 0.15s ease-out'
                    }}>
                      <label
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          padding: '10px',
                          borderRadius: '8px',
                          border: 'none',
                          background: 'none',
                          color: 'var(--text-main)',
                          cursor: 'pointer',
                          textAlign: 'left',
                          width: '100%',
                          margin: 0,
                          boxSizing: 'border-box',
                          transition: 'background 0.2s'
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'none'}
                        title="Upload standard English sheet for AI automatic translation"
                      >
                        <Sparkles size={16} style={{ color: 'var(--accent-primary)' }} />
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontSize: '0.8rem', fontWeight: 700 }}>Upload Automation</span>
                          <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Single sheet. AI translates it.</span>
                        </div>
                        <input
                          type="file"
                          accept=".xlsx, .xls"
                          onChange={(e) => { handleAutomationUpload(e); setIsUploadDropdownOpen(false); }}
                          style={{ display: 'none' }}
                        />
                      </label>

                      <label
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          padding: '10px',
                          borderRadius: '8px',
                          border: 'none',
                          background: 'none',
                          color: 'var(--text-main)',
                          cursor: 'pointer',
                          textAlign: 'left',
                          width: '100%',
                          margin: 0,
                          boxSizing: 'border-box',
                          transition: 'background 0.2s'
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'none'}
                        title="Upload 13-sheet workbook with manual translations"
                      >
                        <UserCheck size={16} style={{ color: '#10B981' }} />
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontSize: '0.8rem', fontWeight: 700 }}>Upload Manually</span>
                          <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>13-sheet workbook, manual translations.</span>
                        </div>
                        <input
                          type="file"
                          accept=".xlsx, .xls"
                          onChange={(e) => { handleManualUpload(e); setIsUploadDropdownOpen(false); }}
                          style={{ display: 'none' }}
                        />
                      </label>
                    </div>
                  )}
                </div>
              </>
            )}
            <button
              type="button"
              onClick={handleValidate}
              title="Check the whole survey, then take it end to end"
              style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                fontSize: '0.85rem', fontWeight: 700, padding: '0 1.25rem',
                borderRadius: 'var(--radius)', background: 'rgba(16, 185, 129, 0.1)',
                border: '1.5px solid #10b981', color: '#10b981',
                cursor: 'pointer', transition: 'all 0.2s', height: '48px',
                boxSizing: 'border-box', whiteSpace: 'nowrap',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = '#10b981'; e.currentTarget.style.color = 'white'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(16, 185, 129, 0.1)'; e.currentTarget.style.color = '#10b981'; }}
            >
              <Play size={16} style={{ flexShrink: 0 }} /> Validate &amp; Test
            </button>
            <button className="primary" disabled={saving} onClick={handleSave} style={{ height: '48px', padding: '0 2rem', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              {saving ? <Loader2 className="spin" size={18} /> : <Save size={18} />}
              {isEditMode ? (saving ? 'Saving...' : 'Save Changes') : (saving ? 'Saving...' : 'Save')}
            </button>
        </div>
      </div>

      <div className="panel" style={{ marginBottom: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem', padding: '1.25rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.25rem' }}>
          <div>
            <label style={{ fontSize: '0.8rem', fontWeight: 700, display: 'block', marginBottom: '8px', color: 'var(--text-muted)' }}>SURVEY NAME <span style={{ color: '#ef4444' }}>*</span></label>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Technical Skills Assessment"
              maxLength={60}
              title={title}
              style={{ height: '46px', padding: '0 12px' }}
            />
          </div>
          <div>
            <label style={{ fontSize: '0.8rem', fontWeight: 700, display: 'block', marginBottom: '8px', color: 'var(--text-muted)' }}>SURVEY BRANCH <span style={{ color: '#ef4444' }}>*</span></label>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <select
                  value={isNewBatch ? 'ADD_NEW' : category}
                  onChange={(e) => {
                    if (e.target.value === 'ADD_NEW') {
                      setIsNewBatch(true);
                      setCategory('');
                    } else {
                      setIsNewBatch(false);
                      setCategory(e.target.value);
                    }
                  }}
                  style={{ height: '46px', padding: '0 12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-main)', color: 'var(--text-main)', fontSize: '0.9rem', width: '100%' }}
                >
                  {allBatches.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                  <option value="ADD_NEW" style={{ fontWeight: 600, color: 'var(--accent-primary)' }}>+ Add New Category...</option>
                </select>
                {isNewBatch && (
                  <input
                    autoFocus
                    placeholder="Enter new category name..."
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    style={{ height: '46px', padding: '0 12px', borderRadius: '8px', border: '1px solid var(--accent-primary)' }}
                  />
                )}
              </div>
              {!isNewBatch && category && (
                <button 
                  onClick={async () => {
                    const { showSuccess, showError } = useNotificationStore.getState();
                    const { deleteSurveysByCategory } = useSurveyStore.getState();
                    if (window.confirm(`Delete entire category "${category}"? This will delete all surveys in this category.`)) {
                      try {
                        await deleteSurveysByCategory(category);
                        showSuccess(`Category "${category}" deleted.`);
                        setCategory(allBatches.filter(b => b !== category)[0] || 'AI');
                      } catch {
                        showError('Failed to delete category');
                      }
                    }
                  }}
                  style={{
                    width: '46px',
                    height: '46px',
                    padding: 0,
                    flexShrink: 0,
                    background: 'rgba(239, 68, 68, 0.1)',
                    color: '#ef4444',
                    border: '1px solid rgba(239, 68, 68, 0.2)',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                  title="Delete Category"
                >
                  <Trash2 size={18} />
                </button>
              )}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <label style={{ fontSize: '0.8rem', fontWeight: 700, display: 'block', color: 'var(--text-muted)' }}>SURVEY DESCRIPTION <span style={{ color: '#ef4444' }}>*</span></label>
          <textarea 
            value={description} 
            onChange={e => setDescription(e.target.value)} 
            placeholder="e.g. This survey collects user feedback about our product's performance and usability."
            style={{ minHeight: '50px', width: '100%', resize: 'vertical' }}
          />
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        {questions.map((q, i) => {
          // Rendered nested under its parent's branch block below — skip here
          if (nestedChildIndexSet.has(i)) return null;

          let content;

          // ── Section divider card ──────────────────────────────────────
          if (q._is_section || q.question_type === '_section') {
            content = (
              <div key={q.id || i} style={
                {
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '14px',
                  padding: '0 4px',
                }
              }>
                {/* Colored accent line */}
                <div style={{
                  width: '6px', height: '48px', borderRadius: '4px',
                  background: 'linear-gradient(180deg,var(--accent-primary),rgba(99,102,241,0.25))',
                  flexShrink: 0,
                }} />
                {/* Editable label */}
                <input
                  value={q.section_label || ''}
                  onChange={e => {
                    const val = e.target.value;
                    setQuestions(prev => prev.map((item, idx) =>
                      idx === i ? { ...item, section_label: val } : item
                    ));
                  }}
                  placeholder="Section name (e.g. Self, General, Family)..."
                  style={{
                    flexGrow: 1,
                    height: '48px',
                    fontWeight: 800,
                    fontSize: '1rem',
                    letterSpacing: '0.02em',
                    borderRadius: '10px',
                    border: '2px dashed var(--border)',
                    background: 'var(--bg-card)',
                    padding: '0 16px',
                    color: 'var(--accent-primary)',
                  }}
                />
                {/* Question count badge between prev section and this */}
                <div style={{
                  padding: '4px 12px',
                  borderRadius: '999px',
                  background: 'rgba(99,102,241,0.08)',
                  border: '1px solid var(--accent-primary)',
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  color: 'var(--accent-primary)',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                }}>
                  {(() => {
                    // Count real questions between previous section and this one
                    let count = 0;
                    for (let j = i - 1; j >= 0; j--) {
                      if (questions[j]._is_section || questions[j].question_type === '_section') break;
                      count++;
                    }
                    return count > 0 ? `${count} Q above` : 'Section start';
                  })()}
                </div>
                {/* Remove section */}
                <button
                  onClick={() => setQuestions(prev => prev.filter((_, idx) => idx !== i))}
                  title="Remove Section"
                  style={{
                    padding: '8px', background: 'none', border: 'none',
                    color: '#ef4444', cursor: 'pointer', display: 'flex',
                    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}
                >
                  <Trash2 size={18} />
                </button>
              </div>
            );
          } else {
            // ── Real question card (+ nested branch of tier 2-5 follow-ups) ──
            content = renderQuestionBlock(i);
          }

          const isDropBefore = dropTarget?.index === i && dropTarget.position === 'before' && dragIndex !== i;
          const isDropAfter = dropTarget?.index === i && dropTarget.position === 'after' && dragIndex !== i;

          return (
            <div
              key={`drag-row-${q.id || i}`}
              draggable
              onDragStart={(e) => {
                setDragIndex(i);
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', String(i));
              }}
              onDragEnd={() => { setDragIndex(null); setDropTarget(null); }}
              onDragOver={(e) => {
                e.preventDefault();
                if (dragIndex === null || dragIndex === i) return;
                const rect = e.currentTarget.getBoundingClientRect();
                const position = (e.clientY - rect.top) < rect.height / 2 ? 'before' : 'after';
                setDropTarget({ index: i, position });
              }}
              onDrop={(e) => {
                e.preventDefault();
                if (dragIndex !== null && dragIndex !== i) {
                  reorderQuestions(dragIndex, dropTarget?.position === 'after' ? i + 1 : i);
                }
                setDragIndex(null);
                setDropTarget(null);
              }}
              style={{ display: 'flex', alignItems: 'flex-start', gap: '6px' }}
            >
              <div
                title="Drag to reorder or move to another section"
                style={{
                  cursor: dragIndex === i ? 'grabbing' : 'grab',
                  color: 'var(--text-muted)',
                  paddingTop: '14px',
                  flexShrink: 0,
                  opacity: dragIndex === i ? 0.4 : 0.6,
                }}
              >
                <GripVertical size={18} />
              </div>
              <div style={{
                flex: 1,
                minWidth: 0,
                borderTop: isDropBefore ? '3px solid var(--accent-primary)' : '3px solid transparent',
                borderBottom: isDropAfter ? '3px solid var(--accent-primary)' : '3px solid transparent',
                opacity: dragIndex === i ? 0.4 : 1,
                transition: 'opacity 0.15s, border-color 0.15s',
              }}>
                {content}
              </div>
            </div>
          );
        })}
      </div>

      {questions.length === 0 && (
        <div className="panel" style={{
          padding: '1.75rem 2rem',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          gap: '0.75rem',
          border: '1px dashed var(--border)'
        }}>
          <div style={{
            width: '56px',
            height: '56px',
            borderRadius: '50%',
            background: 'rgba(var(--accent-primary-rgb), 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--accent-primary)'
          }}>
            <ClipboardList size={26} />
          </div>
          <div style={{ fontWeight: 700, fontSize: '1rem' }}>No questions yet</div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', maxWidth: '420px', margin: 0 }}>
            Add your first question to start building the survey. Choose from short text, multiple choice, ratings, and more.
          </p>
          <div style={{ display: 'flex', gap: '10px', marginTop: '0.75rem' }}>
            <button
              onClick={() => addSection()}
              style={{
                height: '44px', 
                padding: '0 1.5rem', 
                borderRadius: '10px',
                background: 'rgba(76, 140, 228, 0.08)', 
                border: '1px solid var(--accent-primary)',
                color: 'var(--accent-primary)', 
                fontWeight: 700, 
                fontSize: '0.85rem',
                cursor: 'pointer', 
                display: 'flex', 
                alignItems: 'center', 
                gap: '6px',
                transition: 'all 0.2s'
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(76, 140, 228, 0.15)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(76, 140, 228, 0.08)'; }}
            >
              <Plus size={16} /> Add Section
            </button>
            <button
              className="primary"
              onClick={addQuestion}
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0 1.5rem', height: '44px', borderRadius: '10px' }}
            >
              <Plus size={16} /> Add First Question
            </button>
          </div>
        </div>
      )}

      {questions.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '2rem' }}>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <button
              onClick={() => addSection()}
              style={{
                height: '48px',
                padding: '0 1.5rem',
                borderRadius: '10px',
                background: 'rgba(76, 140, 228, 0.08)',
                border: '1px solid var(--accent-primary)',
                color: 'var(--accent-primary)',
                fontWeight: 700,
                fontSize: '0.9rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'all 0.2s'
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(76, 140, 228, 0.15)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(76, 140, 228, 0.08)'; }}
            >
              <Plus size={16} /> Add Section
            </button>
            <button
              className="primary"
              onClick={addQuestion}
              style={{
                padding: '12px 24px',
                fontSize: '0.9rem',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                borderRadius: '10px',
                boxShadow: '0 4px 15px rgba(99, 102, 241, 0.2)'
              }}
            >
              <Plus size={18} /> Add Question
            </button>
          </div>

          <button
            className="primary" 
            disabled={saving} 
            onClick={handleSave} 
            style={{ 
              height: '48px', 
              padding: '0 2rem', 
              borderRadius: '10px', 
              display: 'flex', 
              alignItems: 'center', 
              gap: '8px' 
            }}
          >
            {saving ? <Loader2 className="spin" size={18} /> : <Save size={18} />}
            {isEditMode ? (saving ? 'Saving...' : 'Save Changes') : (saving ? 'Saving...' : 'Save')}
          </button>
        </div>
      )}

      {/* Floating Navigator for 100+ questions */}
      {questions.length > 5 && (
        <div className="floating-nav">
          <div style={{ fontSize: '0.6rem', fontWeight: 800, color: 'var(--text-muted)', textAlign: 'center', marginBottom: '5px' }}>NAV</div>
          {questions.map((_, i) => (
            <button 
              key={i}
              onClick={() => {
                const el = document.querySelectorAll('.panel')[i+1];
                el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }}
              style={{ 
                width: '100%',
                aspectRatio: '1/1',
                fontSize: '0.7rem', 
                padding: 0, 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                background: 'var(--bg-main)',
                border: '1px solid var(--border)',
                borderRadius: '6px'
              }}
            >
              {i + 1}
            </button>
          ))}
        </div>
      )}
    {renderPreview()}
    {renderTranslationModal()}
    {renderUploadPreviewModal()}
    <ValidationReportModal
      result={validationResult}
      onClose={() => setValidationResult(null)}
      onStartTest={handleStartTestMode}
    />
    {isTestModeOpen && testModeQuestions && (
      <SurveyForm
        draftQuestions={testModeQuestions}
        draftTitle={title}
        onClosePreview={() => setIsTestModeOpen(false)}
      />
    )}
    </div>
  );
};

export default SurveyBuilder;
