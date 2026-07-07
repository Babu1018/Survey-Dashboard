import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import useSurveyStore from '../store/useSurveyStore';
import useAuthStore from '../store/useAuthStore';
import { 
  Plus,
  Eye, 
  Save, 
  Trash2, 
  Video, 
  Mic, 
  ClipboardList,
  X,
  Upload,
  Loader2,
  Link as LinkIcon,
  Image as ImageIcon,
  Edit3,
  ListOrdered,
  Copy,
  Flag,
  Languages,
  Sparkles,
  UserCheck,
  FileDown,
  ChevronDown
} from 'lucide-react';
import React from 'react';
import useNotificationStore from '../store/useNotificationStore';
import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';
import { INDIC_LANGUAGES, translateSurvey } from '../utils/translater';

const API = 'http://localhost:8000';

const parseExcelSheet = (sheet) => {
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  if (!rows || rows.length === 0) return null;
  
  let parsedTitle = '';
  let parsedDescription = '';
  let parsedCategory = '';
  let headerRowIndex = -1;

  for (let r = 0; r < Math.min(rows.length, 10); r++) {
    const row = rows[r];
    if (!row || row.length === 0) continue;
    
    const key = String(row[0]).trim().toLowerCase();
    if (key === 'survey name' || key === 'title' || key === 'survey title') {
      parsedTitle = row[1] ? String(row[1]).trim() : '';
    } else if (key === 'survey description' || key === 'description' || key === 'survey description') {
      parsedDescription = row[1] ? String(row[1]).trim() : '';
    } else if (key === 'category') {
      parsedCategory = row[1] ? String(row[1]).trim() : '';
    } else if (row.includes('Question Text') || row.includes('Question Text*') || row.some(cell => String(cell).includes('Question Text'))) {
      headerRowIndex = r;
      break;
    }
  }

  if (headerRowIndex === -1) {
    return null;
  }

  const parsedQuestions = [];
  const headerRow = rows[headerRowIndex];
  
  const colMap = {};
  headerRow.forEach((cell, idx) => {
    if (!cell) return;
    const normalized = String(cell).trim().toLowerCase();
    if (normalized.includes("question text")) colMap.questionText = idx;
    else if (normalized.includes("question type") || normalized.includes("answer type")) colMap.questionType = idx;
    else if (normalized.includes("required")) colMap.required = idx;
    else if (normalized.includes("options")) colMap.options = idx;
    else if (normalized.includes("scores")) colMap.optionScores = idx;
    else if (normalized.includes("red flags")) colMap.optionRedFlags = idx;
    else if (normalized.includes("option jumps") || normalized.includes("next_question")) colMap.optionJumps = idx;
    else if (normalized.includes("scale")) colMap.scale = idx;
    else if (normalized.includes("score threshold")) colMap.scoreThreshold = idx;
    else if (normalized.includes("threshold jump")) colMap.thresholdJump = idx;
    else if (normalized.includes("rating max")) colMap.ratingMax = idx;
    else if (normalized.includes("low label")) colMap.lowLabel = idx;
    else if (normalized.includes("high label")) colMap.highLabel = idx;
  });

  if (colMap.questionText === undefined) {
    return null;
  }

  for (let r = headerRowIndex + 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row || row.length === 0) continue;
    
    const questionText = colMap.questionText !== undefined ? row[colMap.questionText] : null;
    if (!questionText || String(questionText).trim() === '') continue;

    let questionType = colMap.questionType !== undefined && row[colMap.questionType]
      ? String(row[colMap.questionType]).trim().toLowerCase()
      : 'text';

    if (questionType === 'short') {
      questionType = 'text';
    } else if (questionType === 'paragraph') {
      questionType = 'long_text';
    } else if (questionType === 'single choose' || questionType === 'radio') {
      questionType = 'radio';
    } else if (questionType === 'multi choose' || questionType === 'check box' || questionType === 'checkbox') {
      questionType = 'checkbox';
    } else if (questionType === 'score') {
      questionType = 'select';
    }
      
    const requiredStr = colMap.required !== undefined && row[colMap.required]
      ? String(row[colMap.required]).trim().toLowerCase()
      : 'yes';
    const required = requiredStr === 'yes' || requiredStr === 'y' || requiredStr === 'true' || requiredStr === '1';

    const optionsStr = colMap.options !== undefined && row[colMap.options] ? String(row[colMap.options]).trim() : '';
    const scoresStr = colMap.optionScores !== undefined && row[colMap.optionScores] ? String(row[colMap.optionScores]).trim() : '';
    const redFlagsStr = colMap.optionRedFlags !== undefined && row[colMap.optionRedFlags] ? String(row[colMap.optionRedFlags]).trim() : '';
    const jumpsStr = colMap.optionJumps !== undefined && row[colMap.optionJumps] ? String(row[colMap.optionJumps]).trim() : '';

    const optionsArray = optionsStr ? optionsStr.split(';').map(o => o.trim()) : [];
    const scoresArray = scoresStr ? scoresStr.split(';').map(s => parseInt(s.trim(), 10) || 0) : [];
    const redFlagsArray = redFlagsStr ? redFlagsStr.split(';').map(rf => {
      const s = rf.trim().toLowerCase();
      return s === 'yes' || s === 'y' || s === 'true' || s === '1';
    }) : [];
    const jumpsArray = jumpsStr ? jumpsStr.split(';').map(j => j.trim()) : [];

    const options = optionsArray.map((optText, oIdx) => {
      let jumpVal = null;
      const rawJump = jumpsArray[oIdx];
      if (rawJump) {
        const normalizedJump = rawJump.toLowerCase();
        if (normalizedJump === 'end' || normalizedJump === '-1' || normalizedJump === 'submit') {
          jumpVal = -1;
        } else if (normalizedJump === 'next') {
          jumpVal = null;
        } else {
          const parsedNum = parseInt(rawJump, 10);
          if (!isNaN(parsedNum)) {
            jumpVal = parsedNum;
          }
        }
      }

      return {
        option_text: optText,
        next_question: jumpVal,
        score: scoresArray[oIdx] !== undefined ? scoresArray[oIdx] : 0,
        is_red_flag: redFlagsArray[oIdx] !== undefined ? redFlagsArray[oIdx] : false,
        media_url: ''
      };
    });

    const scale = colMap.scale !== undefined && row[colMap.scale] ? String(row[colMap.scale]).trim() : '';
    const scoreThreshold = colMap.scoreThreshold !== undefined && row[colMap.scoreThreshold] !== undefined
      ? parseInt(row[colMap.scoreThreshold], 10)
      : null;

    let thresholdNextQuestion = null;
    if (colMap.thresholdJump !== undefined && row[colMap.thresholdJump]) {
      const rawTJump = String(row[colMap.thresholdJump]).trim().toLowerCase();
      if (rawTJump === 'end' || rawTJump === '-1' || rawTJump === 'submit') {
        thresholdNextQuestion = -1;
      } else {
        const parsedNum = parseInt(rawTJump, 10);
        if (!isNaN(parsedNum)) {
          thresholdNextQuestion = parsedNum;
        }
      }
    }

    const ratingMax = colMap.ratingMax !== undefined && row[colMap.ratingMax] !== undefined
      ? parseInt(row[colMap.ratingMax], 10) || 5
      : 5;
    const lowLabel = colMap.lowLabel !== undefined && row[colMap.lowLabel] ? String(row[colMap.lowLabel]).trim() : '';
    const highLabel = colMap.highLabel !== undefined && row[colMap.highLabel] ? String(row[colMap.highLabel]).trim() : '';

    parsedQuestions.push({
      id: `temp-${Date.now()}-${Math.random()}`,
      question_text: String(questionText).trim(),
      question_type: questionType,
      media_type: 'none',
      media_url: '',
      required,
      options,
      rating_max: ratingMax,
      low_label: lowLabel,
      high_label: highLabel,
      scale,
      score_threshold: isNaN(scoreThreshold) ? null : scoreThreshold,
      threshold_next_question: thresholdNextQuestion
    });
  }

  parsedQuestions.forEach(q => {
    q.options.forEach(opt => {
      if (opt.next_question !== null && opt.next_question !== undefined) {
        if (opt.next_question === -1) {
          opt.next_question = -1;
        } else {
          const targetQuestionNum = opt.next_question;
          if (targetQuestionNum >= 1 && targetQuestionNum <= parsedQuestions.length) {
            opt.next_question = targetQuestionNum - 1;
          } else {
            opt.next_question = null;
          }
        }
      }
    });

    if (q.threshold_next_question !== null && q.threshold_next_question !== undefined) {
      if (q.threshold_next_question === -1) {
        q.threshold_next_question = -1;
      } else {
        const targetQuestionNum = q.threshold_next_question;
        if (targetQuestionNum >= 1 && targetQuestionNum <= parsedQuestions.length) {
          q.threshold_next_question = targetQuestionNum - 1;
        } else {
          q.threshold_next_question = null;
        }
      }
    }
  });

  return {
    title: parsedTitle || 'Uploaded Survey',
    description: parsedDescription || '',
    category: parsedCategory || 'AI',
    questions: parsedQuestions
  };
};

