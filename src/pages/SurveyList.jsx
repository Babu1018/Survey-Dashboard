import { useEffect, useState } from 'react';
import { Skeleton } from 'boneyard-js/react';
import useSurveyStore from '../store/useSurveyStore';
import {
  Plus,
  Search,
  ChevronRight,
  Hash,
  LayoutList,
  ArrowUpRight,
  Pencil,
  X,
  Clock,
  Copy,
  Wrench,
  Layers,
  Trash2
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import useNotificationStore from '../store/useNotificationStore';

const SurveyList = () => {
  const { surveys, fetchSurveys, loading, deleteSurvey, cloneSurvey, cleanupMedia, deleteSurveysByCategory } = useSurveyStore();
  const navigate = useNavigate();
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const [selectedBatch, setSelectedBatch] = useState(null);
  const [deleteCategoryConfirm, setDeleteCategoryConfirm] = useState(null);

  useEffect(() => {
    fetchSurveys();
  }, []);

  const baseBatches = ['AI', 'Developer', 'DevOps'];
  const dynamicBatches = surveys ? [...new Set(surveys.map(s => s.category).filter(Boolean))] : [];
  const batches = [...new Set([...baseBatches, ...dynamicBatches])].filter(batch => {
    return surveys.some(s => s.category === batch);
  });


  const filteredSurveys = selectedBatch ? surveys.filter(s => s.category === selectedBatch) : [];

  return (
    <div style={{ animation: 'fade-in 0.4s ease-out', maxWidth: '1400px', margin: '0 auto', padding: 'clamp(0.5rem, 2vw, 2rem)', paddingBottom: '5rem' }}>
      <Skeleton name="page-header" loading={loading}>
        <div className="page-header-container">
          <div className="page-header">
            <h1>SurveyLists</h1>
          </div>
          <div style={{ display: 'flex', gap: '15px' }}>
            <button
              onClick={async () => {
                const { showSuccess, showError } = useNotificationStore.getState();
                if (window.confirm("Are you sure you want to run maintenance? This will permanently delete orphaned media files.")) {
                  try {
                    const res = await cleanupMedia();
                    showSuccess(`Cleanup complete. Deleted ${res.deleted} orphaned files.`);
                  } catch (e) {
                    showError(e.message);
                  }
                }
              }}
              style={{
                height: '48px',
                padding: '0 1.5rem',
                background: 'transparent',
                border: '1px solid var(--border)',
                color: 'var(--text-muted)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: 600
              }}
            >
              <Wrench size={18} /> Cleanup Media
            </button>
            <button className="primary" onClick={() => navigate('/builder')} style={{ height: '48px', padding: '0 1.5rem', whiteSpace: 'nowrap' }}>
              <Plus size={18} /> New Survey
            </button>
          </div>
        </div>
      </Skeleton>

      {/* Batch Cards Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 320px))',
        gap: '1.5rem',
        marginTop: '1rem'
      }}>
        {batches.map(batch => {
          const count = surveys.filter(s => s.category === batch).length;
          return (
            <Skeleton key={batch} name={`batch-${batch.toLowerCase()}`} loading={loading}>
              <div
                className="panel"
                onClick={() => setSelectedBatch(batch)}
                style={{
                  background: 'var(--bg-main)',
                  padding: '1.5rem',
                  borderLeft: '4px solid var(--accent-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  textAlign: 'left',
                  width: '100%',
                  position: 'relative'
                }}
                onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-4px)'}
                onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{
                    width: '40px',
                    height: '40px',
                    background: 'rgba(var(--accent-primary-rgb), 0.1)',
                    color: 'var(--accent-primary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: '10px'
                  }}>
                    <Layers size={20} />
                  </div>
                  <div>
                    <h2 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>{batch}</h2>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '2px 0 0' }}>Surveys Category</p>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{
                    background: 'var(--accent-primary)',
                    color: 'white',
                    padding: '4px 10px',
                    borderRadius: '20px',
                    fontSize: '0.8rem',
                    fontWeight: 800
                  }}>
                    {count}
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteCategoryConfirm(batch);
                    }}
                    style={{
                      background: 'rgba(239, 68, 68, 0.1)',
                      border: 'none',
                      color: '#ef4444',
                      padding: '6px',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </Skeleton>
          );
        })}
      </div>

      {/* Floating Card (Modal) for Selected Batch */}
      {selectedBatch && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.6)',
          backdropFilter: 'blur(10px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '2rem'
        }}>
          <div className="panel modal-scroll" style={{
            background: 'var(--bg-main)',
            width: '100%',
            maxWidth: '700px',
            maxHeight: '85vh',
            overflowY: 'auto',
            borderRadius: '24px',
            boxShadow: '0 30px 60px rgba(0,0,0,0.4)',
            display: 'flex',
            flexDirection: 'column',
            position: 'relative'
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '1.5rem 2rem',
              borderBottom: '1px solid var(--border)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              position: 'sticky',
              top: 0,
              background: 'var(--bg-main)',
              zIndex: 20
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-main)' }}>{selectedBatch}</h2>
                <span style={{
                  background: 'var(--accent-primary)',
                  color: 'white',
                  padding: '2px 8px',
                  borderRadius: '6px',
                  fontSize: '0.75rem',
                  fontWeight: 800
                }}>
                  {filteredSurveys.length} Surveys
                </span>
              </div>
              <button
                onClick={() => setSelectedBatch(null)}
                style={{
                  background: 'var(--bg-hover)',
                  border: 'none',
                  padding: '8px',
                  borderRadius: '50%',
                  cursor: 'pointer',
                  color: 'var(--text-muted)',
                  display: 'flex'
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Content */}
            <div style={{ padding: '1.5rem 2rem 2.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {filteredSurveys.map(survey => (
                <div key={survey.id} className="panel" style={{
                  background: 'var(--bg-sidebar)',
                  padding: '1rem 1.25rem',
                  border: '1px solid var(--border)',
                  transition: 'all 0.2s ease',
                  cursor: 'pointer',
                  position: 'relative'
                }}
                  onClick={() => navigate(`/builder/${survey.id}`)}>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ flexGrow: 1, minWidth: 0 }}>
                      <h3 style={{ fontSize: '1.05rem', fontWeight: 600, margin: 0, color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {survey.title}
                      </h3>
                      <div style={{ display: 'flex', gap: '12px', marginTop: '6px', fontSize: '0.75rem' }}>
                        <div style={{ color: 'var(--accent-primary)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Pencil size={12} /> Edit
                        </div>
                        <div
                          onClick={async (e) => {
                            e.stopPropagation();
                            const { showSuccess, showError } = useNotificationStore.getState();
                            if (window.confirm('Clone this survey?')) {
                              try {
                                await cloneSurvey(survey.id);
                                showSuccess('Survey Cloned Successfully');
                              } catch {
                                showError('Failed to clone survey');
                              }
                            }
                          }}
                          style={{ color: 'var(--accent-primary)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}
                        >
                          <Copy size={12} /> Clone
                        </div>
                        <div style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Clock size={12} /> {new Date(survey.updated_at).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <button
                        onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(survey.id); }}
                        style={{
                          background: 'rgba(239, 68, 68, 0.1)',
                          border: 'none',
                          color: '#ef4444',
                          padding: '6px',
                          borderRadius: '6px',
                          cursor: 'pointer'
                        }}
                      >
                        <X size={16} />
                      </button>
                      <ArrowUpRight size={18} color="var(--text-muted)" />
                    </div>
                  </div>
                </div>
              ))}

              {filteredSurveys.length === 0 && (
                <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)', border: '1px dashed var(--border)', borderRadius: '16px' }}>
                  No surveys in this category.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {deleteConfirmId && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.6)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1100
        }}>
          <div className="panel" style={{
            background: 'var(--bg-main)',
            padding: '2rem',
            borderRadius: '16px',
            maxWidth: '400px',
            width: '90%'
          }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Delete Survey</h3>
            <p style={{ color: 'var(--text-muted)', margin: '1rem 0 2rem' }}>Are you sure you want to delete this survey?</p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button onClick={() => setDeleteConfirmId(null)} style={{ background: 'none', border: '1px solid var(--border)' }}>Cancel</button>
              <button
                onClick={async () => {
                  const { showSuccess, showError } = useNotificationStore.getState();
                  try {
                    await deleteSurvey(deleteConfirmId);
                    showSuccess('Survey Deleted');
                    setDeleteConfirmId(null);
                  } catch {
                    showError('Failed to delete survey');
                  }
                }}
                style={{ background: '#ef4444', color: 'white', border: 'none' }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
      {deleteCategoryConfirm && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.6)',
          backdropFilter: 'blur(10px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 2000
        }}>
          <div className="panel" style={{
            background: 'var(--bg-main)',
            padding: '2.5rem',
            borderRadius: '24px',
            maxWidth: '450px',
            width: '90%',
            textAlign: 'center',
            boxShadow: '0 40px 80px rgba(0,0,0,0.5)'
          }}>
            <div style={{
              width: '60px',
              height: '60px',
              background: 'rgba(239, 68, 68, 0.1)',
              color: '#ef4444',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '50%',
              margin: '0 auto 1.5rem'
            }}>
              <Trash2 size={30} />
            </div>
            <h3 style={{ fontSize: '1.5rem', fontWeight: 800, margin: '0 0 1rem' }}>Delete Category?</h3>
            <p style={{ color: 'var(--text-muted)', lineHeight: '1.6', margin: '0 0 2rem' }}>
              Are you sure you want to delete the <span style={{ color: 'var(--text-main)', fontWeight: 700 }}>"{deleteCategoryConfirm}"</span> category? This will permanently delete all associated surveys and data.
            </p>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => setDeleteCategoryConfirm(null)}
                style={{ flex: 1, background: 'var(--bg-hover)', border: '1px solid var(--border)', fontWeight: 700 }}
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  const { showSuccess, showError } = useNotificationStore.getState();
                  try {
                    await deleteSurveysByCategory(deleteCategoryConfirm);
                    showSuccess(`Category "${deleteCategoryConfirm}" and all its surveys deleted.`);
                    setDeleteCategoryConfirm(null);
                  } catch {
                    showError('Failed to delete category');
                  }
                }}
                style={{ flex: 1, background: '#ef4444', color: 'white', border: 'none', fontWeight: 700 }}
              >
                Delete All
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SurveyList;
