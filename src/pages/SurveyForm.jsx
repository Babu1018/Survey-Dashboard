import { useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import useSurveyStore from '../store/useSurveyStore';
import useAuthStore from '../store/useAuthStore';
import { useState } from 'react';
import { Send, CheckCircle, Mail, Music, ArrowRight, ArrowLeft, X, ClipboardList, ChevronRight, AlertTriangle, Bell } from 'lucide-react';
import { useAssessmentFlow } from '../utils/useAssessmentFlow';
import { computeQuestionLabels } from '../utils/questionLabels';
import { parseParentRef } from '../utils/surveyRouting';
import { getStatusBadgeColors } from '../utils/statusBadge';
import { parseMediaItems } from '../utils/mediaItems';
import { RatingInput, RankingInput, MatrixInput, FileUploadInput } from '../components/common/QuestionInputs';
import { parseLabelList, parseMatrixAnswer } from '../utils/questionTypes';
import pageBackground from '../assets/PageBackground.png';
import * as surveyService from '../services/surveyService';

const SurveyForm = ({
  previewSurveyId = null,
  onClosePreview = null,
  draftQuestions = null,
  draftTitle = '',
}) => {
  const { fetchSurveyDetail, currentSurvey, loading } = useSurveyStore();
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  // Test Mode (the builder's Play button): the survey being taken is the
  // unsaved draft held in builder state rather than a row fetched from the
  // API. Everything downstream is deliberately identical — same adapter, same
  // flow engine, same sections/tiers/branching — so what the admin walks here
  // is exactly what a respondent would get. Only two things differ: where the
  // questions come from, and that finishing writes nothing to the database.
  const isTestMode = Array.isArray(draftQuestions);
  // A survey deep-linked via ?survey=<id> (e.g. from the My Survey dashboard)
  // behaves like a preview: jump straight into the take-flow, skipping the
  // internal picker grid, and return to the dashboard on close instead of
  // resetting back to that grid.
  const linkedSurveyId = searchParams.get('survey');
  const skipPicker = previewSurveyId || linkedSurveyId || (isTestMode ? 'test-mode' : '');
  const [selectedSurveyId, setSelectedSurveyId] = useState(skipPicker || '');
  const [email, setEmail] = useState(user?.email || user?.username || '');
  const [submitted, setSubmitted] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(!!skipPicker);
  const [isStarted, setIsStarted] = useState(false);
  const [redFlagAlert, setRedFlagAlert] = useState(false);

  // ── Step 0 = Email screen; Step 1+ = Questions (unchanged convention) ──────
  const [currentStep, setCurrentStep] = useState(0);

  const surveys = user?.assigned_surveys || [];

  const sortedQuestions = useMemo(() => {
    const source = isTestMode ? draftQuestions : currentSurvey?.questions;
    if (!source) return [];
    return [...source].sort((a, b) => a.order - b.order);
  }, [isTestMode, draftQuestions, currentSurvey]);

  // Section dividers ride along in sortedQuestions (as question_type
  // '_section' rows) so option-jump indices stay aligned with what the
  // builder saved; the flow engine skips them as answerable questions.
  // Here we just look up, for a given question's order, the nearest
  // section label that precedes it — computed live from the survey the
  // API returned, so it stays correct as sections are added/renamed.
  const sectionLabelForOrder = useMemo(() => {
    const sections = sortedQuestions.filter((q) => q.question_type === '_section');
    return (order) => {
      let label = null;
      for (const s of sections) {
        if (s.order <= order) label = s.question_text || null;
        else break;
      }
      return label;
    };
  }, [sortedQuestions]);

  // Which section header to show above a question. Subsection questions are
  // appended to the end of the survey as they're authored, so their own `order`
  // would name whatever section happens to come last. They belong to the
  // section their controlling question sits in, so walk up to the nearest
  // ancestor with a place in the main sequence and take its section instead.
  const sectionLabelForQuestion = useMemo(() => {
    const byId = new Map(sortedQuestions.map((q) => [q.id, q]));
    const parentOf = (q) => {
      const { parentRef } = parseParentRef(q?.parent_question_key);
      if (!parentRef) return null;
      const m = /^idx_(\d+)$/.exec(parentRef);
      if (m) return sortedQuestions[parseInt(m[1], 10)] || null;
      const byKey = /^q_(\d+)$/.exec(parentRef);
      return byKey ? byId.get(parseInt(byKey[1], 10)) || null : null;
    };
    return (q) => {
      let cursor = q;
      for (let guard = 0; cursor && guard <= sortedQuestions.length; guard++) {
        const parent = parentOf(cursor);
        if (!parent) break;
        cursor = parent;
      }
      return sectionLabelForOrder(cursor?.order ?? q?.order);
    };
  }, [sortedQuestions, sectionLabelForOrder]);

  // Hierarchical "1", "1.1", "1.2" labels for tiered follow-up questions —
  // same computation the Builder uses, so respondents see the same numbers
  // authors see while building.
  const { questionLabels } = useMemo(() => computeQuestionLabels(sortedQuestions), [sortedQuestions]);

  // ── Dynamic flow hook ─────────────────────────────────────────────────────
  const {
    answers,
    currentQuestion,
    currentIdx,
    currentPosition,
    isLast,
    totalVisible,
    setAnswer,
    advance,
    back: flowBack,
    reset: flowReset,
    start: flowStart,
  } = useAssessmentFlow(sortedQuestions);

  // ── Sync when a new survey is loaded ─────────────────────────────────────
  useEffect(() => {
    if (skipPicker) {
      setSelectedSurveyId(skipPicker);
      setIsModalOpen(true);
    }
  }, [skipPicker]);

  useEffect(() => {
    if (selectedSurveyId) {
      // In Test Mode the questions are already in hand, so there is nothing
      // to fetch — but the flow still resets exactly as a real run would.
      if (!isTestMode) fetchSurveyDetail(selectedSurveyId);
      flowReset();
      setSubmitted(false);
      setIsModalOpen(true);
      setCurrentStep(0);
      setIsStarted(false);
      setRedFlagAlert(false);
    }
  }, [selectedSurveyId]);

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedSurveyId('');
    setIsStarted(false);
    flowReset();
    if (onClosePreview) onClosePreview();
    else if (linkedSurveyId) navigate('/');
  };

  // ── Answer helpers ────────────────────────────────────────────────────────
  const handleAnswerChange = (qId, value) => {
    setAnswer(qId, value);
  };

  const handleCheckboxChange = (qId, option, checked) => {
    const currentAnswers = answers[qId] ? JSON.parse(answers[qId]) : [];
    const newAnswers = checked
      ? [...currentAnswers, option]
      : currentAnswers.filter((a) => a !== option);
    setAnswer(qId, JSON.stringify(newAnswers));
  };

  // ── Navigation ────────────────────────────────────────────────────────────
  const handleNext = () => {
    if (currentStep === 0) {
      if (!email) return alert('Please enter your email');
      setCurrentStep(1);
      flowStart();
      setIsStarted(true);
      return;
    }

    if (!currentQuestion) return;
    const q = currentQuestion;

    // Validation. A matrix isn't answered until every row has a selection, so
    // it can't lean on the generic empty-string check the other types use.
    if (q.required) {
      if (q.question_type === 'matrix') {
        const rows = parseLabelList(q.matrix_rows);
        const picked = parseMatrixAnswer(answers[q.id]);
        const unanswered = rows.filter((row) => {
          const cell = picked[row];
          return cell === undefined || (Array.isArray(cell) && cell.length === 0);
        });
        if (unanswered.length) {
          return alert(
            unanswered.length === rows.length
              ? 'This question is required'
              : `Please answer every row — still missing: ${unanswered.join(', ')}`
          );
        }
      } else if (!answers[q.id] || answers[q.id] === '[]' || answers[q.id] === '{}') {
        return alert('This question is required');
      }
    }

    // Detect which option index was selected (for sticky jump + red-flag detection)
    let optionIndex = null;
    if (q.options?.length) {
      const selectedText = typeof answers[q.id] === 'string' ? answers[q.id] : null;
      if (selectedText && q.question_type !== 'checkbox') {
        optionIndex = q.options
          .slice()
          .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
          .findIndex((o) => o.option_text === selectedText);
      }
    }

    // Red flag detection before advancing
    if (q.options?.length && optionIndex != null && optionIndex >= 0) {
      const sorted = q.options.slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      if (sorted[optionIndex]?.is_red_flag) {
        setRedFlagAlert(true);
      }
    }

    const { isEnd } = advance(q.id, answers[q.id], optionIndex >= 0 ? optionIndex : null);
    if (isEnd) {
      setCurrentStep(sortedQuestions.length + 1);
    }
  };

  const handleBack = () => {
    if (currentStep === 0) return;
    if (currentStep === 1 && currentPosition <= 0) {
      setCurrentStep(0);
      setIsStarted(false);
      return;
    }
    if (currentStep > sortedQuestions.length) {
      // On the "All Done" review screen — go back to last question
      setCurrentStep(sortedQuestions.length);
      return;
    }
    flowBack();
    setRedFlagAlert(false);
  };

  // ── Submit ────────────────────────────────────────────────────────────────
  const getGeolocation = () => new Promise((resolve) => {
    if (!navigator.geolocation) return resolve({ latitude: null, longitude: null });
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
      () => resolve({ latitude: null, longitude: null }),
      { timeout: 5000 }
    );
  });

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    // Test Mode is a dry run: the admin walks the whole real flow, but nothing
    // is written to the database and no respondent identity is needed.
    if (isTestMode) { setSubmitted(true); return; }
    if (!email) return alert('Email required');

    const { latitude, longitude } = await getGeolocation();

    const payload = {
      survey_id: parseInt(selectedSurveyId),
      respondent_email: email,
      user_id: user?.id || null,
      latitude,
      longitude,
      answers: Object.entries(answers).map(([qId, text]) => ({
        question_id: parseInt(qId),
        answer_text: String(text),
      })),
    };

    try {
      await surveyService.submitResponse(selectedSurveyId, payload);
      setSubmitted(true);
    } catch (err) {
      console.error(err);
    }
  };

  // ── Progress (branching-aware) ────────────────────────────────────────────
  const progressPercent = useMemo(() => {
    if (!isStarted || totalVisible === 0) return 0;
    if (currentStep > sortedQuestions.length) return 100;
    return Math.round(((currentPosition + 1) / Math.max(totalVisible, 1)) * 100);
  }, [isStarted, currentStep, currentPosition, totalVisible, sortedQuestions.length]);

  // ── Media renderer ────────────────────────────────────────────────────────
  const renderMedia = (type, url) => {
    if (!url) return null;
    switch (type) {
      case 'image':
        return (
          <div style={{ marginBottom: '1.25rem', borderRadius: '10px', overflow: 'hidden', border: '1px solid var(--border)' }}>
            <img src={url} alt="Media" style={{ width: '100%', display: 'block', maxHeight: '300px', objectFit: 'contain', background: '#f8fafc' }} />
          </div>
        );
      case 'video': {
        const isYoutube = url.includes('youtube.com') || url.includes('youtu.be');
        if (isYoutube) {
          const videoId = url.split('v=')[1] || url.split('/').pop();
          return (
            <div style={{ marginBottom: '1.25rem', borderRadius: '10px', overflow: 'hidden', position: 'relative', paddingTop: '56.25%' }}>
              <iframe src={`https://www.youtube.com/embed/${videoId}`} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none' }} allowFullScreen />
            </div>
          );
        }
        return (
          <div style={{ marginBottom: '1.25rem' }}>
            <video controls style={{ width: '100%', borderRadius: '10px' }}>
              <source src={url} />
            </video>
          </div>
        );
      }
      case 'audio':
        return (
          <div style={{ marginBottom: '1.25rem', padding: '1rem', background: 'var(--bg-main)', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Music size={20} color="var(--accent-primary)" />
            <audio controls style={{ flexGrow: 1 }}>
              <source src={url} />
            </audio>
          </div>
        );
      default:
        return null;
    }
  };

  // ── Question renderer ─────────────────────────────────────────────────────
  const renderQuestion = () => {
    // ── Email / start screen ──────────────────────────────────────────────
    if (currentStep === 0) {
      return (
        <div style={{ animation: 'slide-in 0.3s ease-out' }}>
          <div style={{ marginBottom: '4rem', paddingBottom: '3.5rem' }}>
            <label style={{ fontSize: '0.8rem', fontWeight: 850, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: '16px' }}>
              {isTestMode ? 'Respondent Identification (test)' : 'Respondent Identification'}
            </label>
            <div style={{ position: 'relative', maxWidth: '800px' }}>
              <Mail size={24} style={{ position: 'absolute', left: '20px', top: '50%', transform: 'translateY(-50%)', color: 'var(--accent-primary)' }} />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your registered email ID"
                style={{
                  paddingLeft: '60px',
                  fontSize: '1.1rem',
                  height: '64px',
                  borderRadius: '16px',
                  background: 'var(--bg-main)',
                  border: '2px solid var(--border)',
                  fontWeight: 600,
                }}
              />
            </div>
            <p style={{ marginTop: '1.5rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              {isTestMode
                ? 'Shown to real respondents to track their progress. In Test Mode nothing is recorded — just continue.'
                : 'We use this to track your assessment progress and save your results.'}
            </p>
          </div>
          <button className="primary" onClick={handleNext} style={{ width: '100%', height: '64px', fontSize: '1.2rem', fontWeight: 800, borderRadius: '16px' }}>
            Start Survey <ChevronRight size={24} style={{ marginLeft: '10px' }} />
          </button>
        </div>
      );
    }

    // ── Review / submit screen ────────────────────────────────────────────
    if (currentStep > sortedQuestions.length) {
      return (
        <div style={{ textAlign: 'center', padding: '3rem', animation: 'slide-in 0.3s ease-out' }}>
          <div style={{ width: '80px', height: '80px', background: 'rgba(76, 140, 228, 0.1)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 2rem', color: 'var(--accent-primary)' }}>
            <CheckCircle size={40} />
          </div>
          <h3 style={{ fontSize: '1.8rem', fontWeight: 800, marginBottom: '1rem' }}>All Done!</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem', marginBottom: '3rem' }}>
            You have completed all the questions in this survey. Click below to submit your final response.
          </p>
          <div style={{ display: 'flex', gap: '15px' }}>
            <button onClick={handleBack} style={{ flex: 1, height: '60px', background: 'none', border: '1px solid var(--border)', fontWeight: 700 }}>Go Back</button>
            <button className="primary" onClick={handleSubmit} style={{ flex: 2, height: '60px', fontSize: '1.1rem', fontWeight: 800, borderRadius: '16px' }}>
              <Send size={22} style={{ marginRight: '10px' }} /> Submit My Entry
            </button>
          </div>
        </div>
      );
    }

    // ── Active question ────────────────────────────────────────────────────
    const q = currentQuestion;
    if (!q) return null;

    const getActiveMedia = () => {
      if (!q.options) return [];
      const currentVal = answers[q.id];
      if (!currentVal) return [];
      if (q.question_type === 'checkbox') {
        try {
          const selectedTexts = JSON.parse(currentVal);
          return q.options
            .filter((opt) => selectedTexts.includes(opt.option_text))
            .flatMap((opt) => parseMediaItems(opt));
        } catch { return []; }
      } else {
        const selectedOpt = q.options.find((opt) => opt.option_text === currentVal);
        return selectedOpt ? parseMediaItems(selectedOpt) : [];
      }
    };

    const renderOptionMedia = (opt) => {
      const items = parseMediaItems(opt);
      if (!items.length) return null;
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {items.map((item, idx) => item.type === 'audio' ? (
            <audio
              key={idx}
              controls
              src={item.url}
              onClick={(e) => { e.stopPropagation(); e.preventDefault(); }}
              style={{ width: '100%', height: '32px' }}
            />
          ) : (
            <img key={idx} src={item.url} alt={opt.option_text} style={{ width: '100%', maxHeight: items.length > 1 ? '90px' : '120px', objectFit: 'cover', borderRadius: '10px' }} />
          ))}
        </div>
      );
    };

    const activeMedia = getActiveMedia();
    const questionNumber = questionLabels[currentIdx] ?? (currentPosition + 1);
    const sectionLabel = sectionLabelForQuestion(q);

    return (
      <div key={q.id} style={{ animation: 'slide-in 0.3s ease-out', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

        {/* Section header (dynamic — derived from the survey's own question order) */}
        {sectionLabel && (
          <div style={{
            fontSize: '0.75rem', fontWeight: 800, color: 'var(--accent-primary)',
            textTransform: 'uppercase', letterSpacing: '0.08em',
          }}>
            {sectionLabel}
          </div>
        )}

        {/* Red flag alert banner */}
        {redFlagAlert && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '12px',
            padding: '1rem 1.5rem', borderRadius: '14px',
            background: 'rgba(239,68,68,0.08)', border: '1.5px solid #ef4444',
            color: '#ef4444', fontWeight: 700, fontSize: '0.95rem',
            animation: 'fade-in 0.3s',
          }}>
            <AlertTriangle size={20} style={{ flexShrink: 0 }} />
            <span>⚠️ A high-risk response was detected and has been flagged for review.</span>
            <button
              onClick={() => setRedFlagAlert(false)}
              style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: '2px' }}
            >
              <X size={16} />
            </button>
          </div>
        )}

        {/* Answer input */}
        <div style={{ background: 'var(--bg-card)', padding: '1.5rem', borderRadius: '16px', boxShadow: '0 8px 24px rgba(0,0,0,0.06)', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {/* Question label + text */}
        <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
          <span style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            minWidth: '26px', height: '26px', borderRadius: '8px',
            background: 'var(--accent-primary)', color: 'white',
            fontSize: '0.78rem', fontWeight: 800, flexShrink: 0,
          }}>{questionNumber}</span>
          <label style={{ fontWeight: 700, fontSize: '1rem', lineHeight: 1.45 }}>
            {q.question_text}{q.required && <span style={{ color: '#ef4444', marginLeft: '4px' }}>*</span>}
          </label>
        </div>

        {/* Dynamic choice media / static media */}
        {activeMedia.length > 0 ? (
          <div style={{
            display: 'grid',
            gridTemplateColumns: activeMedia.length > 1 ? 'repeat(auto-fit, minmax(200px, 1fr))' : '1fr',
            gap: '15px', background: 'var(--bg-main)', padding: '1.5rem',
            borderRadius: '20px', border: '2px solid var(--accent-primary)', animation: 'fade-in 0.3s',
          }}>
            {activeMedia.map((item, idx) => item.type === 'audio' ? (
              <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '1rem', background: 'var(--bg-card)', borderRadius: '12px' }}>
                <Music size={20} color="var(--accent-primary)" />
                <audio controls style={{ flexGrow: 1 }}>
                  <source src={item.url} />
                </audio>
              </div>
            ) : (
              <img key={idx} src={item.url} alt={`Selection ${idx}`} style={{ width: '100%', maxHeight: '400px', objectFit: 'contain', borderRadius: '12px' }} />
            ))}
          </div>
        ) : (
          parseMediaItems(q).map((item, idx) => <div key={idx}>{renderMedia(item.type, item.url)}</div>)
        )}

          {(q.question_type === 'text' || q.question_type === 'short_text') && (
            <input
              type="text"
              required={q.required}
              value={answers[q.id] || ''}
              placeholder="Your response..."
              onChange={(e) => handleAnswerChange(q.id, e.target.value)}
              style={{ height: '60px', borderRadius: '12px', fontSize: '1.1rem' }}
            />
          )}

          {q.question_type === 'long_text' && (
            <textarea
              required={q.required}
              value={answers[q.id] || ''}
              rows={6}
              placeholder="Provide detailed response..."
              onChange={(e) => handleAnswerChange(q.id, e.target.value)}
              style={{ borderRadius: '12px', fontSize: '1.1rem', padding: '1.5rem' }}
            />
          )}

          {q.question_type === 'number' && (
            <input
              type="number"
              required={q.required}
              value={answers[q.id] || ''}
              placeholder="Enter a number..."
              onChange={(e) => handleAnswerChange(q.id, e.target.value)}
              style={{ height: '60px', borderRadius: '12px', fontSize: '1.4rem', fontWeight: 700, textAlign: 'center' }}
            />
          )}

          {q.question_type === 'phone' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ position: 'relative' }}>
                <span style={{
                  position: 'absolute', left: '20px', top: '50%', transform: 'translateY(-50%)',
                  fontWeight: 800, fontSize: '1.1rem', color: 'var(--text-muted)', userSelect: 'none',
                }}>📞</span>
                <input
                  type="tel"
                  required={q.required}
                  value={answers[q.id] || ''}
                  placeholder="10-digit mobile number"
                  maxLength={10}
                  inputMode="numeric"
                  pattern="[0-9]{10}"
                  onChange={(e) => {
                    // Allow digits only, max 10
                    const digits = e.target.value.replace(/\D/g, '').slice(0, 10);
                    handleAnswerChange(q.id, digits);
                  }}
                  style={{
                    height: '60px', borderRadius: '12px', fontSize: '1.3rem',
                    fontWeight: 700, letterSpacing: '0.15em',
                    paddingLeft: '56px',
                    border: `2px solid ${(answers[q.id] || '').length === 10 ? '#10b981' : 'var(--border)'}`,
                    color: (answers[q.id] || '').length === 10 ? '#10b981' : 'var(--text-main)',
                  }}
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                <div style={{
                  display: 'flex', gap: '3px',
                }}>
                  {Array.from({ length: 10 }).map((_, idx) => (
                    <div key={idx} style={{
                      width: '22px', height: '4px', borderRadius: '2px',
                      background: idx < (answers[q.id] || '').length ? '#10b981' : 'var(--border)',
                      transition: 'background 0.15s',
                    }} />
                  ))}
                </div>
                <span>{(answers[q.id] || '').length}/10 digits</span>
              </div>
            </div>
          )}

          {q.question_type === 'rating' && (
            <RatingInput
              question={q}
              value={answers[q.id]}
              onChange={(val) => handleAnswerChange(q.id, val)}
            />
          )}

          {q.question_type === 'ranking' && (
            <RankingInput
              question={q}
              value={answers[q.id]}
              onChange={(val) => handleAnswerChange(q.id, val)}
            />
          )}

          {q.question_type === 'matrix' && (
            <MatrixInput
              question={q}
              value={answers[q.id]}
              onChange={(val) => handleAnswerChange(q.id, val)}
            />
          )}

          {q.question_type === 'file_upload' && (
            <FileUploadInput
              question={q}
              value={answers[q.id]}
              onChange={(val) => handleAnswerChange(q.id, val)}
              // Test Mode runs on an unsaved draft, whose questions have no
              // real database ids to attach an upload to.
              disabled={isTestMode}
            />
          )}

          {(q.question_type === 'radio' || q.question_type === 'multiple_choice') && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px' }}>
              {q.options?.sort((a, b) => a.order - b.order).map((opt) => (
                <label key={opt.id} style={{
                  display: 'flex', flexDirection: 'column', gap: '8px',
                  cursor: 'pointer', padding: '11px 13px', borderRadius: '10px',
                  background: answers[q.id] === opt.option_text ? 'rgba(var(--accent-primary-rgb), 0.05)' : 'var(--bg-sidebar)',
                  border: `1.5px solid ${answers[q.id] === opt.option_text ? 'var(--accent-primary)' : 'var(--border)'}`,
                  transition: 'all 0.2s', fontWeight: 500, fontSize: '0.88rem',
                  boxShadow: answers[q.id] === opt.option_text ? '0 5px 15px rgba(0,0,0,0.05)' : 'none',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <input type="radio" name={`q-${q.id}`} value={opt.option_text} checked={answers[q.id] === opt.option_text} required={q.required} onChange={(e) => handleAnswerChange(q.id, e.target.value)} style={{ width: '16px', height: '16px', accentColor: 'var(--accent-primary)', flexShrink: 0 }} />
                    {opt.emoji && <span style={{ fontSize: '1.3rem' }}>{opt.emoji}</span>}
                    <span style={{ flexGrow: 1 }}>{opt.option_text}</span>
                    {opt.is_red_flag && (
                      <AlertTriangle size={14} color="#ef4444" title="High-risk option" />
                    )}
                  </div>
                  {renderOptionMedia(opt)}
                </label>
              ))}
            </div>
          )}

          {q.question_type === 'select' && (
            <select
              value={answers[q.id] || ''}
              required={q.required}
              onChange={(e) => handleAnswerChange(q.id, e.target.value)}
              style={{ height: '60px', borderRadius: '12px', fontSize: '1.1rem', padding: '0 20px', fontWeight: 600 }}
            >
              <option value="">Select an option...</option>
              {q.options?.sort((a, b) => a.order - b.order).map((opt) => (
                <option key={opt.id} value={opt.option_text}>{opt.emoji ? `${opt.emoji} ` : ''}{opt.option_text}</option>
              ))}
            </select>
          )}

          {q.question_type === 'checkbox' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px' }}>
              {q.options?.sort((a, b) => a.order - b.order).map((opt) => {
                const isChecked = answers[q.id] ? JSON.parse(answers[q.id]).includes(opt.option_text) : false;
                return (
                  <label key={opt.id} style={{
                    display: 'flex', flexDirection: 'column', gap: '10px',
                    cursor: 'pointer', padding: '18px', borderRadius: '16px',
                    background: isChecked ? 'rgba(var(--accent-primary-rgb), 0.05)' : 'var(--bg-sidebar)',
                    border: `2px solid ${isChecked ? 'var(--accent-primary)' : 'var(--border)'}`,
                    transition: 'all 0.2s', fontWeight: 600, fontSize: '1.1rem',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <input type="checkbox" value={opt.option_text} checked={isChecked} onChange={(e) => handleCheckboxChange(q.id, opt.option_text, e.target.checked)} style={{ width: '16px', height: '16px', accentColor: 'var(--accent-primary)', flexShrink: 0 }} />
                      {opt.emoji && <span style={{ fontSize: '1.3rem' }}>{opt.emoji}</span>}
                      <span style={{ flexGrow: 1 }}>{opt.option_text}</span>
                    </div>
                    {renderOptionMedia(opt)}
                  </label>
                );
              })}
            </div>
          )}
        </div>

        {/* Pagination dots (skipped for very long surveys where dots would clutter) */}
        {totalVisible > 0 && totalVisible <= 10 && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: '6px' }}>
            {Array.from({ length: totalVisible }).map((_, i) => (
              <div key={i} style={{
                width: i === currentPosition ? '22px' : '7px', height: '7px', borderRadius: '4px',
                background: i === currentPosition ? 'var(--accent-primary)' : 'var(--border)',
                transition: 'all 0.2s ease',
              }} />
            ))}
          </div>
        )}

        {/* Navigation buttons */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '12px' }}>
          <button
            onClick={handleBack}
            style={{
              padding: '0 20px', height: '42px', borderRadius: '10px',
              background: 'rgba(var(--accent-primary-rgb), 0.08)', border: 'none', color: 'var(--accent-primary)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              fontWeight: 700,
            }}
          >
            <ArrowLeft size={18} /> Back
          </button>
          <button
            className="primary"
            onClick={handleNext}
            style={{ padding: '0 20px', height: '42px', borderRadius: '10px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            {isLast ? 'Review & Finish' : 'Next Question'} <ChevronRight size={18} />
          </button>
        </div>

        {/* Answered-so-far helper text */}
        <p style={{ textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>
          {Object.keys(answers).length} of {totalVisible} answered
          {q.required ? ' • This question is required to continue' : ''}
        </p>
      </div>
    );
  };

  // ── Root render ───────────────────────────────────────────────────────────
  return (
    <div style={{ animation: 'fade-in 0.4s ease-out', padding: (previewSurveyId || isTestMode) ? '0' : '2rem' }}>
      {!previewSurveyId && !isTestMode && (
        <>
          <div style={{ marginBottom: '2.5rem' }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '0.5rem' }}>My Surveys</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Select an assigned survey to begin your entry.</p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
            {surveys.map((s) => (
              <button
                key={s.id}
                className="panel"
                onClick={() => setSelectedSurveyId(s.id)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '1.25rem 1.5rem', border: '1px solid var(--border)',
                  background: 'var(--bg-sidebar)', textAlign: 'left',
                  cursor: 'pointer', width: '100%', transition: 'all 0.2s', borderRadius: '16px',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--accent-primary)'; e.currentTarget.style.background = 'var(--bg-hover)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--bg-sidebar)'; }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(76, 140, 228, 0.1)', color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <ClipboardList size={20} />
                  </div>
                  <div>
                    <div style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--accent-primary)', marginBottom: '2px' }}>{s.category}</div>
                    <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-main)' }}>{s.title}</div>
                  </div>
                </div>
                <ArrowRight size={18} color="var(--text-muted)" />
              </button>
            ))}
          </div>

          {surveys.length === 0 && (
            <div className="panel" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)', border: '1px dashed var(--border)' }}>
              No surveys are currently assigned to you.
            </div>
          )}
        </>
      )}

      {isModalOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'var(--bg-main)', display: 'flex', flexDirection: 'column',
          zIndex: 3000, animation: 'fade-in 0.3s ease-out',
        }}>
          {/* Header — mirrors the app's TopBar (bell + user chip) for visual continuity */}
          <header style={{
            background: 'rgba(var(--bg-sidebar-rgb), 0.8)', backdropFilter: 'blur(12px)',
            borderBottom: '1px solid var(--border)', flexShrink: 0,
          }}>
            <div style={{
              maxWidth: '1400px', margin: '0 auto', display: 'flex',
              alignItems: 'center', justifyContent: 'space-between',
              padding: 'clamp(0.75rem, 1.2vw, 1.5rem) clamp(1rem, 2vw, 2.5rem)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', minWidth: 0 }}>
                <button
                  onClick={handleCloseModal}
                  style={{ background: 'none', border: 'none', color: 'var(--accent-primary)', fontWeight: 700, padding: 0, fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', flexShrink: 0 }}
                >
                  <ArrowLeft size={16} /> {isTestMode ? 'Exit Test' : 'Back'}
                </button>
                {isTestMode && (
                  <span
                    title="This is a dry run of the survey. Nothing is saved."
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: '6px', flexShrink: 0,
                      fontSize: '0.65rem', fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase',
                      background: 'rgba(16, 185, 129, 0.12)', color: '#10b981',
                      padding: '4px 10px', borderRadius: '20px',
                    }}
                  >
                    Test Mode — nothing is saved
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <Bell size={18} color="var(--text-muted)" />
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{
                    width: '32px', height: '32px', borderRadius: '50%',
                    background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))',
                    color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 800, fontSize: '0.8rem', flexShrink: 0,
                  }}>{(user?.username?.[0] || 'U').toUpperCase()}</div>
                  <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2 }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 700 }}>{user?.username || 'User'}</span>
                    <span style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--accent-primary)' }}>{user?.role || 'User'}</span>
                  </div>
                </div>
              </div>
            </div>
          </header>

          <div className="modal-scroll take-survey-bg" style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto', padding: '2rem 1rem', position: 'relative', backgroundColor: '#fbfcff' }}>
            {submitted ? (
              <div style={{ margin: 'auto', textAlign: 'center', padding: '4rem 1rem', maxWidth: '440px', position: 'relative', zIndex: 1 }}>
                <div style={{ width: '90px', height: '90px', background: 'rgba(16,185,129,0.1)', border: '2px solid rgba(16,185,129,0.3)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem', color: '#10b981' }}>
                  <CheckCircle size={44} />
                </div>
                {/* In Test Mode the "Pending Review" badge would be a lie —
                    nothing was submitted. A red flag is still worth surfacing,
                    since confirming it fires is part of testing the flow. */}
                {(!isTestMode || redFlagAlert) && (() => {
                  const status = redFlagAlert ? 'Intervention Triggered' : 'Pending';
                  const colors = getStatusBadgeColors(status);
                  return (
                    <span style={{
                      display: 'inline-block', fontSize: '0.7rem', fontWeight: 800, padding: '4px 12px',
                      borderRadius: '20px', background: colors.bg, color: colors.fg, marginBottom: '1rem',
                    }}>
                      {status === 'Pending' ? 'Pending Review' : status}
                    </span>
                  );
                })()}
                <h2 style={{ fontSize: '1.8rem', fontWeight: 800, marginBottom: '0.5rem' }}>
                  {isTestMode ? 'Test Complete' : 'Submitted!'}
                </h2>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--accent-primary)', marginBottom: '0.75rem' }}>
                  {isTestMode ? (draftTitle || 'Untitled survey') : currentSurvey?.title}
                </h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '2rem', lineHeight: 1.6 }}>
                  {isTestMode
                    ? 'You reached the end of the survey, so the full flow works. This was a test run — nothing was saved.'
                    : 'Your responses have been recorded and are pending review from your coordinator.'}
                </p>
                <button className="primary" onClick={handleCloseModal} style={{ padding: '0 28px', height: '52px', borderRadius: '14px', fontWeight: 700 }}>
                  {isTestMode ? 'Back to Builder' : 'Back to Dashboard'}
                </button>
              </div>
            ) : (
              // A Matrix/Grid question is a table of rows against a shared
              // scale, so it needs more room than a single-answer question
              // before its columns start scrolling out of sight.
              <div style={{
                margin: 'auto', width: '100%',
                maxWidth: currentQuestion?.question_type === 'matrix' ? '940px' : '560px',
                position: 'relative', zIndex: 1, transition: 'max-width 0.25s ease',
              }}>
                {isStarted && currentStep <= sortedQuestions.length && (
                  <div style={{ marginBottom: '1.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '8px' }}>
                      <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                        Question {currentPosition + 1} of {totalVisible}
                      </span>
                      <span style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--accent-primary)' }}>{progressPercent}%</span>
                    </div>
                    <div style={{ height: '8px', background: 'var(--border)', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{
                        height: '100%', width: `${progressPercent}%`,
                        background: 'linear-gradient(90deg, var(--accent-primary), var(--accent-secondary))',
                        borderRadius: '4px', transition: 'width 0.4s ease',
                      }} />
                    </div>
                  </div>
                )}
                {!isTestMode && loading && !currentSurvey ? (
                  <div style={{ textAlign: 'center', padding: '5rem', color: 'var(--text-muted)' }}>Loading survey content...</div>
                ) : (
                  renderQuestion()
                )}
              </div>
            )}
          </div>
        </div>
      )}

      <style>{`
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes slide-in {
          from { opacity: 0; transform: translateX(20px); }
          to { opacity: 1; transform: translateX(0); }
        }
        .modal-scroll::-webkit-scrollbar { width: 8px; }
        .modal-scroll::-webkit-scrollbar-track { background: transparent; }
        .modal-scroll::-webkit-scrollbar-thumb {
          background: rgba(0,0,0,0.1); border-radius: 10px;
          border: 2px solid transparent; background-clip: content-box;
        }
        .modal-scroll::-webkit-scrollbar-thumb:hover {
          background: rgba(0,0,0,0.2); background-clip: content-box;
        }
        body.dark .modal-scroll::-webkit-scrollbar-thumb {
          background: rgba(255,255,255,0.1); background-clip: content-box;
        }
        body.dark .modal-scroll::-webkit-scrollbar-thumb:hover {
          background: rgba(255,255,255,0.2); background-clip: content-box;
        }
        .take-survey-bg {
          background-image: url(${pageBackground});
          background-size: cover;
          background-position: top center;
          background-repeat: no-repeat;
        }
      `}</style>
    </div>
  );
};

export default SurveyForm;