const CompactMediaUpload = ({ onUpload, disabled }) => {
  const [uploading, setUploading] = useState(false);
  const token = useAuthStore(state => state.token);
  const fileInputRef = useRef(null);

  const handleUpload = async (file) => {
    if (!file) return;
    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch(`${API}/api/surveys/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData,
      });
      if (!response.ok) throw new Error('Upload failed with status ' + response.status);
      
      const data = await response.json();
      
      let type = 'none';
      if (file.type.startsWith('image/')) type = 'image';
      else if (file.type.startsWith('video/')) type = 'video';
      else if (file.type.startsWith('audio/')) type = 'audio';
      
      onUpload(data.url, type);
    } catch (error) {
      console.error("Upload failed", error);
      const { showError } = useNotificationStore.getState();
      showError("Upload failed. Ensure backend is running.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div style={{ display: 'inline-block' }}>
      <input 
        ref={fileInputRef}
        type="file" 
        style={{ display: 'none' }} 
        disabled={disabled}
        onChange={(e) => {
          handleUpload(e.target.files[0]);
          e.target.value = null;
        }}
      />
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading || disabled}
        style={{
          height: '40px',
          padding: '0 1rem',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontSize: '0.85rem',
          fontWeight: 700,
          background: disabled ? 'var(--border)' : 'var(--accent-primary)',
          color: disabled ? 'var(--text-muted)' : 'white',
          border: 'none',
          borderRadius: '8px',
          cursor: disabled ? 'not-allowed' : 'pointer',
          whiteSpace: 'nowrap',
          opacity: disabled ? 0.6 : 1
        }}
      >
        {uploading ? <Loader2 className="spin" size={14} color="white" /> : <Upload size={14} />}
        {uploading ? 'Uploading...' : 'Upload File'}
      </button>
    </div>
  );
};

const OptionMediaInput = ({ currentUrl, onUpdate }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const token = useAuthStore(state => state.token);
  const fileInputRef = useRef(null);

  const handleUpload = async (file) => {
    if (!file) return;
    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch(`${API}/api/surveys/upload`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData,
      });
      if (!response.ok) throw new Error('Upload failed');
      const data = await response.json();
      onUpdate(data.url);
    } catch (error) {
      console.error(error);
      const { showError } = useNotificationStore.getState();
      showError("Upload failed.");
    } finally {
      setUploading(false);
    }
  };

  const onDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleUpload(file);
  };

  return (
    <div 
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={onDrop}
      style={{ 
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        border: `1px solid ${isDragging ? 'var(--accent-primary)' : 'var(--border)'}`,
        background: isDragging ? 'var(--bg-hover)' : 'var(--bg-main)',
        borderRadius: '6px',
        width: '100%',
        height: '36px',
        transition: 'all 0.2s',
        overflow: 'hidden'
      }}
    >
      <input 
        value={currentUrl || ''}
        onChange={(e) => onUpdate(e.target.value)}
        placeholder="URL or Drop file"
        style={{ 
          border: 'none', 
          background: 'transparent',
          padding: '8px 30px 8px 10px', 
          fontSize: '0.75rem',
          width: '100%',
          height: '100%',
          outline: 'none',
          color: 'var(--text-main)'
        }}
      />
      <button
        onClick={() => fileInputRef.current?.click()}
        style={{
          position: 'absolute',
          right: '4px',
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: '4px',
          padding: '4px',
          cursor: 'pointer',
          color: 'var(--text-muted)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
        title="Upload Media"
      >
        {uploading ? <Loader2 className="spin" size={12} /> : <Upload size={12} />}
      </button>
      <input 
        ref={fileInputRef}
        type="file" 
        accept="image/*,video/*,audio/*"
        style={{ display: 'none' }} 
        onChange={(e) => {
          handleUpload(e.target.files[0]);
          e.target.value = null;
        }}
      />
    </div>
  );
};

const QuestionCard = React.memo(({ 
  q, 
  i, 
  total,
  questions,
  updateQuestion, 
  updateQuestionMultiple, 
  removeQuestion, 
  duplicateQuestion, 
  addOption,
  updateOption,
  removeOption,
  openPreview
}) => {
  return (
    <div className="panel" style={{ borderLeft: '6px solid var(--accent-primary)', padding: '1.25rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <div style={{ 
            width: '32px', 
            height: '32px', 
            borderRadius: '50%', 
            background: 'var(--accent-primary)', 
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 800,
            fontSize: '0.9rem'
          }}>{i + 1}</div>
          <div style={{ fontWeight: 700, color: 'var(--accent-primary)', fontSize: '0.9rem' }}>SETTINGS</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
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

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '6fr 4fr', gap: '1.5rem', alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '8px' }}>QUESTION</label>
            <input 
              value={q.question_text} 
              onChange={e => updateQuestion(i, 'question_text', e.target.value)}
              placeholder="Enter your question here..."
              style={{ height: '40px', width: '100%', borderRadius: '8px' }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '8px' }}>MEDIA TYPE</label>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', width: '100%' }}>
              <select 
                value={q.media_type || 'none'}
                onChange={e => {
                  const val = e.target.value;
                  updateQuestionMultiple(i, { media_type: val, media_url: val === 'none' ? '' : q.media_url });
                }}
                style={{ fontSize: '0.85rem', padding: '8px', height: '40px', borderRadius: '8px', width: '120px', flexShrink: 0, fontWeight: 600 }}
              >
                <option value="none">None</option>
                <option value="image">Image</option>
                <option value="video">Video</option>
                <option value="audio">Audio</option>
              </select>

              <CompactMediaUpload 
                disabled={!q.media_type || q.media_type === 'none'}
                onUpload={(url, type) => {
                  updateQuestionMultiple(i, { media_url: url, media_type: type });
                }} 
              />
              <div style={{ position: 'relative', flexGrow: 1 }}>
                <LinkIcon size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', opacity: (!q.media_type || q.media_type === 'none') ? 0.5 : 1 }} />
                <input 
                  value={q.media_url || ''} 
                  disabled={!q.media_type || q.media_type === 'none'}
                  onChange={e => updateQuestion(i, 'media_url', e.target.value)}
                  placeholder="Paste URL..."
                  style={{ 
                    paddingLeft: '32px', 
                    fontSize: '0.85rem', 
                    height: '40px', 
                    borderRadius: '8px',
                    cursor: (!q.media_type || q.media_type === 'none') ? 'not-allowed' : 'text',
                    opacity: (!q.media_type || q.media_type === 'none') ? 0.6 : 1
                  }}
                />
              </div>
            </div>

            {q.media_url && (
              <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                 <div 
                   title={q.media_url.split('/').pop()}
                   className="truncate"
                   style={{ fontSize: '0.7rem', color: 'var(--accent-primary)', fontWeight: 600, maxWidth: '200px' }}
                 >
                   {q.media_url.split('/').pop()}
                 </div>
                 <button 
                  onClick={() => { updateQuestionMultiple(i, { media_url: '', media_type: 'none' }); }}
                  style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: '0.7rem', padding: 0, flexShrink: 0, cursor: 'pointer' }}
                 >
                   (Remove)
                 </button>
              </div>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', borderTop: '1px solid var(--border)', paddingTop: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
            <div style={{ width: '250px' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '8px' }}>ANSWER TYPE</label>
              <select 
                value={q.question_type} 
                onChange={e => updateQuestion(i, 'question_type', e.target.value)}
                style={{ fontWeight: 600 }}
              >
                <option value="text">Short Text Answer</option>
                <option value="long_text">Paragraph Answer</option>
                <option value="radio">Single Choice (Radio Buttons)</option>
                <option value="checkbox">Multiple Choice (Checkboxes)</option>
                <option value="select">Score Method</option>
                <option value="rating">Numeric Rating Scale</option>
              </select>
            </div>
            <div style={{ width: '140px' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '8px' }}>REQUIRED</label>
              <select 
                value={q.required ? 'true' : 'false'} 
                onChange={e => updateQuestion(i, 'required', e.target.value === 'true')}
                style={{ fontWeight: 600 }}
              >
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
            </div>
          </div>

          <div style={{ width: '100%' }}>
            {q.question_type === 'rating' && (
              <div style={{ background: 'var(--bg-main)', padding: '1.25rem', borderRadius: '10px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block' }}>RATING SETTINGS</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 2fr', gap: '10px' }}>
                  <div>
                    <label style={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--text-muted)' }}>Max (e.g. 10)</label>
                    <input 
                      type="number" 
                      value={q.rating_max || 5} 
                      onChange={e => updateQuestion(i, 'rating_max', parseInt(e.target.value))}
                      style={{ height: '36px', fontSize: '0.8rem' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--text-muted)' }}>Low Label (Optional)</label>
                    <input 
                      value={q.low_label || ''} 
                      onChange={e => updateQuestion(i, 'low_label', e.target.value)}
                      placeholder="e.g. Disagree"
                      style={{ height: '36px', fontSize: '0.8rem' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--text-muted)' }}>High Label (Optional)</label>
                    <input 
                      value={q.high_label || ''} 
                      onChange={e => updateQuestion(i, 'high_label', e.target.value)}
                      placeholder="e.g. Agree"
                      style={{ height: '36px', fontSize: '0.8rem' }}
                    />
                  </div>
                </div>
              </div>
            )}

            {(q.question_type === 'radio' || q.question_type === 'checkbox' || q.question_type === 'select') && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Choice Options</label>
                  <button 
                    onClick={() => addOption(i)}
                    style={{ 
                      fontSize: '0.75rem', 
                      padding: '6px 12px', 
                      border: '1px solid var(--accent-primary)', 
                      background: 'rgba(99, 102, 241, 0.05)', 
                      color: 'var(--accent-primary)',
                      borderRadius: '8px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.background = 'var(--accent-primary)';
                      e.currentTarget.style.color = 'white';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.background = 'rgba(99, 102, 241, 0.05)';
                      e.currentTarget.style.color = 'var(--accent-primary)';
                    }}
                  >
                    + Add Option
                  </button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
                  {q.options.map((opt, oIdx) => (
                    <div key={oIdx} style={{ display: 'flex', flexDirection: 'column', gap: '8px', background: 'var(--bg-main)', padding: '12px', borderRadius: '12px', border: '1px solid var(--border)', position: 'relative' }}>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <input 
                          value={opt.option_text || ''}
                          onChange={e => updateOption(i, oIdx, 'option_text', e.target.value)}
                          placeholder={`Choice ${oIdx + 1} text...`}
                          style={{ flexGrow: 1, padding: '8px 10px', fontSize: '0.85rem', fontWeight: 600, height: '36px', borderRadius: '8px' }}
                        />
                        {q.question_type === 'select' && (
                          <div style={{ width: '60px', display: 'flex', alignItems: 'center', background: 'var(--bg-card)', padding: '2px 6px', borderRadius: '8px', border: '1px solid var(--border)', height: '36px' }}>
                            <input 
                              type="number"
                              value={opt.score || 0}
                              onChange={e => updateOption(i, oIdx, 'score', parseInt(e.target.value) || 0)}
                              style={{ width: '100%', border: 'none', background: 'transparent', fontSize: '0.85rem', fontWeight: 800, textAlign: 'center', outline: 'none' }}
                              title="Score"
                            />
                          </div>
                        )}
                        <button 
                          onClick={() => removeOption(i, oIdx)}
                          style={{ 
                            width: '52px',
                            height: '36px',
                            background: 'rgba(239, 68, 68, 0.05)', 
                            color: '#ef4444', 
                            border: '1px solid rgba(239, 68, 68, 0.15)',
                            borderRadius: '8px',
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
                          <X size={20} strokeWidth={2.5} />
                        </button>
                      </div>

                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        {q.question_type !== 'select' && (
                          <select 
                            value={opt.next_question === null || opt.next_question === undefined ? '' : opt.next_question}
                            onChange={e => updateOption(i, oIdx, 'next_question', e.target.value === '' ? null : parseInt(e.target.value))}
                            style={{ flexGrow: 1, padding: '8px', fontSize: '0.75rem', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '8px', fontWeight: 600, height: '36px' }}
                            title="Navigation (Go to Question...)"
                          >
                            <option value="">Next Question</option>
                            <option value="-1">End of Survey</option>
                            {Array.from({ length: total }).map((_, targetIdx) => (
                               <option key={targetIdx} value={targetIdx}>Go to Q{targetIdx + 1}</option>
                            ))}
                          </select>
                        )}
                        <div style={{ flexGrow: 1, minWidth: 0 }}>
                          <OptionMediaInput 
                            currentUrl={opt.media_url} 
                            onUpdate={(url) => updateOption(i, oIdx, 'media_url', url)} 
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {q.question_type === 'select' && (
                  <div style={{ 
                    background: 'linear-gradient(145deg, rgba(99, 102, 241, 0.03), rgba(99, 102, 241, 0.08))', 
                    padding: '1.5rem', 
                    borderRadius: '16px', 
                    marginTop: '2rem', 
                    border: '1px dashed var(--accent-primary)',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.02)',
                    position: 'relative',
                    overflow: 'hidden'
                  }}>
                    <div style={{ 
                      position: 'absolute', 
                      top: 0, 
                      right: 0, 
                      padding: '8px 12px', 
                      background: 'var(--accent-primary)', 
                      color: 'white', 
                      fontSize: '0.6rem', 
                      fontWeight: 800, 
                      borderBottomLeftRadius: '12px',
                      letterSpacing: '1px'
                    }}>
                      SCORE BRANCHING LOGIC
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1.5rem' }}>
                      <div style={{ 
                        width: '32px', 
                        height: '32px', 
                        borderRadius: '8px', 
                        background: 'rgba(var(--accent-primary-rgb), 0.1)', 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center',
                        color: 'var(--accent-primary)'
                      }}>
                        <ListOrdered size={18} />
                      </div>
                      <div>
                        <h4 style={{ fontSize: '0.9rem', fontWeight: 700, margin: 0 }}>Cumulative Score Redirection</h4>
                        <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', margin: 0 }}>Select questions to combine their points and trigger logic jumps</p>
                      </div>
                    </div>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '1.5rem' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', gridColumn: 'span 2' }}>
                        <label style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <ClipboardList size={12} /> COMBINE SCORES FROM THESE QUESTIONS
                        </label>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', padding: '10px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', minHeight: '42px' }}>
                          {questions && questions.map((otherQ, qIdx) => {
                            if (otherQ.question_type !== 'radio' && otherQ.question_type !== 'checkbox' && otherQ.question_type !== 'select') return null;
                            const isSelected = (q.scale || '').split(',').includes(String(qIdx));
                            const isSelf = qIdx === i;
                            return (
                              <button
                                key={qIdx}
                                onClick={() => {
                                  const current = (q.scale || '').split(',').filter(x => x !== '');
                                  const next = isSelected ? current.filter(x => x !== String(qIdx)) : [...current, String(qIdx)];
                                  updateQuestion(i, 'scale', next.join(','));
                                }}
                                style={{
                                  padding: '6px 12px',
                                  borderRadius: '8px',
                                  fontSize: '0.75rem',
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                  background: isSelected ? 'var(--accent-primary)' : 'var(--bg-main)',
                                  color: isSelected ? 'white' : 'var(--text-muted)',
                                  border: `1px solid ${isSelected ? 'var(--accent-primary)' : 'var(--border)'}`,
                                  transition: 'all 0.2s',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px'
                                }}
                              >
                                <span>Q{qIdx + 1} {isSelf && '(Self)'}</span>
                              </button>
                            );
                          })}
                          {(!q.scale || q.scale.length === 0) && <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontStyle: 'italic', padding: '4px 0' }}>Select score questions above to form a logic cluster...</span>}
                        </div>
                      </div>
                      
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <label style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <ClipboardList size={12} /> CUMULATIVE SCORE THRESHOLD
                        </label>
                        <input 
                          type="number"
                          value={q.score_threshold ?? ''} 
                          onChange={e => updateQuestion(i, 'score_threshold', e.target.value === '' ? null : parseInt(e.target.value))}
                          placeholder="Min points total..."
                          style={{ 
                            height: '42px', 
                            fontSize: '0.85rem', 
                            background: 'var(--bg-card)', 
                            border: '1px solid var(--border)',
                            borderRadius: '8px',
                            fontWeight: 800,
                            padding: '0 12px',
                            textAlign: 'center',
                            color: 'var(--accent-primary)'
                          }}
                        />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <label style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Edit3 size={12} /> JUMP TO QUESTION
                        </label>
                        <select 
                          value={q.threshold_next_question ?? ''}
                          onChange={e => updateQuestion(i, 'threshold_next_question', e.target.value === '' ? null : parseInt(e.target.value))}
                          style={{ 
                            height: '42px', 
                            fontSize: '0.85rem', 
                            background: 'var(--bg-card)', 
                            border: '1px solid var(--border)',
                            borderRadius: '8px',
                            fontWeight: 700,
                            padding: '0 12px'
                          }}
                        >
                          <option value="">No Logic Jump</option>
                          <option value="-1">End of Survey / Results</option>
                          {Array.from({ length: total }).map((_, targetIdx) => (
                            <option key={targetIdx} value={targetIdx}>Jump to Q{targetIdx + 1}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    
                    <div style={{ 
                      marginTop: '1.25rem', 
                      padding: '10px 15px', 
                      background: 'rgba(var(--accent-primary-rgb), 0.05)', 
                      borderRadius: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px'
                    }}>
                      <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: q.scale ? 'var(--accent-primary)' : 'var(--border)' }}></div>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                        {q.scale ? (
                          <>
                            Aggregating score points from: <strong style={{ color: 'var(--accent-primary)' }}>
                              {q.scale.split(',').map(idx => `Q${parseInt(idx) + 1}`).join(', ')}
                            </strong>. 
                            <br/>If their combined points sum is &ge; <strong>{q.score_threshold || 0}</strong>, the user will be redirected to <strong style={{ color: 'var(--accent-primary)' }}>{q.threshold_next_question === -1 ? 'End of Survey' : `Q${(q.threshold_next_question || 0) + 1}`}</strong>.
                          </>
                        ) : (
                          "Select score questions above to form a logic cluster for score-based dynamic branching."
                        )}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});

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
  const [isTemplateDropdownOpen, setIsTemplateDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsTemplateDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const downloadExcelTemplate = async () => {
    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Survey Template');

      // Set values for Title, Category, Description
      worksheet.getCell('A1').value = 'Survey Title';
      worksheet.getCell('B1').value = ''; // empty for user to fill
      worksheet.getCell('A1').font = { bold: true };

      worksheet.getCell('A2').value = 'Category';
      worksheet.getCell('B2').value = ''; // empty for user to fill
      worksheet.getCell('A2').font = { bold: true };

      worksheet.getCell('A3').value = 'Survey Description';
      worksheet.getCell('B3').value = ''; // empty for user to fill
      worksheet.getCell('A3').font = { bold: true };

      // Header Row on row 5
      const headers = ['Question Number', 'Question Text', 'Answer Type', 'Options (semicolon-separated)', 'Required (Yes/No)'];
      worksheet.getRow(5).values = headers;
      worksheet.getRow(5).font = { bold: true };

      // Set Column widths
      worksheet.getColumn('A').width = 18;
      worksheet.getColumn('B').width = 45;
      worksheet.getColumn('C').width = 20;
      worksheet.getColumn('D').width = 40;
      worksheet.getColumn('E').width = 18;

      // Add list data validations (dropdowns) starting from row 6
      worksheet.dataValidations.add('C6:C100', {
        type: 'list',
        allowBlank: true,
        formulae: ['"short,paragraph,radio,check box,score,rating"']
      });

      worksheet.dataValidations.add('E6:E100', {
        type: 'list',
        allowBlank: true,
        formulae: ['"Yes,No"']
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'survey_automation_template.xlsx';
      anchor.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Failed to generate Excel template:", error);
      const { showError } = useNotificationStore.getState();
      showError("Failed to generate Excel template: " + error.message);
    }
  };

  const downloadManualExcelTemplate = async () => {
    try {
      const workbook = new ExcelJS.Workbook();
      
      for (const lang of INDIC_LANGUAGES) {
        const sheetName = lang.name;
        const worksheet = workbook.addWorksheet(sheetName);

        // Set values for Title, Category, Description
        worksheet.getCell('A1').value = 'Survey Title';
        worksheet.getCell('B1').value = ''; // empty for user to fill
        worksheet.getCell('A1').font = { bold: true };

        worksheet.getCell('A2').value = 'Category';
        worksheet.getCell('B2').value = ''; // empty for user to fill
        worksheet.getCell('A2').font = { bold: true };

        worksheet.getCell('A3').value = 'Survey Description';
        worksheet.getCell('B3').value = ''; // empty for user to fill
        worksheet.getCell('A3').font = { bold: true };

        // Header Row on row 5
        const headers = ['Question Number', 'Question Text', 'Answer Type', 'Options (semicolon-separated)', 'Required (Yes/No)'];
        worksheet.getRow(5).values = headers;
        worksheet.getRow(5).font = { bold: true };

        // Set Column widths
        worksheet.getColumn('A').width = 18;
        worksheet.getColumn('B').width = 45;
        worksheet.getColumn('C').width = 20;
        worksheet.getColumn('D').width = 40;
        worksheet.getColumn('E').width = 18;

        // Add list data validations (dropdowns) starting from row 6
        worksheet.dataValidations.add('C6:C100', {
          type: 'list',
          allowBlank: true,
          formulae: ['"short,paragraph,radio,check box,score,rating"']
        });

        worksheet.dataValidations.add('E6:E100', {
          type: 'list',
          allowBlank: true,
          formulae: ['"Yes,No"']
        });
      }

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'survey_manual_template_13_sheets.xlsx';
      anchor.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Failed to generate Manual Excel template:", error);
      const { showError } = useNotificationStore.getState();
      showError("Failed to generate Manual Excel template: " + error.message);
    }
  };

  const handleAutomationUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
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

        // Fallback if no English sheet is explicitly found, use the first successfully parsed sheet
        if (!baseSurveyData && workbook.SheetNames.length > 0) {
          for (const sheetName of workbook.SheetNames) {
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
          {renderMedia(q.media_type, q.media_url)}
          {(q.question_type === 'radio' || q.question_type === 'checkbox' || q.question_type === 'select') && (
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
        await addQuestions(survey.id, uploadedSurveyData.questions.map((q, idx) => ({ ...q, order: idx })));
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
          await addQuestions(survey.id, data.questions.map((q, idx) => ({ ...q, order: idx })));
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
        await addQuestions(originalSurvey.id, uploadedSurveyData.questions.map((q, idx) => ({ ...q, order: idx })));
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
          await addQuestions(survey.id, data.questions.map((q, idx) => ({ ...q, order: idx })));
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
        const mappedQuestions = currentSurvey.questions
          .sort((a, b) => a.order - b.order)
          .map(q => ({
            id: q.id,
            question_text: q.question_text,
            question_type: q.question_type,
            media_type: q.media_type,
            media_url: q.media_url,
            required: q.required,
            options: q.options?.sort((a,b) => a.order - b.order).map(o => ({
              option_text: o.option_text || '',
              next_question: o.next_question ?? null,
              score: o.score || 0,
              is_red_flag: o.is_red_flag || false,
              media_url: o.media_url || ''
            })) || [],
            rating_max: q.rating_max || 5,
            low_label: q.low_label || '',
            high_label: q.high_label || '',
            scale: q.scale || '',
            score_threshold: q.score_threshold ?? null,
            threshold_next_question: q.threshold_next_question ?? null
          }));
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
      required: true,
      options: [], 
      rating_max: 5,
      low_label: '',
      high_label: '',
      scale: '',
      score_threshold: null,
      threshold_next_question: null
    }]);
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

  const moveQuestion = (index, direction) => {
    setQuestions(prev => {
      if (direction === 'up' && index === 0) return prev;
      if (direction === 'down' && index === prev.length - 1) return prev;
      
      const newQuestions = [...prev];
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
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
      i === qIndex ? { ...q, options: [...q.options, { option_text: '', next_question: null, score: 0, is_red_flag: false, media_url: '' }] } : q
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

  const removeOption = (qIndex, oIndex) => {
    setQuestions(prev => prev.map((q, i) => 
      i === qIndex ? { 
        ...q, 
        options: q.options.filter((_, oi) => oi !== oIndex) 
      } : q
    ));
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
        await addQuestions(survey.id, translatedSurveyData.questions.map((q, idx) => ({ ...q, order: idx })));
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
      await addQuestions(id, translatedSurveyData.questions.map((q, idx) => ({ ...q, order: idx })));
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
    if (questions.length === 0) return showError('Please add at least one question');
    
    setSaving(true);
    try {
      // 1. Save original
      let originalSurveyId = id;
      if (isEditMode) {
        await updateSurvey(id, { title, category, description });
        await clearQuestions(id);
        await addQuestions(id, questions.map((q, idx) => ({ ...q, order: idx })));
      } else {
        const survey = await createSurvey({ title, category, description });
        if (survey && survey.id) {
          originalSurveyId = survey.id;
          await addQuestions(survey.id, questions.map((q, idx) => ({ ...q, order: idx })));
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
        await addQuestions(translatedSurvey.id, translatedSurveyData.questions.map((q, idx) => ({ ...q, order: idx })));
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

  const handleSave = async () => {
    const { showSuccess, showError } = useNotificationStore.getState();
    if (!title) return showError('Survey title is required');
    if (questions.length === 0) return showError('Please add at least one question');
    
    setSaving(true);
    try {
      if (isEditMode) {
        // Update Cycle
        await updateSurvey(id, { title, category, description });
        await clearQuestions(id);
        await addQuestions(id, questions.map((q, idx) => ({ ...q, order: idx })));
        showSuccess('Changes Saved Successfully');
        navigate('/surveys');
      } else {
        // Create Cycle
        const survey = await createSurvey({ title, category, description });
        if (survey && survey.id) {
          await addQuestions(survey.id, questions.map((q, idx) => ({ ...q, order: idx })));
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
      <div className="page-header-container">
        <div className="page-header">
          <h1>{isEditMode ? 'Edit Survey' : 'Create Survey'}</h1>
          {isEditMode && (
            <p className="truncate" style={{ maxWidth: '100%', color: 'var(--text-muted)' }} title={`Modify the configuration for "${title}" in the ${category} category.`}>
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
                      borderRadius: '10px',
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
                      borderRadius: '12px',
                      boxShadow: '0 10px 30px rgba(0, 0, 0, 0.25)',
                      zIndex: 1000,
                      padding: '0.5rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px',
                      animation: 'fade-in 0.15s ease-out'
                    }}>
                      <button 
                        onClick={() => {
                          downloadExcelTemplate();
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
                          downloadManualExcelTemplate();
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
                
                <label 
                  style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '8px', 
                    fontSize: '0.85rem', 
                    fontWeight: 700, 
                    padding: '0 1.5rem', 
                    borderRadius: '10px',
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border)',
                    color: 'var(--text-main)',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    height: '48px',
                    margin: 0,
                    boxSizing: 'border-box'
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.borderColor = 'var(--accent-primary)';
                    e.currentTarget.style.background = 'var(--bg-hover)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderColor = 'var(--border)';
                    e.currentTarget.style.background = 'var(--bg-card)';
                  }}
                  title="Upload standard English sheet for AI automatic translation"
                >
                  <Sparkles size={16} style={{ color: 'var(--accent-primary)' }} /> Upload Automation
                  <input 
                    type="file" 
                    accept=".xlsx, .xls"
                    onChange={handleAutomationUpload}
                    style={{ display: 'none' }}
                  />
                </label>

                <label 
                  style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '8px', 
                    fontSize: '0.85rem', 
                    fontWeight: 700, 
                    padding: '0 1.5rem', 
                    borderRadius: '10px',
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border)',
                    color: 'var(--text-main)',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    height: '48px',
                    margin: 0,
                    boxSizing: 'border-box'
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.borderColor = '#10B981';
                    e.currentTarget.style.background = 'var(--bg-hover)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderColor = 'var(--border)';
                    e.currentTarget.style.background = 'var(--bg-card)';
                  }}
                  title="Upload 13-sheet workbook with manual translations"
                >
                  <UserCheck size={16} style={{ color: '#10B981' }} /> Upload Manually
                  <input 
                    type="file" 
                    accept=".xlsx, .xls"
                    onChange={handleManualUpload}
                    style={{ display: 'none' }}
                  />
                </label>
              </>
            )}
            <button
              type="button"
              onClick={() => {
                setTranslationCompleted(false);
                setTranslatedSurveyData(null);
                setIsTranslationModalOpen(true);
              }}
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '10px',
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                color: 'var(--text-main)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s'
              }}
              title="Translate Survey"
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = 'var(--accent-primary)';
                e.currentTarget.style.background = 'var(--bg-hover)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = 'var(--border)';
                e.currentTarget.style.background = 'var(--bg-card)';
              }}
            >
              <Languages size={18} />
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
            <label style={{ fontSize: '0.8rem', fontWeight: 700, display: 'block', marginBottom: '8px', color: 'var(--text-muted)' }}>SURVEY TITLE</label>
            <input 
              value={title} 
              onChange={e => setTitle(e.target.value)} 
              placeholder="e.g. Technical Skills Assessment"
              maxLength={60}
              title={title}
            />
          </div>
          <div>
            <label style={{ fontSize: '0.8rem', fontWeight: 700, display: 'block', marginBottom: '8px', color: 'var(--text-muted)' }}>CATEGORY</label>
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
                  style={{ padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-main)', color: 'var(--text-main)', fontSize: '0.9rem', width: '100%' }}
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
                    style={{ padding: '12px', borderRadius: '8px', border: '1px solid var(--accent-primary)' }}
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
                    padding: '12px', 
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
          <label style={{ fontSize: '0.8rem', fontWeight: 700, display: 'block', color: 'var(--text-muted)' }}>SURVEY DESCRIPTION</label>
          <textarea 
            value={description} 
            onChange={e => setDescription(e.target.value)} 
            placeholder="e.g. This survey collects user feedback about our product's performance and usability."
            style={{ minHeight: '50px', width: '100%', resize: 'vertical' }}
          />
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>Questions ({questions.length})</h3>
        <button className="primary" onClick={addQuestion} style={{ fontSize: '0.85rem' }}>
          <Plus size={18} /> Add Question
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        {questions.map((q, i) => (
          <QuestionCard 
            key={q.id || i}
            q={q}
            i={i}
            total={questions.length}
            questions={questions}
            updateQuestion={updateQuestion}
            updateQuestionMultiple={updateQuestionMultiple}
            removeQuestion={removeQuestion}
            duplicateQuestion={duplicateQuestion}
            moveQuestion={moveQuestion}
            addOption={addOption}
            updateOption={updateOption}
            autoAssignScores={autoAssignScores}
            openPreview={openPreview}
            removeOption={removeOption}
          />
        ))}
      </div>

      {questions.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '2rem' }}>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
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
            <button
              type="button"
              onClick={() => {
                setTranslationCompleted(false);
                setTranslatedSurveyData(null);
                setIsTranslationModalOpen(true);
              }}
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '10px',
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                color: 'var(--text-main)',
                fontWeight: 700,
                fontSize: '1rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s'
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = 'var(--accent-primary)';
                e.currentTarget.style.background = 'var(--bg-hover)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = 'var(--border)';
                e.currentTarget.style.background = 'var(--bg-card)';
              }}
            >
              T
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
    </div>
  );
};

export default SurveyBuilder;
