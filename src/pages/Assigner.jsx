import { useEffect, useState } from 'react';
import useSurveyStore from '../store/useSurveyStore';
import { 
  Users, 
  UserPlus, 
  ChevronRight, 
  ChevronLeft,
  Link as LinkIcon, 
  MoreHorizontal, 
  ClipboardList, 
  Lock, 
  Shield, 
  Trash2, 
  Edit3, 
  Check, 
  X,
  Plus,
  Search
} from 'lucide-react';
import useNotificationStore from '../store/useNotificationStore';

const Assigner = () => {
  const { showSuccess, showError } = useNotificationStore();
  const { 
    groups, 
    surveys, 
    users,
    fetchGroups, 
    fetchSurveys, 
    fetchUsers,
    createGroup, 
    assignSurveyToGroup,
    createUser,
    deleteUser,
    updateUser,
    assignSurveyToUser,
    unassignSurveyFromUser,
    assignUserToGroup,
    unassignUserFromGroup,
    deleteGroup,
    unassignSurveyFromGroup,
    updateGroup
  } = useSurveyStore();

  const [activeTab, setActiveTab] = useState('users'); 

  // Group State
  const [newGroupName, setNewGroupName] = useState('');
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [selectedGroupSurveyId, setSelectedGroupSurveyId] = useState('');

  // User State
  const [newUsername, setNewUsername] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('password123'); 
  const [newUserRole, setNewUserRole] = useState('User');
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedUserSurveyId, setSelectedUserSurveyId] = useState('');
  const [userSearchTerm, setUserSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('All');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 21;
  
  // Edit State
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editRole, setEditRole] = useState('');
  
  const [isEditingGroup, setIsEditingGroup] = useState(false);
  const [editGroupName, setEditGroupName] = useState('');

  // Group Member Management State
  const [memberSubTab, setMemberSubTab] = useState('assigned'); // 'assigned' or 'unassigned'
  const [memberSearchTerm, setMemberSearchTerm] = useState('');

  useEffect(() => {
    fetchGroups();
    fetchSurveys();
    fetchUsers();
  }, []);

  useEffect(() => {
    if (selectedUser) {
      const updated = users.find(u => u.id === selectedUser.id);
      if (updated) setSelectedUser(updated);
      else setSelectedUser(null);
      
      if (!isEditing) {
        setEditName(selectedUser.username);
        setEditRole(selectedUser.role);
      }
    }
  }, [users, selectedUser?.id]);

  useEffect(() => {
    if (selectedGroup) {
      const updated = groups.find(g => g.id === selectedGroup.id);
      if (updated) setSelectedGroup(updated);
      else setSelectedGroup(null);
      
      if (!isEditingGroup) {
        setEditGroupName(selectedGroup.name);
      }
    }
  }, [groups, selectedGroup?.id]);

  const handleCreateGroup = async (e) => {
    e.preventDefault();
    if (newGroupName) {
      const created = await createGroup(newGroupName);
      setNewGroupName('');
      if (created) setSelectedGroup(created);
      showSuccess('Group Added.');
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    if (newUsername && newUserPassword) {
      try {
        await createUser({
          username: newUsername,
          password: newUserPassword,
          role: newUserRole,
          assigned_survey_id: selectedUserSurveyId ? parseInt(selectedUserSurveyId) : null
        });
        setNewUsername('');
        setNewUserPassword('password123');
        setSelectedUserSurveyId('');
        showSuccess('User Added.');
      } catch (err) {
        showError(err.message || 'Failed to create user');
      }
    }
  };

  const handleUpdateUser = async () => {
    if (!selectedUser) return;
    try {
      await updateUser(selectedUser.id, {
        username: editName,
        role: editRole
      });
      setIsEditing(false);
      showSuccess('Changes Saved.');
    } catch (err) {
      showError(err.message || 'Update failed');
    }
  };

  const handleAssignToGroup = async () => {
    if (selectedGroup && selectedGroupSurveyId) {
      try {
        if (selectedGroup.surveys && selectedGroup.surveys.length > 0) {
          for (const s of selectedGroup.surveys) {
            await unassignSurveyFromGroup(selectedGroup.id, s.id);
          }
        }
        await assignSurveyToGroup(selectedGroup.id, selectedGroupSurveyId);
        showSuccess(`Assignment Saved.`);
        setSelectedGroupSurveyId(''); 
      } catch (err) {
        showError(err.message || 'Failed to assign');
      }
    }
  };

  const handleToggleGroupUser = async (user, isChecked) => {
    if (!selectedGroup) return;
    try {
        if (isChecked) {
            await assignUserToGroup(selectedGroup.id, user.id);
            showSuccess(`Added ${user.username} to group`);
        } else {
            await unassignUserFromGroup(selectedGroup.id, user.id);
            showSuccess(`Removed ${user.username} from group`);
        }
    } catch {
        showError('Failed to update group member');
    }
  };

  const handleUnassignFromGroup = async (surveyId) => {
    if (selectedGroup) {
        try {
            await unassignSurveyFromGroup(selectedGroup.id, surveyId);
            showSuccess(`Unassigned survey from group`);
        } catch (err) {
            showError(err.message || 'Failed to unassign');
        }
    }
  };

  const handleUpdateGroup = async () => {
    if (!selectedGroup) return;
    try {
      await updateGroup(selectedGroup.id, { name: editGroupName });
      setIsEditingGroup(false);
      showSuccess('Name Saved.');
    } catch (err) {
        showError(err.message || 'Update failed');
    }
  };

  const handleDeleteGroup = async () => {
    if (selectedGroup && window.confirm(`Are you sure you want to permanently delete group "${selectedGroup.name}"?`)) {
        try {
            await deleteGroup(selectedGroup.id);
            showSuccess(`Group ${selectedGroup.name} removed.`);
            setSelectedGroup(null);
        } catch (err) {
            showError(err.message || 'Error deleting group');
        }
    }
  };

  const handleAssignToUser = async () => {
    if (selectedUser && selectedUserSurveyId) {
      try {
        if (selectedUser.direct_surveys && selectedUser.direct_surveys.length > 0) {
          for (const s of selectedUser.direct_surveys) {
            await unassignSurveyFromUser(selectedUser.id, s.id);
          }
        }
        await assignSurveyToUser(selectedUser.id, selectedUserSurveyId);
        showSuccess(`Assignment Saved.`);
        setSelectedUserSurveyId('');
      } catch (err) {
         showError(err.message || 'Failed to assign');
      }
    }
  };

  const handleUnassignFromUser = async (surveyId) => {
    if (selectedUser) {
        try {
            await unassignSurveyFromUser(selectedUser.id, surveyId);
            showSuccess(`Unassigned from user: ${selectedUser.username}`);
        } catch (err) {
            showError(err.message || 'Failed to unassign');
        }
    }
  };

  const handleDeleteUser = async () => {
    if (selectedUser && window.confirm(`Are you sure you want to permanently delete user "${selectedUser.username}"?`)) {
        try {
            const success = await deleteUser(selectedUser.id);
            if (success) {
                showSuccess(`User ${selectedUser.username} removed from database.`);
                setSelectedUser(null);
            } else {
                showError('Failed to delete user.');
            }
        } catch (err) {
            showError(err.message || 'Error deleting user');
        }
    }
  };

  const filteredUsers = users.filter(u => {
    const matchesSearch = u.username.toLowerCase().includes(userSearchTerm.toLowerCase());
    const matchesRole = roleFilter === 'All' || u.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const totalPages = Math.ceil(filteredUsers.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedUsers = filteredUsers.slice(startIndex, startIndex + itemsPerPage);

  // Reset to first page when search or filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [userSearchTerm, roleFilter]);

  return (
    <div style={{ animation: 'fade-in 0.4s ease-out', maxWidth: '1400px', margin: '0 auto', height: 'calc(100vh - 160px)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Detail Overlay / Modal */}
      {selectedUser && (
        <>
          <div 
            onClick={() => setSelectedUser(null)}
            style={{ 
              position: 'fixed', 
              inset: 0, 
              background: 'rgba(0, 0, 0, 0.4)', 
              backdropFilter: 'blur(8px)',
              zIndex: 1000,
              animation: 'fade-in 0.3s ease-out'
            }} 
          />
          <div 
            style={{ 
              position: 'fixed', 
              top: '50%', 
              left: '50%', 
              transform: 'translate(-50%, -50%)', 
              zIndex: 1001, 
              width: '90%', 
              maxWidth: '900px',
              animation: 'pop-in 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
            }}
          >
            {/* Close Button - Outside the scrollable area */}
            <button 
              onClick={() => setSelectedUser(null)} 
              style={{ 
                position: 'absolute', 
                top: '-15px', 
                right: '-15px', 
                background: '#1e293b', 
                border: '3px solid #ffffff', 
                borderRadius: '50%', 
                width: '40px', 
                height: '40px', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                cursor: 'pointer', 
                boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3)',
                zIndex: 1005,
                transition: 'all 0.2s',
                color: 'white',
                padding: 0
              }}
              className="modal-close-btn"
              title="Close"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>

            {/* Scrollable Panel */}
            <div 
              className="panel" 
              style={{ 
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
                maxHeight: '90vh',
                overflowY: 'auto',
                overflowX: 'hidden',
                width: '100%'
              }}
            >

            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(220px, 1fr) minmax(300px, 1.5fr)', gap: '1.5rem', padding: '1.5rem' }}>
              {/* Left Column: User Info */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                  <div style={{ 
                    width: '64px', height: '64px', borderRadius: '16px', background: 'var(--accent-primary)', 
                    color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '1.5rem'
                  }}>
                    {selectedUser.username[0].toUpperCase()}
                  </div>
                  <div style={{ flexGrow: 1 }}>
                    {isEditing ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <input value={editName} onChange={e => setEditName(e.target.value)} placeholder="Username" style={{ fontSize: '1.25rem', fontWeight: 700 }} />
                        <select value={editRole} onChange={e => setEditRole(e.target.value)}>
                          <option value="User">User</option>
                          <option value="Manager">Manager</option>
                          <option value="Admin">Admin</option>
                        </select>
                        <div style={{ display: 'flex', gap: '8px', marginTop: '5px' }}>
                          <button className="primary" onClick={handleUpdateUser} style={{ padding: '6px 12px', fontSize: '0.75rem' }}><Check size={14} /> Save</button>
                          <button onClick={() => setIsEditing(false)} style={{ padding: '6px 12px', fontSize: '0.75rem' }}><X size={14} /> Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <h2 style={{ fontSize: '2rem', fontWeight: 800, margin: 0 }}>{selectedUser.username}</h2>
                          <button onClick={() => setIsEditing(true)} style={{ background: 'none', border: 'none', color: 'var(--accent-primary)', padding: 0 }}><Edit3 size={18} /></button>
                        </div>
                        <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{selectedUser.role}</span>
                      </>
                    )}
                  </div>
                </div>
                
                <div style={{ marginTop: 'auto' }}>
                   <button onClick={handleDeleteUser} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.1)', color: '#ef4444', padding: '10px 20px', borderRadius: '8px', fontWeight: 700, cursor: 'pointer', width: '100%', justifyContent: 'center' }}>
                    <Trash2 size={16} color="#ef4444" style={{ width: '16px', height: '16px' }} /> Delete User Profile
                  </button>
                </div>
              </div>

              {/* Right Column: Assignments */}
              <div style={{ borderLeft: '1px solid var(--border)', paddingLeft: '3rem' }}>
                <h4 style={{ fontSize: '0.85rem', fontWeight: 800, marginBottom: '1.5rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Active Assignments</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {selectedUser.direct_surveys?.map(s => (
                    <div key={`direct-${s.id}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px 20px', background: 'var(--bg-main)', borderRadius: '12px', border: '1px solid var(--border)' }}>
                      <div>
                        <div className="truncate" style={{ fontSize: '1rem', fontWeight: 700, maxWidth: '250px' }} title={`${s.title} (${s.category} Batch)`}>{s.title}</div>
                        <div style={{ fontSize: '0.65rem', color: 'var(--accent-primary)', fontWeight: 800, textTransform: 'uppercase', marginTop: '4px' }}>Direct Assignment</div>
                      </div>
                      <button 
                        onClick={() => handleUnassignFromUser(s.id)} 
                        style={{ 
                          color: '#ef4444', 
                          border: 'none', 
                          background: '#fee2e2', 
                          width: '42px', 
                          height: '42px', 
                          borderRadius: '12px', 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'center', 
                          cursor: 'pointer' 
                        }} 
                        title="Revoke Assignment"
                      >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block', width: '20px', height: '20px', flexShrink: 0 }}>
                          <polyline points="3 6 5 6 21 6"></polyline>
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                          <line x1="10" y1="11" x2="10" y2="17"></line>
                          <line x1="14" y1="11" x2="14" y2="17"></line>
                        </svg>
                      </button>
                    </div>
                  ))}

                  {selectedUser.assigned_surveys?.filter(s => !selectedUser.direct_surveys?.some(ds => ds.id === s.id)).map(s => (
                    <div key={`group-${s.id}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px 20px', background: 'var(--bg-sidebar)', borderRadius: '12px', border: '1px solid var(--border)', opacity: 0.8 }}>
                      <div>
                        <div className="truncate" style={{ fontSize: '1rem', fontWeight: 600, maxWidth: '250px' }} title={`${s.title} (${s.category} Batch)`}>{s.title}</div>
                        <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', marginTop: '4px' }}>Inherited from Group</div>
                      </div>
                      <Lock size={14} color="var(--text-muted)" />
                    </div>
                  ))}

                  {(!selectedUser.assigned_surveys || selectedUser.assigned_surveys.length === 0) && (
                    <div style={{ padding: '2rem', border: '1px dashed var(--border)', borderRadius: '12px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                      No surveys assigned.
                    </div>
                  )}

                  <div style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border)' }}>
                     <label style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-muted)', marginBottom: '12px', display: 'block' }}>ASSIGN NEW SURVEY</label>
                     <div style={{ display: 'flex', gap: '10px' }}>
                        <select value={selectedUserSurveyId} onChange={e => setSelectedUserSurveyId(e.target.value)} style={{ flexGrow: 1, padding: '12px', borderRadius: '10px', background: 'var(--bg-main)', border: '1px solid var(--border)', fontSize: '0.9rem' }}>
                           <option value="">Select survey...</option>
                           {surveys.filter(s => !selectedUser.assigned_surveys?.some(assigned => assigned.id === s.id)).map(s => (
                             <option key={s.id} value={s.id}>{s.title}</option>
                           ))}
                        </select>
                        <button className="primary" onClick={handleAssignToUser} disabled={!selectedUserSurveyId} style={{ padding: '0 20px', borderRadius: '10px' }}>
                          <LinkIcon size={18} />
                        </button>
                     </div>
                  </div>
                </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )}

      <div className="page-header-container">
        <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1>Member & Assignment</h1>
            <p>Create users or groups and assign model question surveys.</p>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button 
              className={activeTab === 'users' ? 'primary' : ''} 
              onClick={() => setActiveTab('users')}
              style={{ padding: '8px 16px', borderRadius: '8px', border: activeTab !== 'users' ? '1px solid var(--border)' : 'none', background: activeTab !== 'users' ? 'transparent' : '', color: activeTab !== 'users' ? 'var(--text-main)' : '', fontSize: '0.9rem', fontWeight: 600, transition: 'all 0.2s' }}
            >
              Users
            </button>
            <button 
              className={activeTab === 'groups' ? 'primary' : ''} 
              onClick={() => setActiveTab('groups')}
               style={{ padding: '8px 16px', borderRadius: '8px', border: activeTab !== 'groups' ? '1px solid var(--border)' : 'none', background: activeTab !== 'groups' ? 'transparent' : '', color: activeTab !== 'groups' ? 'var(--text-main)' : '', fontSize: '0.9rem', fontWeight: 600, transition: 'all 0.2s' }}
            >
              Groups
            </button>
          </div>
        </div>
      </div>


      {activeTab === 'groups' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(260px, 350px) 1fr', gap: '2rem', flex: 1, overflow: 'hidden', paddingBottom: '1rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', overflow: 'hidden' }}>
            <div className="panel">
              <h3 style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: '1.25rem', color: 'var(--text-muted)' }}>ADD GROUP</h3>
              <form onSubmit={handleCreateGroup} style={{ display: 'flex', gap: '10px' }}>
                <input 
                  value={newGroupName} 
                  onChange={e => setNewGroupName(e.target.value)} 
                  placeholder="Group name..."
                  required
                />
                <button className="primary" type="submit">Add</button>
              </form>
            </div>

            <div className="panel" style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <h3 style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: '1.25rem', color: 'var(--text-muted)' }}>ACTIVE GROUPS</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', overflowY: 'auto', flex: 1, paddingRight: '4px' }}>
                {groups.map(group => (
                  <div 
                    key={group.id} 
                    onClick={() => setSelectedGroup(group)}
                    className={`nav-item ${selectedGroup?.id === group.id ? 'active' : ''}`}
                    style={{ justifyContent: 'space-between', padding: '0.75rem 1rem', margin: 0 }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <Users size={16} />
                      <span>{group.name}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="panel" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {!selectedGroup ? (
              <div style={{ textAlign: 'center', padding: '5rem', opacity: 0.5 }}>Select a group</div>
            ) : (
               <>
                 <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                   <div style={{ flexGrow: 1 }}>
                     {isEditingGroup ? (
                        <div style={{ display: 'flex', gap: '10px' }}>
                          <input value={editGroupName} onChange={e => setEditGroupName(e.target.value)} style={{ padding: '5px 10px' }} />
                          <button className="primary" onClick={handleUpdateGroup} style={{ padding: '5px 12px' }}><Check size={14} /></button>
                          <button onClick={() => { setIsEditingGroup(false); setEditGroupName(selectedGroup.name); }} style={{ padding: '5px 12px' }}><X size={14} /></button>
                        </div>
                     ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                          <h2 style={{ fontSize: '1.5rem', margin: 0 }}>{selectedGroup.name}</h2>
                          <button onClick={() => { setIsEditingGroup(true); setEditGroupName(selectedGroup.name); }} style={{ background: 'none', border: 'none', color: 'var(--accent-primary)', cursor: 'pointer', padding: 0 }}>
                            <Edit3 size={16} />
                          </button>
                        </div>
                     )}
                   </div>
<button onClick={handleDeleteGroup} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }} title="Delete Group">
                     <Trash2 size={18} />
                   </button>
                 </div>

                  <div style={{ paddingBottom: '1.5rem', borderBottom: '1px solid var(--border)', marginBottom: '2rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <label style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>Assigned Survey</label>
                      <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                         {selectedGroup.surveys && selectedGroup.surveys.length > 0 && (
                           <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'var(--bg-main)', padding: '6px 14px', borderRadius: '10px', border: '1px solid var(--border)' }}>
                              <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)' }}>{selectedGroup.surveys[0].title}</span>
                              <button 
                                onClick={() => handleUnassignFromGroup(selectedGroup.surveys[0].id)} 
                                style={{ color: '#ef4444', background: 'rgba(239, 68, 68, 0.08)', border: 'none', borderRadius: '6px', padding: '5px', cursor: 'pointer', display: 'flex' }} 
                                title="Remove Assignment"
                              >
                                <Trash2 size={14} />
                              </button>
                           </div>
                         )}
                         <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                           <select 
                             value={selectedGroupSurveyId} 
                             onChange={e => setSelectedGroupSurveyId(e.target.value)} 
                             style={{ padding: '8px 12px', borderRadius: '10px', background: 'var(--bg-main)', border: '1px solid var(--border)', fontSize: '0.85rem', color: 'var(--text-main)', minWidth: '200px' }}
                           >
                              <option value="">{selectedGroup.surveys?.[0] ? "Change Survey..." : "Select Survey..."}</option>
                              {surveys.filter(s => !selectedGroup.surveys?.some(assigned => assigned.id === s.id)).map(s => (
                                  <option key={s.id} value={s.id}>{s.title}</option>
                              ))}
                           </select>
                           <button 
                             className="primary" 
                             disabled={!selectedGroupSurveyId} 
                             onClick={handleAssignToGroup} 
                             style={{ padding: '8px 18px', borderRadius: '10px', fontSize: '0.85rem', fontWeight: 700, opacity: selectedGroupSurveyId ? 1 : 0.5, transition: 'all 0.2s' }}
                           >
                              Assign
                           </button>
                         </div>
                      </div>
                    </div>
                  </div>

                  <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                      <label style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Group Members</label>
                      <div style={{ display: 'flex', background: 'var(--bg-main)', padding: '4px', borderRadius: '10px', border: '1px solid var(--border)' }}>
                        <button 
                          onClick={() => { setMemberSubTab('assigned'); setMemberSearchTerm(''); }}
                          style={{ 
                            padding: '6px 14px', fontSize: '0.75rem', fontWeight: 700, borderRadius: '7px', border: 'none', cursor: 'pointer',
                            background: memberSubTab === 'assigned' ? 'var(--accent-primary)' : 'transparent',
                            color: memberSubTab === 'assigned' ? 'white' : 'var(--text-muted)',
                            transition: 'all 0.2s'
                          }}
                        >Members</button>
                        <button 
                          onClick={() => { setMemberSubTab('unassigned'); setMemberSearchTerm(''); }}
                          style={{ 
                            padding: '6px 14px', fontSize: '0.75rem', fontWeight: 700, borderRadius: '7px', border: 'none', cursor: 'pointer',
                            background: memberSubTab === 'unassigned' ? 'var(--accent-primary)' : 'transparent',
                            color: memberSubTab === 'unassigned' ? 'white' : 'var(--text-muted)',
                            transition: 'all 0.2s'
                          }}
                        >Add Users</button>
                      </div>
                    </div>

                    <div style={{ position: 'relative', marginBottom: '1.5rem' }}>
                      <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', opacity: 0.6 }} />
                      <input 
                        value={memberSearchTerm}
                        onChange={e => setMemberSearchTerm(e.target.value)}
                        placeholder={memberSubTab === 'assigned' ? "Search group members..." : "Find users to add..."}
                        style={{ paddingLeft: '42px', fontSize: '0.9rem', height: '44px', background: 'var(--bg-main)', borderRadius: '12px', border: '1px solid var(--border)' }}
                      />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: 1, overflowY: 'auto', paddingRight: '8px' }}>
                      {(() => {
                        const members = selectedGroup.users || [];
                        const displayUsers = memberSubTab === 'assigned' 
                          ? members 
                          : users.filter(u => !members.some(m => m.id === u.id) && u.role !== 'Admin' && u.role !== 'Manager');
                        
                        const filtered = displayUsers.filter(u => 
                          u.username.toLowerCase().includes(memberSearchTerm.toLowerCase())
                        );

                        if (filtered.length === 0) {
                          return (
                            <div style={{ textAlign: 'center', padding: '3rem 1rem', border: '1px dashed var(--border)', borderRadius: '16px', color: 'var(--text-muted)', fontSize: '0.85rem', background: 'rgba(var(--bg-sidebar-rgb), 0.3)' }}>
                              {memberSearchTerm ? "No matching users found." : (memberSubTab === 'assigned' ? "This group has no members yet." : "No more users to add.")}
                            </div>
                          );
                        }

                        return filtered.map(u => (
                          <div key={u.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 18px', background: 'var(--bg-sidebar)', borderRadius: '16px', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                              <div style={{ 
                                width: '38px', height: '38px', borderRadius: '10px', 
                                background: memberSubTab === 'assigned' ? 'var(--accent-primary)' : 'var(--bg-main)', 
                                color: memberSubTab === 'assigned' ? 'white' : 'var(--text-muted)', 
                                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.9rem', fontWeight: 800,
                                border: memberSubTab === 'assigned' ? 'none' : '1px solid var(--border)'
                              }}>
                                {u.username[0].toUpperCase()}
                              </div>
                              <div>
                                <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-main)' }}>{u.username}</div>
                                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{u.role}</div>
                              </div>
                            </div>
                            <button 
                              onClick={() => handleToggleGroupUser(u, memberSubTab === 'unassigned')}
                              style={{ 
                                padding: '8px 16px', borderRadius: '10px', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer',
                                background: memberSubTab === 'assigned' ? 'rgba(239, 68, 68, 0.08)' : 'var(--accent-primary)',
                                color: memberSubTab === 'assigned' ? '#ef4444' : 'white',
                                border: memberSubTab === 'assigned' ? '1px solid rgba(239, 68, 68, 0.15)' : 'none',
                                transition: 'all 0.2s'
                              }}
                              onMouseEnter={(e) => {
                                if (memberSubTab === 'assigned') {
                                  e.currentTarget.style.background = '#ef4444';
                                  e.currentTarget.style.color = 'white';
                                } else {
                                  e.currentTarget.style.filter = 'brightness(1.1)';
                                }
                              }}
                              onMouseLeave={(e) => {
                                if (memberSubTab === 'assigned') {
                                  e.currentTarget.style.background = 'rgba(239, 68, 68, 0.08)';
                                  e.currentTarget.style.color = '#ef4444';
                                } else {
                                  e.currentTarget.style.filter = 'none';
                                }
                              }}
                            >
                              {memberSubTab === 'assigned' ? 'Unassign' : 'Assign User'}
                            </button>
                          </div>
                        ));
                      })()}
                    </div>
                  </div>
               </>
            )}
          </div>
        </div>
      )}

      {activeTab === 'users' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', flex: 1, overflow: 'hidden' }}>
          {/* Create User Section - Top Bar */}
          <div className="panel" style={{ padding: '1.5rem' }}>
            <h3 style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: '1.5rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <UserPlus size={18} /> ADD USER
            </h3>
            <form onSubmit={handleCreateUser} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '15px', alignItems: 'flex-end' }}>
              <div>
                <label style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-muted)', marginBottom: '5px', display: 'block' }}>USERNAME</label>
                <input value={newUsername} onChange={e => setNewUsername(e.target.value)} placeholder="Username" required />
              </div>
              <div>
                <label style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-muted)', marginBottom: '5px', display: 'block' }}>INITIAL PASSWORD</label>
                <input value={newUserPassword} onChange={e => setNewUserPassword(e.target.value)} required />
              </div>
              <div>
                <label style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-muted)', marginBottom: '5px', display: 'block' }}>ROLE</label>
                <select value={newUserRole} onChange={e => setNewUserRole(e.target.value)} style={{ padding: '0.7rem' }}>
                  <option value="User">User</option>
                  <option value="Manager">Manager</option>
                  <option value="Admin">Admin</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-muted)', marginBottom: '5px', display: 'block' }}>ASSIGN SURVEY</label>
                <select value={selectedUserSurveyId} onChange={e => setSelectedUserSurveyId(e.target.value)} style={{ padding: '0.7rem' }}>
                  <option value="">None</option>
                  {surveys.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
                </select>
              </div>
              <button className="primary" type="submit" style={{ height: '42px' }}>Add</button>
            </form>
          </div>

          {/* Search & Filter Bar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <div style={{ flexGrow: 1, display: 'flex', alignItems: 'center', gap: '15px', background: 'var(--bg-sidebar)', padding: '0.5rem 1.25rem', borderRadius: '12px', border: '1px solid var(--border)' }}>
              <Search size={20} color="var(--text-muted)" />
              <input 
                value={userSearchTerm}
                onChange={e => setUserSearchTerm(e.target.value)}
                placeholder="Search users by name..." 
                style={{ border: 'none', background: 'transparent', padding: '6px 0', fontSize: '1rem', flexGrow: 1, outline: 'none' }}
              />
              {userSearchTerm && (
                <button onClick={() => setUserSearchTerm('')} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                  <X size={18} />
                </button>
              )}
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'var(--bg-sidebar)', padding: '0.5rem 1.25rem', borderRadius: '12px', border: '1px solid var(--border)', minWidth: '200px' }}>
              <Shield size={18} color="var(--text-muted)" />
              <select 
                value={roleFilter} 
                onChange={e => setRoleFilter(e.target.value)}
                style={{ background: 'none', border: 'none', fontSize: '0.9rem', color: 'var(--text-main)', cursor: 'pointer', outline: 'none', width: '100%', padding: '6px 0' }}
              >
                <option value="All">All Roles</option>
                <option value="Admin">Admin</option>
                <option value="Manager">Manager</option>
                <option value="User">User</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', flex: 1, overflow: 'hidden' }}>
            {/* User Grid Section */}
            <div style={{ flex: 1, overflowY: 'auto', paddingRight: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                  <h3 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-muted)', margin: 0 }}>EXISTING USERS ({filteredUsers.length})</h3>
                  {totalPages > 1 && (
                    <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                      Page {currentPage} of {totalPages}
                    </div>
                  )}
                </div>

                {/* Top Pagination Controls */}
                {totalPages > 1 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button 
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                      style={{ 
                        width: '32px', 
                        height: '32px', 
                        borderRadius: '50%', 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center',
                        opacity: currentPage === 1 ? 0.4 : 1, 
                        cursor: currentPage === 1 ? 'not-allowed' : 'pointer', 
                        background: 'var(--bg-sidebar)', 
                        border: '1px solid var(--border)', 
                        color: 'var(--text-main)', 
                        transition: 'all 0.2s',
                        padding: 0
                      }}
                      title="Previous Page"
                    >
                      <ChevronLeft size={16} />
                    </button>
                    
                    <div style={{ display: 'flex', gap: '6px' }}>
                      {[...Array(totalPages)].map((_, i) => {
                        const pageNum = i + 1;
                        if (totalPages > 5) {
                          if (pageNum !== 1 && pageNum !== totalPages && Math.abs(pageNum - currentPage) > 1) {
                            if (pageNum === 2 || pageNum === totalPages - 1) return <span key={pageNum} style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>..</span>;
                            return null;
                          }
                        }
                        
                        return (
                          <button
                            key={pageNum}
                            onClick={() => setCurrentPage(pageNum)}
                            style={{
                              width: '32px',
                              height: '32px',
                              borderRadius: '8px',
                              border: '1px solid var(--border)',
                              background: currentPage === pageNum ? 'var(--accent-primary)' : 'var(--bg-sidebar)',
                              color: currentPage === pageNum ? 'white' : 'var(--text-main)',
                              cursor: 'pointer',
                              fontWeight: 700,
                              fontSize: '0.75rem',
                              transition: 'all 0.2s'
                            }}
                          >
                            {pageNum}
                          </button>
                        );
                      })}
                    </div>

                    <button 
                      onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                      disabled={currentPage === totalPages}
                      style={{ 
                        width: '32px', 
                        height: '32px', 
                        borderRadius: '50%', 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center',
                        opacity: currentPage === totalPages ? 0.4 : 1, 
                        cursor: currentPage === totalPages ? 'not-allowed' : 'pointer', 
                        background: 'var(--bg-sidebar)', 
                        border: '1px solid var(--border)', 
                        color: 'var(--text-main)', 
                        transition: 'all 0.2s',
                        padding: 0
                      }}
                      title="Next Page"
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                )}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '1.25rem' }}>
                {paginatedUsers.map(u => (
                  <div 
                    key={u.id} 
                    onClick={() => {
                      setSelectedUser(u);
                    }}
                    className="panel"
                    style={{ 
                      cursor: 'pointer', 
                      transition: 'all 0.2s',
                      borderColor: selectedUser?.id === u.id ? 'var(--accent-primary)' : 'var(--border)',
                      background: selectedUser?.id === u.id ? 'rgba(59, 130, 246, 0.02)' : 'var(--bg-sidebar)',
                      position: 'relative',
                      overflow: 'hidden',
                      padding: '1.25rem'
                    }}
                  >
                    {selectedUser?.id === u.id && (
                      <div style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', background: 'var(--accent-primary)' }} />
                    )}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '1.25rem' }}>
                      <div style={{ 
                        width: '42px', height: '42px', borderRadius: '50%', background: 'var(--accent-primary)', 
                        color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '1rem'
                      }}>
                        {u.username[0].toUpperCase()}
                      </div>
                      <div style={{ overflow: 'hidden' }}>
                        <div style={{ fontWeight: 700, fontSize: '1.1rem', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>{u.username}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{u.role}</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <ClipboardList size={14} /> {u.assigned_surveys?.length || 0} Surveys
                      </div>
                      <ChevronRight size={16} color="var(--text-muted)" />
                    </div>
                  </div>
                ))}
                
                {filteredUsers.length === 0 && (
                  <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '4rem', background: 'var(--bg-sidebar)', borderRadius: '12px', border: '1px dashed var(--border)', color: 'var(--text-muted)' }}>
                    No users found matching "{userSearchTerm}" {roleFilter !== 'All' ? `with role ${roleFilter}` : ''}
                  </div>
                )}
              </div>

            </div>
          </div>
        </div>
      )}

      {/* Global CSS for animations */}
      <style>{`
        @keyframes pop-in {
          0% { transform: translate(-50%, -40%) scale(0.9); opacity: 0; }
          100% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
        }
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </div>
  );
};

export default Assigner;
