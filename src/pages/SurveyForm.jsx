import { useEffect, useState, useMemo } from 'react';
import useSurveyStore from '../store/useSurveyStore';
import useAuthStore from '../store/useAuthStore';
import { Send, CheckCircle, Mail, Music, ArrowRight, ArrowLeft, X, ClipboardList, ChevronRight } from 'lucide-react';

const SurveyForm = ({ previewSurveyId = null, onClosePreview = null }) => {
  const { fetchSurveyDetail, currentSurvey, loading } = useSurveyStore();
  const { user } = useAuthStore();
  const [selectedSurveyId, setSelectedSurveyId] = useState(previewSurveyId || '');
  const [email, setEmail] = useState(user?.username || '');
  const [answers, setAnswers] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(!!previewSurveyId);
  
  // Navigation States
  const [currentStep, setCurrentStep] = useState(0); // 0 = ID, 1+ = Questions
  const [path, setPath] = useState([0]); // Track the sequence of indices visited
  const [isStarted, setIsStarted] = useState(false);

  const surveys = user?.assigned_surveys || [];

  const sortedQuestions = useMemo(() => {
    if (!currentSurvey?.questions) return [];
    return [...currentSurvey.questions].sort((a, b) => a.order - b.order);
  }, [currentSurvey]);

  useEffect(() => {
    if (previewSurveyId) {
      setSelectedSurveyId(previewSurveyId);
      setIsModalOpen(true);
    }
  }, [previewSurveyId]);

  useEffect(() => {
    if (selectedSurveyId) {
      fetchSurveyDetail(selectedSurveyId);
      setAnswers({});
      setSubmitted(false);
      setIsModalOpen(true);
      setCurrentStep(0);
      setPath([0]);
      setIsStarted(false);
    }
  }, [selectedSurveyId]);

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedSurveyId('');
    setIsStarted(false);
    if (onClosePreview) onClosePreview();
  };

  const handleAnswerChange = (qId, value) => {
    setAnswers(prev => ({ ...prev, [qId]: value }));
  };

  const handleCheckboxChange = (qId, option, checked) => {
    const currentAnswers = answers[qId] ? JSON.parse(answers[qId]) : [];
    const newAnswers = checked
      ? [...currentAnswers, option]
      : currentAnswers.filter(a => a !== option);
    setAnswers(prev => ({ ...prev, [qId]: JSON.stringify(newAnswers) }));
  };

  const handleNext = () => {
    if (currentStep === 0) {
      if (!email) return alert('Please enter your email');
      setCurrentStep(1);
      setPath([...path, 1]);
      setIsStarted(true);
      return;
    }

    const currentQIdx = currentStep - 1;
    const q = sortedQuestions[currentQIdx];
    
    // Validation
    if (q.required && (!answers[q.id] || answers[q.id] === '[]')) {
      return alert('This question is required');
    }

    // Branching Logic
    let nextStep = currentStep + 1;
    
    // 1. Option-based branching
    if (q.question_type === 'radio' || q.question_type === 'checkbox' || q.question_type === 'multiple_choice' || q.question_type === 'select') {
      let selectedOption = null;
      
      if (q.question_type === 'checkbox') {
        try {
          const checkedTexts = answers[q.id] ? JSON.parse(answers[q.id]) : [];
          selectedOption = q.options?.find(o => checkedTexts.includes(o.option_text) && o.next_question !== null && o.next_question !== undefined && o.next_question !== '');
        } catch (e) {
          console.error("Error parsing checkbox options for branching", e);
        }
      } else {
        const selectedOptionText = answers[q.id];
        selectedOption = q.options?.find(o => o.option_text === selectedOptionText);
      }
      
      if (selectedOption && selectedOption.next_question !== null && selectedOption.next_question !== undefined && selectedOption.next_question !== '') {
        const targetJump = parseInt(selectedOption.next_question, 10);
        if (!isNaN(targetJump)) {
          if (targetJump === -1) {
            setCurrentStep(sortedQuestions.length + 1);
            setPath([...path, sortedQuestions.length + 1]);
            return; // Exit handleNext early
          } else {
            nextStep = targetJump + 1;
          }
        }
      }

      // Check for Red Flag
      if (selectedOption?.is_red_flag) {
        alert("⚠️ RED FLAG ALERT: A high-risk response has been detected. This will be flagged for immediate intervention.");
      }
    }

    // 2. Score-threshold branching (Jump Logic)
    if (q.scale && q.score_threshold !== null && q.score_threshold !== undefined && q.score_threshold !== '' && q.threshold_next_question !== null && q.threshold_next_question !== undefined && q.threshold_next_question !== '') {
      // Calculate cumulative score for this scale
      let scaleScore = 0;
      // Identify questions to aggregate from (support for named scales or specific indices like 4,5,6)
      const indices = String(q.scale).split(',').filter(x => x !== '').map(x => x.trim());
      const isNumericIndices = indices.length > 0 && indices.every(idx => !isNaN(idx));

      let scaleQuestions = [];
      if (isNumericIndices) {
        scaleQuestions = indices.map(idx => sortedQuestions[parseInt(idx, 10)]).filter(Boolean);
      } else {
        scaleQuestions = sortedQuestions.filter(sq => sq.scale === q.scale);
      }
      
      scaleQuestions.forEach(sq => {
        const ans = answers[sq.id];
        if (!ans) return;

        if (sq.question_type === 'checkbox') {
          try {
            const selectedTexts = JSON.parse(ans);
            selectedTexts.forEach(text => {
              const opt = sq.options?.find(o => o.option_text === text);
              if (opt) scaleScore += (parseInt(opt.score, 10) || 0);
            });
          } catch (e) { console.error("Error parsing checkbox scores", e); }
        } else if (sq.question_type === 'rating') {
          scaleScore += (parseInt(ans, 10) || 0);
        } else {
          const opt = sq.options?.find(o => o.option_text === ans);
          if (opt) scaleScore += (parseInt(opt.score, 10) || 0);
        }
      });

      const thresholdVal = parseInt(q.score_threshold, 10);
      if (!isNaN(thresholdVal)) {
        console.log(`Scale ${q.scale} total performance: ${scaleScore} / Threshold: ${thresholdVal}`);

        if (scaleScore >= thresholdVal) {
          const targetJump = parseInt(q.threshold_next_question, 10);
          if (!isNaN(targetJump)) {
            console.log(`Threshold met! Redirecting to index ${targetJump}`);
            if (targetJump === -1) {
              setCurrentStep(sortedQuestions.length + 1);
              setPath([...path, sortedQuestions.length + 1]);
              return; // Stop further execution in this step
            } else {
              nextStep = targetJump + 1;
            }
          }
        }
      }
    }

    if (nextStep > sortedQuestions.length) {
      // It's the end, handle submit or just show a "Finish" button
      // For now, we'll let the user click a final submit button
      setCurrentStep(sortedQuestions.length + 1);
      setPath([...path, sortedQuestions.length + 1]);
    } else {
      setCurrentStep(nextStep);
      setPath([...path, nextStep]);
    }
  };

  const handleBack = () => {
    if (path.length <= 1) return;
    const newPath = [...path];
    newPath.pop(); // Remove current step
    const prevStep = newPath[newPath.length - 1];
    setPath(newPath);
    setCurrentStep(prevStep);
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!email) return alert('Email required');

    const payload = {
      survey_id: parseInt(selectedSurveyId),
      respondent_email: email,
      answers: Object.entries(answers).map(([qId, text]) => ({
        question_id: parseInt(qId),
        answer_text: String(text)
      }))
    };

    try {
      const response = await fetch(`http://localhost:8000/api/surveys/${selectedSurveyId}/responses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (response.ok) {
        setSubmitted(true);
        setTimeout(() => {
          setSubmitted(false);
          handleCloseModal();
        }, 3000);
      }
    } catch (err) {
      console.error(err);
    }
  };

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

  const renderQuestion = () => {
    if (currentStep === 0) {
      return (
        <div style={{ animation: 'slide-in 0.3s ease-out' }}>
          <div style={{ marginBottom: '4rem', paddingBottom: '3.5rem' }}>
            <label style={{ fontSize: '0.8rem', fontWeight: 850, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: '16px' }}>
              Respondent Identification
            </label>
            <div style={{ position: 'relative', maxWidth: '800px' }}>
              <Mail size={24} style={{ position: 'absolute', left: '20px', top: '50%', transform: 'translateY(-50%)', color: 'var(--accent-primary)' }} />
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="Enter your registered email ID"
                style={{ 
                  paddingLeft: '60px', 
                  fontSize: '1.1rem', 
                  height: '64px', 
                  borderRadius: '16px',
                  background: 'var(--bg-main)',
                  border: '2px solid var(--border)',
                  fontWeight: 600
                }}
              />
            </div>
            <p style={{ marginTop: '1.5rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>We use this to track your assessment progress and save your results.</p>
          </div>
          <button className="primary" onClick={handleNext} style={{ width: '100%', height: '64px', fontSize: '1.2rem', fontWeight: 800, borderRadius: '16px' }}>
            Start Survey <ChevronRight size={24} style={{ marginLeft: '10px' }} />
          </button>
        </div>
      );
    }

    if (currentStep > sortedQuestions.length) {
      return (
        <div style={{ textAlign: 'center', padding: '3rem', animation: 'slide-in 0.3s ease-out' }}>
          <div style={{ width: '80px', height: '80px', background: 'rgba(76, 140, 228, 0.1)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 2rem', color: 'var(--accent-primary)' }}>
            <CheckCircle size={40} />
          </div>
          <h3 style={{ fontSize: '1.8rem', fontWeight: 800, marginBottom: '1rem' }}>All Done!</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem', marginBottom: '3rem' }}>You have completed all the questions in this survey. Click below to submit your final response.</p>
          <div style={{ display: 'flex', gap: '15px' }}>
            <button onClick={handleBack} style={{ flex: 1, height: '60px', background: 'none', border: '1px solid var(--border)', fontWeight: 700 }}>Go Back</button>
            <button className="primary" onClick={handleSubmit} style={{ flex: 2, height: '60px', fontSize: '1.1rem', fontWeight: 800, borderRadius: '16px' }}>
              <Send size={22} style={{ marginRight: '10px' }} /> Submit My Entry
            </button>
          </div>
        </div>
      );
    }

    const q = sortedQuestions[currentStep - 1];
    const isLast = currentStep === sortedQuestions.length;

    // Logic to find images for selected options
    const getActiveImages = () => {
      if (!q.options) return [];
      const currentVal = answers[q.id];
      if (!currentVal) return [];

      if (q.question_type === 'checkbox') {
        try {
          const selectedTexts = JSON.parse(currentVal);
          return q.options
            .filter(opt => selectedTexts.includes(opt.option_text) && opt.media_url)
            .map(opt => opt.media_url);
        } catch { return []; }
      } else {
        const selectedOpt = q.options.find(opt => opt.option_text === currentVal);
        return selectedOpt?.media_url ? [selectedOpt.media_url] : [];
      }
    };

    const activeImages = getActiveImages();

    return (
      <div key={q.id} style={{ animation: 'slide-in 0.3s ease-out', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        <div style={{ display: 'flex', gap: '15px' }}>
          <span style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            minWidth: '32px', height: '32px', borderRadius: '10px',
            background: 'var(--accent-primary)', color: 'white',
            fontSize: '0.9rem', fontWeight: 800, flexShrink: 0
          }}>{currentStep}</span>
          <label style={{ fontWeight: 700, fontSize: '1.3rem', lineHeight: 1.4 }}>
            {q.question_text}{q.required && <span style={{ color: '#ef4444', marginLeft: '4px' }}>*</span>}
          </label>
        </div>

        {/* Priority 1: Dynamic Choice Images */}
        {activeImages.length > 0 ? (
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: activeImages.length > 1 ? 'repeat(auto-fit, minmax(200px, 1fr))' : '1fr',
            gap: '15px',
            background: 'var(--bg-main)',
            padding: '1.5rem',
            borderRadius: '20px',
            border: '2px solid var(--accent-primary)',
            animation: 'fade-in 0.3s'
          }}>
            {activeImages.map((url, idx) => (
              <img 
                key={idx} 
                src={url} 
                alt={`Selection ${idx}`} 
                style={{ width: '100%', maxHeight: '400px', objectFit: 'contain', borderRadius: '12px' }} 
              />
            ))}
          </div>
        ) : (
          /* Priority 2: Static Question Media */
          renderMedia(q.media_type, q.media_url)
        )}

        <div style={{ 
          background: 'var(--bg-card)', 
          padding: '2rem', 
          borderRadius: '24px', 
          boxShadow: '0 10px 30px rgba(0,0,0,0.05)',
          border: '1px solid var(--border)'
        }}>
          {(q.question_type === 'text' || q.question_type === 'short_text') && (
            <input
              type="text"
              required={q.required}
              value={answers[q.id] || ''}
              placeholder="Your response..."
              onChange={e => handleAnswerChange(q.id, e.target.value)}
              style={{ height: '60px', borderRadius: '12px', fontSize: '1.1rem' }}
            />
          )}

          {q.question_type === 'long_text' && (
            <textarea
              required={q.required}
              value={answers[q.id] || ''}
              rows={6}
              placeholder="Provide detailed response..."
              onChange={e => handleAnswerChange(q.id, e.target.value)}
              style={{ borderRadius: '12px', fontSize: '1.1rem', padding: '1.5rem' }}
            />
          )}

          {q.question_type === 'rating' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
               <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 5px' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-muted)' }}>{q.low_label || 'Low'}</span>
                  <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-muted)' }}>{q.high_label || 'High'}</span>
               </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {Array.from({ length: q.rating_max || 5 }).map((_, i) => {
                  const val = i + 1;
                  return (
                    <label key={val} style={{ cursor: 'pointer', flex: 1, minWidth: '45px' }}>
                      <input type="radio" name={`q-${q.id}`} value={val} checked={answers[q.id] == val} required={q.required} onChange={e => handleAnswerChange(q.id, e.target.value)} style={{ display: 'none' }} />
                      <div style={{
                        height: '60px', borderRadius: '12px',
                        background: answers[q.id] == val ? 'var(--accent-primary)' : 'var(--bg-sidebar)',
                        color: answers[q.id] == val ? 'white' : 'var(--text-main)',
                        border: `2px solid ${answers[q.id] == val ? 'var(--accent-primary)' : 'var(--border)'}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontWeight: 800, fontSize: '1.4rem', transition: 'all 0.2s',
                        boxShadow: answers[q.id] == val ? '0 10px 20px rgba(var(--accent-primary-rgb), 0.2)' : 'none'
                      }}>
                        {val}
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {(q.question_type === 'radio' || q.question_type === 'multiple_choice') && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
              {q.options?.sort((a, b) => a.order - b.order).map(opt => (
                <label key={opt.id} style={{
                  display: 'flex', flexDirection: 'column', gap: '10px',
                  cursor: 'pointer', padding: '18px', borderRadius: '16px',
                  background: answers[q.id] === opt.option_text ? 'rgba(var(--accent-primary-rgb), 0.05)' : 'var(--bg-sidebar)',
                  border: `2px solid ${answers[q.id] === opt.option_text ? 'var(--accent-primary)' : 'var(--border)'}`,
                  transition: 'all 0.2s', fontWeight: 600, fontSize: '1.1rem',
                  boxShadow: answers[q.id] === opt.option_text ? '0 5px 15px rgba(0,0,0,0.05)' : 'none'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <input type="radio" name={`q-${q.id}`} value={opt.option_text} checked={answers[q.id] === opt.option_text} required={q.required} onChange={e => handleAnswerChange(q.id, e.target.value)} style={{ width: '20px', height: '20px', accentColor: 'var(--accent-primary)', flexShrink: 0 }} />
                    <span style={{ flexGrow: 1 }}>{opt.option_text}</span>
                  </div>
                </label>
              ))}
            </div>
          )}

          {q.question_type === 'select' && (
            <select 
              value={answers[q.id] || ''} 
              required={q.required}
              onChange={e => handleAnswerChange(q.id, e.target.value)}
              style={{ height: '60px', borderRadius: '12px', fontSize: '1.1rem', padding: '0 20px', fontWeight: 600 }}
            >
              <option value="">Select an option...</option>
              {q.options?.sort((a, b) => a.order - b.order).map(opt => (
                <option key={opt.id} value={opt.option_text}>{opt.option_text}</option>
              ))}
            </select>
          )}

          {q.question_type === 'checkbox' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
              {q.options?.sort((a, b) => a.order - b.order).map(opt => {
                const isChecked = answers[q.id] ? JSON.parse(answers[q.id]).includes(opt.option_text) : false;
                return (
                  <label key={opt.id} style={{
                    display: 'flex', flexDirection: 'column', gap: '10px',
                    cursor: 'pointer', padding: '18px', borderRadius: '16px',
                    background: isChecked ? 'rgba(var(--accent-primary-rgb), 0.05)' : 'var(--bg-sidebar)',
                    border: `2px solid ${isChecked ? 'var(--accent-primary)' : 'var(--border)'}`,
                    transition: 'all 0.2s', fontWeight: 600, fontSize: '1.1rem'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <input type="checkbox" value={opt.option_text} checked={isChecked} onChange={e => handleCheckboxChange(q.id, opt.option_text, e.target.checked)} style={{ width: '20px', height: '20px', accentColor: 'var(--accent-primary)', flexShrink: 0 }} />
                      <span style={{ flexGrow: 1 }}>{opt.option_text}</span>
                    </div>
                  </label>
                );
              })}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: '15px' }}>
          <button 
            onClick={handleBack}
            style={{ 
              flex: 1, height: '64px', borderRadius: '16px', background: 'none', 
              border: '1px solid var(--border)', color: 'var(--text-muted)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              fontWeight: 700
            }}
          >
            <ArrowLeft size={20} /> Back
          </button>
          <button 
            className="primary" 
            onClick={handleNext} 
            style={{ flex: 2, height: '64px', borderRadius: '16px', fontSize: '1.1rem', fontWeight: 800 }}
          >
            {isLast ? 'Review & Finish' : 'Next Question'} <ChevronRight size={20} style={{ marginLeft: '8px' }} />
          </button>
        </div>
      </div>
    );
  };

  return (
    <div style={{ animation: 'fade-in 0.4s ease-out', padding: previewSurveyId ? '0' : '2rem' }}>
      {!previewSurveyId && (
        <>
          <div style={{ marginBottom: '2.5rem' }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '0.5rem' }}>My Surveys</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Select an assigned survey to begin your entry.</p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
            {surveys.map(s => (
              <button
                key={s.id}
                className="panel"
                onClick={() => setSelectedSurveyId(s.id)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '1.25rem 1.5rem', border: '1px solid var(--border)',
                  background: 'var(--bg-sidebar)', textAlign: 'left',
                  cursor: 'pointer', width: '100%', transition: 'all 0.2s',
                  borderRadius: '16px'
                }}
                onMouseEnter={e => { 
                  e.currentTarget.style.borderColor = 'var(--accent-primary)'; 
                  e.currentTarget.style.background = 'var(--bg-hover)';
                }}
                onMouseLeave={e => { 
                  e.currentTarget.style.borderColor = 'var(--border)'; 
                  e.currentTarget.style.background = 'var(--bg-sidebar)';
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                  <div style={{ 
                    width: '40px', height: '40px', borderRadius: '10px', 
                    background: 'rgba(76, 140, 228, 0.1)', color: 'var(--accent-primary)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                  }}>
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
          background: 'var(--bg-main)',
          display: 'flex', flexDirection: 'column',
          zIndex: 3000,
          animation: 'fade-in 0.3s ease-out'
        }}>
          {/* Header */}
          <div style={{ 
            background: 'var(--bg-card)', 
            padding: '1.5rem 2.5rem', borderBottom: '1px solid var(--border)',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            zIndex: 10
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
              <div style={{ width: '32px', height: '32px', background: 'var(--accent-primary)', color: 'white', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <ClipboardList size={18} />
              </div>
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 800 }}>{currentSurvey?.title || 'Survey Entry'}</h3>
                {isStarted && (
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                    Progress: {Math.round((currentStep / (sortedQuestions.length + 1)) * 100)}%
                  </div>
                )}
              </div>
            </div>
            <button 
              onClick={handleCloseModal}
              style={{ background: 'var(--bg-hover)', border: 'none', padding: '8px', borderRadius: '50%', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}
            >
              <X size={20} />
            </button>
          </div>

          <div className="modal-scroll" style={{ 
            flexGrow: 1, 
            display: 'flex',
            flexDirection: 'column',
            overflowY: 'auto',
            padding: '2rem 1rem'
          }}>
            {submitted ? (
              <div style={{ margin: 'auto', textAlign: 'center', padding: '4rem' }}>
                <div style={{ width: '100px', height: '100px', background: 'rgba(16,185,129,0.1)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 2.5rem', color: '#10b981' }}>
                  <CheckCircle size={56} />
                </div>
                <h2 style={{ fontSize: '2.5rem', fontWeight: 800, marginBottom: '1.5rem' }}>Success!</h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem' }}>Your entry has been recorded successfully.</p>
              </div>
            ) : (
              <div style={{ margin: 'auto', width: '100%', maxWidth: '900px' }}>
                {loading && !currentSurvey ? (
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
        .modal-scroll::-webkit-scrollbar {
          width: 8px;
        }
        .modal-scroll::-webkit-scrollbar-track {
          background: transparent;
        }
        .modal-scroll::-webkit-scrollbar-thumb {
          background: rgba(0, 0, 0, 0.1);
          border-radius: 10px;
          border: 2px solid transparent;
          background-clip: content-box;
        }
        .modal-scroll::-webkit-scrollbar-thumb:hover {
          background: rgba(0, 0, 0, 0.2);
          background-clip: content-box;
        }
        body.dark .modal-scroll::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.1);
          background-clip: content-box;
        }
        body.dark .modal-scroll::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.2);
          background-clip: content-box;
        }
      `}</style>
    </div>
  );
};

export default SurveyForm;
