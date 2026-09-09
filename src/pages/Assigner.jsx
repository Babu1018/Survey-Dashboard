import { useEffect, useMemo, useState } from 'react';
import useSurveyStore from '../store/useSurveyStore';
import useMonitorStore from '../store/useMonitorStore';
import {
  Users,
  ChevronRight,
  ChevronLeft,
  Link as LinkIcon,
  Lock,
  Shield,
  Trash2,
  Edit3,
  FileEdit,
  Check,
  X,
  Plus,
  Search,
  Activity,
  Eye,
  EyeOff
} from 'lucide-react';
import useNotificationStore from '../store/useNotificationStore';

const roleBadgeColors = (role) => {
  if (role === 'Admin') return { fg: '#4f46e5', bg: '#e0e7ff' };
  if (role === 'Manager') return { fg: '#2563eb', bg: '#eff6ff' };
  return { fg: '#d97706', bg: '#fef3c7' };
};

const statusBadgeColors = (isActive) => isActive
  ? { fg: '#10b981', bg: '#ecfdf5' }
  : { fg: '#f59e0b', bg: '#fffbeb' };

const formatDate = (value) => {
  if (!value) return '—';
  return new Date(value).toISOString().slice(0, 10);
};

const Assigner = () => {
  const { showSuccess, showError } = useNotificationStore();
  const {
    groups,
    surveys,
    users,
    loginLogs,
    fetchGroups,
    fetchSurveys,
    fetchUsers,
    fetchLoginLogs,
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
    updateGroup,
    setGroupManager
  } = useSurveyStore();
  const { recentResponses, fetchRecent } = useMonitorStore();

  const [activeTab, setActiveTab] = useState('users'); 

  // Group State
  const [newGroupName, setNewGroupName] = useState('');
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [selectedGroupSurveyId, setSelectedGroupSurveyId] = useState('');

  // User State
  const [newUsername, setNewUsername] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [showCreatePassword, setShowCreatePassword] = useState(false);
  const [newUserRole, setNewUserRole] = useState('User');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPhone, setNewUserPhone] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedUserSurveyId, setSelectedUserSurveyId] = useState('');
  const [userSearchTerm, setUserSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [currentPage, setCurrentPage] = useState(1);
  const [showCreateUserModal, setShowCreateUserModal] = useState(false);
  const [assignPopupUser, setAssignPopupUser] = useState(null);
  const [assignPopupSurveyId, setAssignPopupSurveyId] = useState('');
  const [assignPopupManagerId, setAssignPopupManagerId] = useState('');
  const [assignPopupSaving, setAssignPopupSaving] = useState(false);
  const [deleteUserChecked, setDeleteUserChecked] = useState(false);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [checkedUserIds, setCheckedUserIds] = useState([]);
  const [isSurveyDropdownOpen, setIsSurveyDropdownOpen] = useState(false);
  const [deleteConfirmUser, setDeleteConfirmUser] = useState(null);
  const [deleteConfirmBulk, setDeleteConfirmBulk] = useState(false);
  const [deleteConfirmHistoryChecked, setDeleteConfirmHistoryChecked] = useState(false);
  const [deleteConfirmGroup, setDeleteConfirmGroup] = useState(null);
  const [editPassword, setEditPassword] = useState('');
  const itemsPerPage = 10;
  
  // Edit State
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editRole, setEditRole] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPhone, setEditPhone] = useState('');
  
  const [isEditingGroup, setIsEditingGroup] = useState(false);
  const [editGroupName, setEditGroupName] = useState('');

  // Group Member Management State
  const [memberSubTab, setMemberSubTab] = useState('assigned'); // 'assigned' or 'unassigned'
  const [memberSearchTerm, setMemberSearchTerm] = useState('');

  useEffect(() => {
    fetchGroups();
    fetchSurveys();
    fetchUsers();
    fetchLoginLogs();
    fetchRecent(1000);
  }, []);

  useEffect(() => {
    setDeleteUserChecked(false);
    setIsSurveyDropdownOpen(false);
    setDeleteConfirmUser(null);
    setDeleteConfirmBulk(false);
    setDeleteConfirmHistoryChecked(false);
    if (selectedUser) {
      const updated = users.find(u => u.id === selectedUser.id);
      if (updated) {
        setSelectedUser(updated);
        setEditName(updated.username);
        setEditRole(updated.role);
        setEditEmail(updated.email || '');
        setEditPhone(updated.phone_number || '');
        setEditPassword(updated.password_plain || '');
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
          email: newUserEmail || null,
          phone_number: newUserPhone || null,
          assigned_survey_id: selectedUserSurveyId ? parseInt(selectedUserSurveyId) : null
        });
        setNewUsername('');
        setNewUserPassword('');
        setNewUserEmail('');
        setNewUserPhone('');
        setSelectedUserSurveyId('');
        showSuccess('User Added.');
        setShowCreateUserModal(false);
      } catch (err) {
        showError(err.message || 'Failed to create user');
      }
    }
  };

  const handleUpdateUser = async () => {
    if (!selectedUser) return;
    try {
      const updateData = {
        username: editName,
        role: editRole,
        email: editEmail || null,
        phone_number: editPhone || null
      };
      if (editPassword) {
        updateData.password = editPassword;
      }
      await updateUser(selectedUser.id, updateData);
      showSuccess('User details updated successfully.');
      setSelectedUser(null);
    } catch (err) {
      showError(err.message || 'Update failed');
    }
  };

  const handleToggleSuspend = async () => {
    if (!selectedUser) return;
    try {
      await updateUser(selectedUser.id, { is_active: !selectedUser.is_active });
      showSuccess(selectedUser.is_active ? 'Account Suspended.' : 'Account Reactivated.');
    } catch (err) {
      showError(err.message || 'Failed to update status');
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

  const handleSetGroupManager = async (managerId) => {
    if (!selectedGroup) return;
    try {
      await setGroupManager(selectedGroup.id, managerId ? parseInt(managerId) : null);
      showSuccess(managerId ? 'Manager assigned to group.' : 'Manager removed from group.');
    } catch (err) {
      showError(err.message || 'Failed to update group manager');
    }
  };

  const handleDeleteGroup = () => {
    if (selectedGroup) {
      setDeleteConfirmGroup(selectedGroup);
    }
  };

  const handleDeleteGroupConfirmed = async () => {
    if (!deleteConfirmGroup) return;
    const g = deleteConfirmGroup;
    try {
      await deleteGroup(g.id);
      showSuccess(`Group ${g.name} removed.`);
      setSelectedGroup(null);
      setDeleteConfirmGroup(null);
    } catch (err) {
      showError(err.message || 'Error deleting group');
    }
  };

  // Which group (if any) has this user as a member — a user reports to that
  // group's manager, since managers are attached to groups rather than users.
  const groupForUser = (userId) => groups.find(g => (g.users || []).some(m => m.id === userId));

  const openAssignPopup = (u) => {
    setAssignPopupUser(u);
    setAssignPopupSurveyId('');
    setAssignPopupManagerId(String(groupForUser(u.id)?.manager?.id || ''));
  };

  const handleAssignPopupSurvey = async () => {
    if (!assignPopupUser || !assignPopupSurveyId) return;
    setAssignPopupSaving(true);
    try {
      const updated = await assignSurveyToUser(assignPopupUser.id, Number(assignPopupSurveyId));
      if (updated) setAssignPopupUser(updated);
      setAssignPopupSurveyId('');
      await fetchUsers();
      showSuccess('Survey assigned.');
    } catch (err) {
      showError(err.message || 'Failed to assign survey');
    } finally {
      setAssignPopupSaving(false);
    }
  };

  const handleUnassignPopupSurvey = async (surveyId) => {
    if (!assignPopupUser) return;
    try {
      const updated = await unassignSurveyFromUser(assignPopupUser.id, surveyId);
      if (updated) setAssignPopupUser(updated);
      await fetchUsers();
      showSuccess('Survey unassigned.');
    } catch (err) {
      showError(err.message || 'Failed to unassign survey');
    }
  };

  const handleAssignPopupManager = async (managerIdStr) => {
    if (!assignPopupUser) return;
    setAssignPopupSaving(true);
    try {
      const existingGroup = groupForUser(assignPopupUser.id);
      if (existingGroup) await unassignUserFromGroup(existingGroup.id, assignPopupUser.id);

      if (managerIdStr) {
        const managerId = Number(managerIdStr);
        let group = groups.find(g => g.manager_id === managerId || g.manager?.id === managerId);
        if (!group) {
          const manager = users.find(u => u.id === managerId);
          group = await createGroup(`${manager?.username || 'Manager'}'s Team`);
          if (!group) throw new Error('Failed to create a group for this manager.');
          await setGroupManager(group.id, managerId);
        }
        await assignUserToGroup(group.id, assignPopupUser.id);
      }
      setAssignPopupManagerId(managerIdStr || '');
      await fetchGroups();
      await fetchUsers();
      showSuccess(managerIdStr ? 'Manager assigned.' : 'Manager removed.');
    } catch (err) {
      showError(err.message || 'Failed to update manager');
    } finally {
      setAssignPopupSaving(false);
    }
  };

  const handleAssignToUser = async () => {
    if (selectedUser && selectedUserSurveyId) {
      try {
        const updatedUser = await assignSurveyToUser(selectedUser.id, Number(selectedUserSurveyId));
        if (updatedUser) {
          setSelectedUser(updatedUser);
        }
        showSuccess(`Assignment Saved.`);
        setSelectedUserSurveyId('');
        // Re-fetch users so the table also updates
        await fetchUsers();
      } catch (err) {
         showError(err.message || 'Failed to assign');
      }
    }
  };

  const handleUnassignFromUser = async (surveyId) => {
    if (selectedUser) {
        try {
            const updatedUser = await unassignSurveyFromUser(selectedUser.id, surveyId);
            if (updatedUser) {
              setSelectedUser(updatedUser);
            }
            showSuccess(`Unassigned from user: ${selectedUser.username}`);
            await fetchUsers();
        } catch (err) {
            showError(err.message || 'Failed to unassign');
        }
    }
  };

  const handleDeleteUserDirect = (u) => {
    if (u.username === 'admin') {
      showError('Cannot delete the main admin account');
      return;
    }
    setDeleteConfirmUser(u);
    setDeleteConfirmHistoryChecked(false);
  };

  const handleDeleteUserConfirmed = async () => {
    if (!deleteConfirmUser) return;
    const u = deleteConfirmUser;
    try {
      const success = await deleteUser(u.id, deleteConfirmHistoryChecked);
      if (success) {
        showSuccess(`User ${u.username} removed from database.`);
        if (selectedUser?.id === u.id) {
          setSelectedUser(null);
        }
        setDeleteConfirmUser(null);
      } else {
        showError('Failed to delete user.');
      }
    } catch (err) {
      showError(err.message || 'Error deleting user');
    }
  };

  const handleToggleUserChecked = (userId) => {
    setCheckedUserIds(prev => 
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  const handleToggleSelectAll = () => {
    const paginatedIds = paginatedUsers.map(u => u.id).filter(id => {
      const uObj = users.find(usr => usr.id === id);
      return uObj?.username !== 'admin';
    });
    const allChecked = paginatedIds.every(id => checkedUserIds.includes(id));
    if (allChecked) {
      setCheckedUserIds(prev => prev.filter(id => !paginatedIds.includes(id)));
    } else {
      setCheckedUserIds(prev => [...new Set([...prev, ...paginatedIds])]);
    }
  };

  const handleBulkDelete = () => {
    if (checkedUserIds.length === 0) return;
    setDeleteConfirmBulk(true);
    setDeleteConfirmHistoryChecked(false);
  };

  const handleBulkDeleteConfirmed = async () => {
    if (checkedUserIds.length === 0) return;
    try {
      let successCount = 0;
      for (const userId of checkedUserIds) {
        const uObj = users.find(usr => usr.id === userId);
        if (uObj && uObj.username !== 'admin') {
          const success = await deleteUser(userId, deleteConfirmHistoryChecked);
          if (success) successCount++;
        }
      }
      showSuccess(`Successfully deleted ${successCount} users.`);
      setCheckedUserIds([]);
      setIsSelectionMode(false);
      setDeleteConfirmBulk(false);
    } catch (err) {
      showError(err.message || 'Error performing bulk deletion');
    }
  };

  const filteredUsers = users.filter(u => {
    const matchesSearch = u.username.toLowerCase().includes(userSearchTerm.toLowerCase());
    const matchesRole = roleFilter === 'All' || u.role === roleFilter;
    const matchesStatus = statusFilter === 'All' || (statusFilter === 'Active' ? u.is_active : !u.is_active);
    return matchesSearch && matchesRole && matchesStatus;
  });

  // Each user's "field" is the category of their first assigned survey; the
  // headcount next to it is how many users across the platform share that
  // field, mirroring the branch population shown on the Survey Fields page.
  const fieldCounts = useMemo(() => {
    const counts = {};
    users.forEach(u => {
      const field = u.assigned_surveys?.[0]?.category;
      if (field) counts[field] = (counts[field] || 0) + 1;
    });
    return counts;
  }, [users]);

  // How many times each username shows up in the login audit trail.
  const loginCounts = useMemo(() => {
    const counts = {};
    loginLogs.forEach(log => { counts[log.username] = (counts[log.username] || 0) + 1; });
    return counts;
  }, [loginLogs]);

  // Submission counts keyed by survey title, since /api/monitor/recent only reports the title.
  const submissionCounts = useMemo(() => {
    const counts = {};
    recentResponses.forEach(r => { counts[r.survey_title] = (counts[r.survey_title] || 0) + 1; });
    return counts;
  }, [recentResponses]);

  // Full survey records (with nested questions + is_active) keyed by id, so a
  // user's minimal assigned-survey entries can be enriched for display.
  const surveysById = useMemo(() => {
    const map = {};
    surveys.forEach(s => { map[s.id] = s; });
    return map;
  }, [surveys]);

  const totalPages = Math.ceil(filteredUsers.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedUsers = filteredUsers.slice(startIndex, startIndex + itemsPerPage);

  // Reset to first page when search or filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [userSearchTerm, roleFilter, statusFilter]);

  return (
    <div style={{ animation: 'fade-in 0.4s ease-out', maxWidth: '1400px', margin: '0 auto', height: 'calc(100vh - 160px)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* User Activity Modal */}
      {selectedUser && (
        <div
          onClick={() => { setSelectedUser(null); setIsEditing(false); }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.4)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem', animation: 'fade-in 0.3s ease-out' }}
        >
          <div
            className="panel"
            onClick={e => e.stopPropagation()}
            style={{ width: '100%', maxWidth: '640px', borderRadius: '24px', padding: '1.75rem', background: '#ffffff', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', border: '1px solid var(--border)', animation: 'pop-in 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)' }}
          >
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-main)' }}>
                {selectedUser.username} - Activity
              </h3>
              <button onClick={() => { setSelectedUser(null); setIsEditing(false); }} style={{ background: 'none', border: 'none', padding: '4px', color: 'var(--text-muted)', display: 'flex', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', rowGap: '0.85rem', columnGap: '1.5rem', marginBottom: '1.25rem', paddingBottom: '1.25rem', borderBottom: '1px solid var(--border)' }}>
              <div>
                <label style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px', letterSpacing: '0.05em', display: 'block' }}>Email</label>
                <input
                  value={editEmail}
                  onChange={e => setEditEmail(e.target.value)}
                  placeholder="Email"
                  style={{ width: '100%', fontSize: '0.9rem', padding: '6px 10px', borderRadius: '8px', border: '1px solid var(--border)', background: '#ffffff', boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px', letterSpacing: '0.05em', display: 'block' }}>Password</label>
                <input
                  value={editPassword}
                  onChange={e => setEditPassword(e.target.value)}
                  placeholder="Password"
                  style={{ width: '100%', fontSize: '0.9rem', padding: '6px 10px', borderRadius: '8px', border: '1px solid var(--border)', background: '#ffffff', boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px', letterSpacing: '0.05em', display: 'block' }}>Status</label>
                <span style={{ display: 'inline-block', marginTop: '6px', background: statusBadgeColors(selectedUser.is_active).bg, color: statusBadgeColors(selectedUser.is_active).fg, padding: '4px 12px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 700 }}>
                  {selectedUser.is_active ? 'Active' : 'Suspended'}
                </span>
              </div>
              <div>
                <label style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px', letterSpacing: '0.05em', display: 'block' }}>Created on</label>
                <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-main)', marginTop: '6px' }}>{formatDate(selectedUser.created_at)}</div>
              </div>
            </div>

            {/* Stat tiles */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginBottom: '1.25rem' }}>
              {[
                { label: 'Surveys', value: selectedUser.assigned_surveys?.length || 0, color: '#f59e0b', bg: '#fff7ed' },
                { label: 'Direct', value: selectedUser.direct_surveys?.length || 0, color: '#2563eb', bg: '#eff6ff' },
                { label: 'Groups', value: selectedUser.groups?.length || 0, color: '#8b5cf6', bg: '#f5f3ff' },
                { label: 'Logins', value: loginCounts[selectedUser.username] || 0, color: '#10b981', bg: '#ecfdf5' },
              ].map(tile => (
                <div key={tile.label} style={{ background: tile.bg, borderRadius: '10px', padding: '0.75rem' }}>
                  <div style={{ fontSize: '0.62rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{tile.label}</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: tile.color, marginTop: '2px' }}>{tile.value}</div>
                </div>
              ))}
            </div>

            {/* Surveys */}
            <div style={{ marginBottom: '1.25rem' }}>
              <h4 style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.6rem' }}>Surveys</h4>
              {selectedUser.assigned_surveys?.length > 0 ? (
                <div style={{ border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden', maxHeight: '110px', overflowY: 'auto' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '2.5fr 1fr 1fr 1fr 0.4fr', padding: '0.5rem 0.85rem', background: '#f8fafc', fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', position: 'sticky', top: 0, zIndex: 1, borderBottom: '1px solid var(--border)' }}>
                    <span>Title</span><span>Questions</span><span>Status</span><span>Submissions</span><span></span>
                  </div>
                  {selectedUser.assigned_surveys.map(s => {
                    const full = surveysById[s.id];
                    const isDirect = selectedUser.direct_surveys?.some(ds => ds.id === s.id);
                    return (
                      <div key={s.id} style={{ display: 'grid', gridTemplateColumns: '2.5fr 1fr 1fr 1fr 0.4fr', padding: '0.5rem 0.85rem', borderTop: '1px solid var(--border)', fontSize: '0.8rem', alignItems: 'center', background: '#ffffff' }}>
                        <span className="truncate" title={s.title} style={{ fontWeight: 600 }}>{s.title}</span>
                        <span>{full?.questions?.length ?? '—'}</span>
                        <span>
                          <span style={{
                            background: full?.is_active === false ? 'rgba(100,116,139,0.1)' : 'rgba(16,185,129,0.1)',
                            color: full?.is_active === false ? '#64748b' : '#10b981',
                            padding: '2px 8px', borderRadius: '20px', fontSize: '0.7rem', fontWeight: 700
                          }}>
                            {full?.is_active === false ? 'Closed' : 'Active'}
                          </span>
                        </span>
                        <span>{submissionCounts[s.title] || 0}</span>
                        <span>
                          {isDirect && (
                            <button onClick={() => handleUnassignFromUser(s.id)} title="Unassign" style={{ background: 'none', border: 'none', color: '#ef4444', padding: 0, display: 'flex', cursor: 'pointer' }}>
                              <X size={14} />
                            </button>
                          )}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem', border: '1px dashed var(--border)', borderRadius: '12px' }}>
                  No surveys assigned.
                </div>
              )}
              <div style={{ display: 'flex', gap: '8px', marginTop: '8px', alignItems: 'stretch' }}>
                <div style={{ position: 'relative', flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
                  <div
                    onClick={() => setIsSurveyDropdownOpen(!isSurveyDropdownOpen)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontSize: '0.8rem',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: '1px solid var(--border)',
                      background: '#ffffff',
                      cursor: 'pointer',
                      userSelect: 'none',
                      height: '100%',
                      minHeight: '34px',
                      boxSizing: 'border-box'
                    }}
                  >
                    <span>
                      {selectedUserSurveyId
                        ? surveys.find(s => s.id === parseInt(selectedUserSurveyId))?.title
                        : "Assign another survey..."}
                    </span>
                    <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>▼</span>
                  </div>

                  {isSurveyDropdownOpen && (
                    <div
                      style={{
                        position: 'absolute',
                        bottom: '100%',
                        left: 0,
                        right: 0,
                        background: '#ffffff',
                        border: '1px solid var(--border)',
                        borderRadius: '8px',
                        boxShadow: '0 -4px 12px rgba(0,0,0,0.1)',
                        zIndex: 100,
                        maxHeight: '220px',
                        overflowY: 'auto',
                        marginBottom: '4px'
                      }}
                    >
                      <div
                        onClick={() => {
                          setSelectedUserSurveyId('');
                          setIsSurveyDropdownOpen(false);
                        }}
                        style={{
                          padding: '8px 12px',
                          fontSize: '0.8rem',
                          cursor: 'pointer',
                          borderBottom: '1px solid var(--border)',
                          color: 'var(--text-muted)'
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      >
                        Assign another survey...
                      </div>
                      {surveys
                        .filter(s => !selectedUser.assigned_surveys?.some(a => a.id === s.id))
                        .map(s => (
                          <div
                            key={s.id}
                            onClick={() => {
                              setSelectedUserSurveyId(String(s.id));
                              setIsSurveyDropdownOpen(false);
                            }}
                            style={{
                              padding: '8px 12px',
                              fontSize: '0.8rem',
                              cursor: 'pointer',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              borderBottom: '1px solid #f1f5f9'
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = '#f1f5f9'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                          >
                            <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{s.title}</span>
                            <span style={{ fontSize: '0.7rem', color: '#2563eb', background: '#eff6ff', padding: '2px 8px', borderRadius: '12px', fontWeight: 700, marginLeft: '8px', whiteSpace: 'nowrap' }}>
                              from {s.category || 'General'}
                            </span>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
                <button className="primary" onClick={handleAssignToUser} disabled={!selectedUserSurveyId} style={{ padding: '6px 12px', borderRadius: '8px', height: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <LinkIcon size={14} />
                </button>
              </div>
            </div>

            {/* Colleagues sharing this user's field */}
            <div style={{ marginBottom: '1.25rem' }}>
              <h4 style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>Users in This Field</h4>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', maxHeight: '75px', overflowY: 'auto' }}>
                {(() => {
                  const field = selectedUser.assigned_surveys?.[0]?.category;
                  if (!field) return <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>This user isn't assigned to a field yet.</span>;
                  const colleagues = users.filter(u => u.id !== selectedUser.id && u.assigned_surveys?.[0]?.category === field);
                  if (colleagues.length === 0) return <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>No other users in this field yet.</span>;
                  return colleagues.map(u => (
                    <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#f8fafc', border: '1px solid var(--border)', borderRadius: '20px', padding: '3px 10px 3px 6px', fontSize: '0.75rem' }}>
                      <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--accent-primary)', flexShrink: 0 }} />
                      <strong style={{ color: 'var(--text-main)' }}>{u.username}</strong>
                      {u.email && <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>{u.email}</span>}
                    </div>
                  ));
                })()}
              </div>
            </div>

            {/* Footer actions */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
              <button
                onClick={handleToggleSuspend}
                style={{
                  background: selectedUser.is_active ? 'rgba(239, 68, 68, 0.08)' : 'rgba(16, 185, 129, 0.08)',
                  border: 'none', color: selectedUser.is_active ? '#ef4444' : '#10b981', fontWeight: 700, padding: '8px 18px', borderRadius: '8px', cursor: 'pointer', fontSize: '0.85rem'
                }}
              >
                {selectedUser.is_active ? 'Suspend Account' : 'Reactivate Account'}
              </button>
              <button
                onClick={handleUpdateUser}
                style={{ background: 'var(--accent-primary)', border: 'none', color: '#ffffff', fontWeight: 700, padding: '8px 24px', borderRadius: '8px', cursor: 'pointer', fontSize: '0.85rem' }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="page-header-container">
        <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ color: '#0b1560', fontWeight: 800 }}>Manage Users</h1>
            <p style={{ color: 'var(--text-muted)' }}>Manage user profiles, roles, permissions, and access across the platform.</p>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button className="primary" onClick={() => setShowCreateUserModal(true)} style={{ height: '44px', padding: '0 1.25rem', whiteSpace: 'nowrap', borderRadius: '10px' }}>
              <Plus size={18} /> Create User
            </button>
            <button
              onClick={() => setActiveTab('groups')}
              style={{
                height: '44px', padding: '0 1.25rem', whiteSpace: 'nowrap', borderRadius: '10px',
                background: '#eff6ff', border: '1px solid #dbeafe', color: '#2563eb', fontWeight: 700
              }}
            >
              <Plus size={18} /> Add Groups
            </button>
          </div>
        </div>
      </div>

      {activeTab === 'groups' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', flex: 1, overflow: 'hidden' }}>
          <button
            onClick={() => setActiveTab('users')}
            style={{ alignSelf: 'flex-start', background: 'none', border: 'none', color: 'var(--accent-primary)', fontWeight: 700, padding: 0, fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}
          >
            <ChevronLeft size={16} /> Back to Users
          </button>

          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(240px, 300px) 1fr', gap: '1.5rem', flex: 1, overflow: 'hidden' }}>
            {/* Left Sidebar */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', overflow: 'hidden' }}>
              <div className="panel" style={{ padding: '1.25rem' }}>
                <h3 style={{ fontSize: '0.75rem', fontWeight: 800, marginBottom: '1rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Add Group</h3>
                <form onSubmit={handleCreateGroup} style={{ display: 'flex', gap: '8px' }}>
                  <input value={newGroupName} onChange={e => setNewGroupName(e.target.value)} placeholder="Group name..." required style={{ flex: 1, fontSize: '0.85rem' }} />
                  <button className="primary" type="submit" style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}>Add</button>
                </form>
              </div>
              <div className="panel" style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '1.25rem' }}>
                <h3 style={{ fontSize: '0.75rem', fontWeight: 800, marginBottom: '1rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Active Groups</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', overflowY: 'auto', flex: 1 }}>
                  {groups.map(group => (
                    <div key={group.id} onClick={() => setSelectedGroup(group)} className={`nav-item ${selectedGroup?.id === group.id ? 'active' : ''}`} style={{ justifyContent: 'space-between', padding: '0.65rem 0.85rem', margin: 0, borderRadius: '10px', cursor: 'pointer' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <Users size={15} />
                        <span style={{ fontSize: '0.88rem', fontWeight: 600 }}>{group.name}</span>
                      </div>
                      {group.users && (
                      <span style={{ 
                        fontSize: '0.65rem', 
                        fontWeight: 700, 
                        color: selectedGroup?.id === group.id ? 'white' : 'var(--text-muted)', 
                        background: selectedGroup?.id === group.id ? 'rgba(255, 255, 255, 0.2)' : 'var(--bg-hover)', 
                        padding: '2px 8px', 
                        borderRadius: '20px' 
                      }}>
                        {group.users.length}
                      </span>
                    )}
                    </div>
                  ))}
                  {groups.length === 0 && <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>No groups yet.</div>}
                </div>
              </div>
            </div>

            {/* Right Panel */}
            <div className="panel" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '1.5rem' }}>
              {!selectedGroup ? (
                <div style={{ textAlign: 'center', padding: '5rem', opacity: 0.5, color: 'var(--text-muted)' }}>Select a group to manage</div>
              ) : (
                <>
                  {/* Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', paddingBottom: '1rem', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ flexGrow: 1 }}>
                      {isEditingGroup ? (
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <input value={editGroupName} onChange={e => setEditGroupName(e.target.value)} style={{ padding: '6px 12px', fontSize: '1.1rem', fontWeight: 700, borderRadius: '10px' }} />
                          <button className="primary" onClick={handleUpdateGroup} style={{ padding: '6px 12px', borderRadius: '8px' }}><Check size={14} /></button>
                          <button onClick={() => { setIsEditingGroup(false); setEditGroupName(selectedGroup.name); }} style={{ padding: '6px 12px', borderRadius: '8px' }}><X size={14} /></button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <h2 style={{ fontSize: '1.3rem', margin: 0, fontWeight: 800 }}>{selectedGroup.name}</h2>
                          <button onClick={() => { setIsEditingGroup(true); setEditGroupName(selectedGroup.name); }} style={{ background: 'none', border: 'none', color: 'var(--accent-primary)', cursor: 'pointer', padding: 0, display: 'flex' }}><Edit3 size={15} /></button>
                        </div>
                      )}
                    </div>
                    <button onClick={handleDeleteGroup} style={{ background: 'rgba(239, 68, 68, 0.08)', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '8px', borderRadius: '10px', display: 'flex' }} title="Delete Group"><Trash2 size={16} /></button>
                  </div>

                  {/* Manager & Survey */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', marginBottom: '1.5rem', paddingBottom: '1.5rem', borderBottom: '1px solid var(--border)' }}>
                    <div>
                      <label style={{ fontSize: '0.68rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '8px' }}>Group Manager</label>
                      {selectedGroup.manager ? (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-hover)', padding: '10px 14px', borderRadius: '12px', border: '1px solid var(--border)', height: '42px', boxSizing: 'border-box' }}>
                          <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)' }}>{selectedGroup.manager.username}</span>
                          <button onClick={() => handleSetGroupManager(null)} style={{ color: '#ef4444', background: 'none', border: 'none', padding: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Remove Manager"><X size={16} /></button>
                        </div>
                      ) : (
                        <select value="" onChange={e => e.target.value && handleSetGroupManager(e.target.value)} style={{ width: '100%', padding: '10px 12px', borderRadius: '12px', fontSize: '0.85rem', background: 'var(--bg-hover)', border: '1px solid var(--border)', height: '42px' }}>
                          <option value="">Assign Manager...</option>
                          {users.filter(u => u.role === 'Manager').map(m => <option key={m.id} value={m.id}>{m.username}</option>)}
                        </select>
                      )}
                    </div>
                    <div>
                      <label style={{ fontSize: '0.68rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '8px' }}>Assigned Survey</label>
                      {selectedGroup.surveys && selectedGroup.surveys.length > 0 ? (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-hover)', padding: '10px 14px', borderRadius: '12px', border: '1px solid var(--border)', height: '42px', boxSizing: 'border-box' }}>
                          <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selectedGroup.surveys[0].title}</span>
                          <button onClick={() => handleUnassignFromGroup(selectedGroup.surveys[0].id)} style={{ color: '#ef4444', background: 'none', border: 'none', padding: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Remove Survey"><X size={16} /></button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <select value={selectedGroupSurveyId} onChange={e => setSelectedGroupSurveyId(e.target.value)} style={{ flex: 1, padding: '10px 12px', borderRadius: '12px', fontSize: '0.85rem', background: 'var(--bg-hover)', border: '1px solid var(--border)', height: '42px' }}>
                            <option value="">Select Survey...</option>
                            {surveys.filter(s => !selectedGroup.surveys?.some(a => a.id === s.id)).map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
                          </select>
                          <button className="primary" disabled={!selectedGroupSurveyId} onClick={handleAssignToGroup} style={{ padding: '0px 16px', borderRadius: '12px', fontSize: '0.82rem', fontWeight: 700, opacity: selectedGroupSurveyId ? 1 : 0.5, whiteSpace: 'nowrap', height: '42px' }}>Assign</button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Group Members */}
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                      <label style={{ fontSize: '0.68rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Group Members</label>
                      <div style={{ display: 'flex', background: 'var(--bg-hover)', padding: '3px', borderRadius: '10px' }}>
                        <button onClick={() => { setMemberSubTab('assigned'); setMemberSearchTerm(''); }} style={{ padding: '5px 14px', fontSize: '0.72rem', fontWeight: 700, borderRadius: '8px', border: 'none', cursor: 'pointer', background: memberSubTab === 'assigned' ? 'var(--accent-primary)' : 'transparent', color: memberSubTab === 'assigned' ? 'white' : 'var(--text-muted)' }}>Members</button>
                        <button onClick={() => { setMemberSubTab('unassigned'); setMemberSearchTerm(''); }} style={{ padding: '5px 14px', fontSize: '0.72rem', fontWeight: 700, borderRadius: '8px', border: 'none', cursor: 'pointer', background: memberSubTab === 'unassigned' ? 'var(--accent-primary)' : 'transparent', color: memberSubTab === 'unassigned' ? 'white' : 'var(--text-muted)' }}>Add Users</button>
                      </div>
                    </div>
                    <div style={{ position: 'relative', marginBottom: '0.75rem' }}>
                      <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', opacity: 0.6 }} />
                      <input value={memberSearchTerm} onChange={e => setMemberSearchTerm(e.target.value)} placeholder={memberSubTab === 'assigned' ? "Search members..." : "Find users to add..."} style={{ paddingLeft: '38px', fontSize: '0.85rem', height: '38px', background: 'var(--bg-hover)', borderRadius: '10px', border: '1px solid var(--border)', width: '100%', boxSizing: 'border-box' }} />
                    </div>
                    <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px', minHeight: 0 }}>
                      {(() => {
                        const members = selectedGroup.users || [];
                        const displayUsers = memberSubTab === 'assigned' ? members : users.filter(u => !members.some(m => m.id === u.id) && u.role !== 'Admin' && u.role !== 'Manager');
                        const filtered = displayUsers.filter(u => u.username.toLowerCase().includes(memberSearchTerm.toLowerCase()));
                        if (filtered.length === 0) return <div style={{ textAlign: 'center', padding: '2.5rem 1rem', border: '1px dashed var(--border)', borderRadius: '14px', color: 'var(--text-muted)', fontSize: '0.82rem' }}>{memberSearchTerm ? "No matching users." : (memberSubTab === 'assigned' ? "No members yet." : "No more users to add.")}</div>;
                        return filtered.map(u => (
                          <div key={u.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'var(--bg-hover)', borderRadius: '12px', border: '1px solid var(--border)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                              <div style={{ width: '34px', height: '34px', borderRadius: '10px', background: memberSubTab === 'assigned' ? 'var(--accent-primary)' : 'var(--bg-main)', color: memberSubTab === 'assigned' ? 'white' : 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.82rem', fontWeight: 800, border: memberSubTab === 'assigned' ? 'none' : '1px solid var(--border)', flexShrink: 0 }}>{u.username[0].toUpperCase()}</div>
                              <div>
                                <div style={{ fontSize: '0.88rem', fontWeight: 700 }}>{u.username}</div>
                                <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>{u.role}</div>
                              </div>
                            </div>
                            <button onClick={() => handleToggleGroupUser(u, memberSubTab === 'unassigned')} style={{ padding: '6px 14px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', background: memberSubTab === 'assigned' ? 'rgba(239, 68, 68, 0.08)' : 'var(--accent-primary)', color: memberSubTab === 'assigned' ? '#ef4444' : 'white', border: memberSubTab === 'assigned' ? '1px solid rgba(239, 68, 68, 0.15)' : 'none' }}
                              onMouseEnter={e => { if (memberSubTab === 'assigned') { e.currentTarget.style.background = '#ef4444'; e.currentTarget.style.color = 'white'; } else { e.currentTarget.style.filter = 'brightness(1.1)'; } }}
                              onMouseLeave={e => { if (memberSubTab === 'assigned') { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.08)'; e.currentTarget.style.color = '#ef4444'; } else { e.currentTarget.style.filter = 'none'; } }}
                            >{memberSubTab === 'assigned' ? 'Remove' : 'Add to Group'}</button>
                          </div>
                        ));
                      })()}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'users' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', flex: 1, overflow: 'hidden' }}>
          {/* Search & Filter Bar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px', flexWrap: 'wrap' }}>
            <div style={{ flexGrow: 1, minWidth: '240px', display: 'flex', alignItems: 'center', gap: '15px', background: 'var(--bg-sidebar)', padding: '0.4rem 1.25rem', borderRadius: '12px', border: '1px solid var(--border)' }}>
              <Search size={18} color="var(--text-muted)" style={{ opacity: 0.6 }} />
              <input
                value={userSearchTerm}
                onChange={e => setUserSearchTerm(e.target.value)}
                placeholder="Search users by name.."
                style={{ border: 'none', background: 'transparent', padding: '6px 0', fontSize: '0.9rem', flexGrow: 1, outline: 'none' }}
              />
              {userSearchTerm && (
                <button onClick={() => setUserSearchTerm('')} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                  <X size={18} />
                </button>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 500 }}>Sort By</span>
              <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-sidebar)', padding: '0.4rem 1rem', borderRadius: '12px', border: '1px solid var(--border)', minWidth: '130px' }}>
                <select
                  value={roleFilter}
                  onChange={e => setRoleFilter(e.target.value)}
                  style={{ background: 'none', border: 'none', fontSize: '0.85rem', color: 'var(--text-main)', cursor: 'pointer', outline: 'none', width: '100%', padding: '4px 0', fontWeight: 600 }}
                >
                  <option value="All">All Roles</option>
                  <option value="Admin">Admin</option>
                  <option value="Manager">Manager</option>
                  <option value="User">User</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 500 }}>Categorize by</span>
              <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-sidebar)', padding: '0.4rem 1rem', borderRadius: '12px', border: '1px solid var(--border)', minWidth: '130px' }}>
                <select
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value)}
                  style={{ background: 'none', border: 'none', fontSize: '0.85rem', color: 'var(--text-main)', cursor: 'pointer', outline: 'none', width: '100%', padding: '4px 0', fontWeight: 600 }}
                >
                  <option value="All">Status</option>
                  <option value="Active">Active</option>
                  <option value="Suspended">Suspended</option>
                </select>
              </div>
            </div>
          </div>

          {/* Manage Users Table */}
          <div className="panel" style={{ padding: 0, display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
              <h3 style={{ fontSize: '1.05rem', margin: 0, fontWeight: 700 }}>Manage Users</h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                {isSelectionMode && checkedUserIds.length > 0 && (
                  <button
                    onClick={handleBulkDelete}
                    style={{ background: '#ef4444', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', boxShadow: '0 2px 4px rgba(239, 68, 68, 0.2)' }}
                  >
                    <Trash2 size={13} /> Delete Selected ({checkedUserIds.length})
                  </button>
                )}
                <span
                  onClick={() => {
                    setIsSelectionMode(!isSelectionMode);
                    setCheckedUserIds([]);
                  }}
                  style={{ color: '#2563eb', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px' }}
                >
                  {isSelectionMode ? 'Cancel Select' : 'Select'}
                </span>
                <span
                  onClick={() => { setUserSearchTerm(''); setRoleFilter('All'); setStatusFilter('All'); }}
                  style={{ color: '#10b981', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px' }}
                >
                  View All <ChevronRight size={14} />
                </span>
              </div>
            </div>

            <div style={{ overflow: 'auto', flex: 1 }}>
              <div style={{ minWidth: '900px' }}>
                {(() => {
                  const gridColumns = isSelectionMode
                    ? '0.4fr 2.2fr 1.2fr 1.4fr 1.2fr 1fr'
                    : '2.2fr 1.2fr 1.4fr 1.2fr 1fr';
                  return (
                    <>
                      <div style={{
                        display: 'grid', gridTemplateColumns: gridColumns,
                        padding: '0.85rem 1.5rem', background: '#f8fafc', borderBottom: '1px solid var(--border)',
                        color: 'var(--text-muted)', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
                        alignItems: 'center'
                      }}>
                        {isSelectionMode && (
                          <input
                            type="checkbox"
                            checked={paginatedUsers.length > 0 && paginatedUsers.filter(u => u.username !== 'admin').every(u => checkedUserIds.includes(u.id))}
                            onChange={handleToggleSelectAll}
                            style={{ cursor: 'pointer', width: '15px', height: '15px' }}
                          />
                        )}
                        <span>Name</span>
                        <span>Role</span>
                        <span>Created on</span>
                        <span>Status</span>
                        <span>Actions</span>
                      </div>

                      {paginatedUsers.map(u => {
                        const role = roleBadgeColors(u.role);
                        const status = statusBadgeColors(u.is_active);
                        
                        // Capitalized name formatting
                        const capUsername = u.username.split(/[\s_.-]+/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
                        const userEmail = u.email || `${u.username.toLowerCase()}@social.corp`;

                        return (
                          <div
                            key={u.id}
                            onClick={() => {
                              if (isSelectionMode) {
                                if (u.username !== 'admin') {
                                  handleToggleUserChecked(u.id);
                                }
                              } else {
                                setSelectedUser(u);
                              }
                            }}
                            style={{
                              display: 'grid', gridTemplateColumns: gridColumns,
                              padding: '0.9rem 1.5rem', borderBottom: '1px solid var(--border)', fontSize: '0.9rem',
                              alignItems: 'center', cursor: 'pointer', transition: 'background 0.15s'
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                          >
                            {isSelectionMode && (
                              <input
                                type="checkbox"
                                checked={checkedUserIds.includes(u.id)}
                                disabled={u.username === 'admin'}
                                onChange={(e) => {
                                  e.stopPropagation();
                                  handleToggleUserChecked(u.id);
                                }}
                                onClick={(e) => e.stopPropagation()}
                                style={{ cursor: u.username === 'admin' ? 'not-allowed' : 'pointer', width: '15px', height: '15px' }}
                              />
                            )}

                            {/* Name Column */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                              <div style={{
                                width: '36px', height: '36px', borderRadius: '50%', background: '#0a46d1',
                                color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.85rem', flexShrink: 0
                              }}>
                                {u.username[0].toUpperCase()}
                              </div>
                              <div style={{ minWidth: 0 }}>
                                <div style={{ fontWeight: 700, color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{capUsername}</div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: '2px' }}>{userEmail}</div>
                              </div>
                            </div>

                            {/* Role Badge */}
                            <span>
                              <span style={{ background: role.bg, color: role.fg, padding: '4px 12px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 700 }}>{u.role}</span>
                            </span>

                            {/* Created on Date */}
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{formatDate(u.created_at)}</span>

                            {/* Status Badge */}
                            <span>
                              <span style={{ background: status.bg, color: status.fg, padding: '4px 12px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 700 }}>{u.is_active ? 'Active' : 'Suspended'}</span>
                            </span>

                            {/* Actions Column (Edit pencil and Bin icons) */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }} onClick={e => e.stopPropagation()}>
                              <button
                                onClick={() => openAssignPopup(u)}
                                style={{ background: 'none', border: 'none', padding: '4px', cursor: 'pointer', color: '#7c3aed', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                title="Assign Manager / Survey"
                              >
                                <FileEdit size={17} />
                              </button>
                              <button
                                onClick={() => setSelectedUser(u)}
                                style={{ background: 'none', border: 'none', padding: '4px', cursor: 'pointer', color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                title="Edit User"
                              >
                                <Edit3 size={17} />
                              </button>
                              {u.username !== 'admin' && (
                                <button
                                  onClick={() => handleDeleteUserDirect(u)}
                                  style={{ background: 'none', border: 'none', padding: '4px', cursor: 'pointer', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                  title="Delete User"
                                >
                                  <Trash2 size={17} />
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </>
                  );
                })()}

                {filteredUsers.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>
                    No users found matching "{userSearchTerm}" {roleFilter !== 'All' ? `with role ${roleFilter}` : ''}
                  </div>
                )}
              </div>
            </div>

            {totalPages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.5rem', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>Page {currentPage} of {totalPages}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    style={{ width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: currentPage === 1 ? 0.4 : 1, cursor: currentPage === 1 ? 'not-allowed' : 'pointer', background: 'var(--bg-sidebar)', border: '1px solid var(--border)', color: 'var(--text-main)', padding: 0 }}
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
                            width: '32px', height: '32px', borderRadius: '8px', border: '1px solid var(--border)',
                            background: currentPage === pageNum ? 'var(--accent-primary)' : 'var(--bg-sidebar)',
                            color: currentPage === pageNum ? 'white' : 'var(--text-main)', cursor: 'pointer', fontWeight: 700, fontSize: '0.75rem'
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
                    style={{ width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: currentPage === totalPages ? 0.4 : 1, cursor: currentPage === totalPages ? 'not-allowed' : 'pointer', background: 'var(--bg-sidebar)', border: '1px solid var(--border)', color: 'var(--text-main)', padding: 0 }}
                    title="Next Page"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Create User Modal */}
      {showCreateUserModal && (
        <div
          onClick={() => setShowCreateUserModal(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200, padding: '2rem' }}
        >
          <div
            className="panel"
            onClick={e => e.stopPropagation()}
            style={{ width: '100%', maxWidth: '480px', maxHeight: '90vh', overflowY: 'auto', borderRadius: '20px', boxShadow: '0 30px 60px rgba(0,0,0,0.4)' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0 }}>Create Credential User</h3>
              <button onClick={() => setShowCreateUserModal(false)} style={{ background: 'none', border: 'none', padding: '4px', color: 'var(--text-muted)', display: 'flex' }}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleCreateUser} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div>
                <label style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-muted)', marginBottom: '5px', display: 'block' }}>FULL NAME <span style={{ color: '#ef4444' }}>*</span></label>
                <input value={newUsername} onChange={e => setNewUsername(e.target.value)} placeholder="Jordan Patel" required />
              </div>
              <div>
                <label style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-muted)', marginBottom: '5px', display: 'block' }}>EMAIL ADDRESS <span style={{ color: '#ef4444' }}>*</span></label>
                <input value={newUserEmail} onChange={e => setNewUserEmail(e.target.value)} placeholder="user@domain.com" type="email" required />
              </div>
              <div>
                <label style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-muted)', marginBottom: '5px', display: 'block' }}>PASSWORD <span style={{ color: '#ef4444' }}>*</span></label>
                <div style={{ position: 'relative' }}>
                  <input
                    value={newUserPassword}
                    onChange={e => setNewUserPassword(e.target.value)}
                    type={showCreatePassword ? 'text' : 'password'}
                    placeholder="Min. 8 characters"
                    minLength={8}
                    required
                    style={{ paddingRight: '42px' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowCreatePassword(!showCreatePassword)}
                    style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', padding: 0, display: 'flex' }}
                  >
                    {showCreatePassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              <div>
                <label style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-muted)', marginBottom: '5px', display: 'block' }}>SELECT ROLE <span style={{ color: '#ef4444' }}>*</span></label>
                <select value={newUserRole} onChange={e => setNewUserRole(e.target.value)} style={{ padding: '0.7rem' }}>
                  <option value="User">User</option>
                  <option value="Manager">Manager</option>
                  <option value="Admin">Admin</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-muted)', marginBottom: '5px', display: 'block' }}>SURVEY FIELD</label>
                <select value={selectedUserSurveyId} onChange={e => setSelectedUserSurveyId(e.target.value)} style={{ padding: '0.7rem' }}>
                  <option value="">Select field...</option>
                  {surveys.map(s => <option key={s.id} value={s.id}>{s.title} ({s.category})</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '5px' }}>
                <button type="button" onClick={() => setShowCreateUserModal(false)} style={{ background: 'rgba(var(--accent-primary-rgb), 0.1)', border: 'none', color: 'var(--accent-primary)', fontWeight: 700, padding: '0 20px' }}>Cancel</button>
                <button className="primary" type="submit" style={{ padding: '0 24px' }}>Create User</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Assign popup — set this user's manager and survey from the table's row action */}
      {assignPopupUser && (
        <div
          onClick={() => setAssignPopupUser(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.4)', backdropFilter: 'blur(4px)', zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem', animation: 'fade-in 0.2s ease-out' }}
        >
          <div
            className="panel"
            onClick={e => e.stopPropagation()}
            style={{ width: '100%', maxWidth: '480px', borderRadius: '24px', padding: '1.75rem', background: '#ffffff', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', border: '1px solid var(--border)', animation: 'pop-in 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-main)' }}>
                <FileEdit size={18} color="#7c3aed" /> Assign Survey
              </h3>
              <button onClick={() => setAssignPopupUser(null)} style={{ background: 'none', border: 'none', padding: '4px', color: 'var(--text-muted)', display: 'flex', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            {/* User */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1.25rem', paddingBottom: '1.25rem', borderBottom: '1px solid var(--border)' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#0a46d1', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.95rem', flexShrink: 0 }}>
                {assignPopupUser.username[0].toUpperCase()}
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-main)' }}>{assignPopupUser.username}</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{assignPopupUser.email || '—'}</div>
              </div>
              <span style={{ marginLeft: 'auto', background: roleBadgeColors(assignPopupUser.role).bg, color: roleBadgeColors(assignPopupUser.role).fg, padding: '4px 12px', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 700, flexShrink: 0 }}>{assignPopupUser.role}</span>
            </div>

            {/* Manager */}
            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px', display: 'block' }}>Manager</label>
              <select
                value={assignPopupManagerId}
                onChange={e => handleAssignPopupManager(e.target.value)}
                disabled={assignPopupSaving}
                style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', fontSize: '0.85rem', border: '1px solid var(--border)' }}
              >
                <option value="">No manager</option>
                {users.filter(u => u.role === 'Manager').map(m => <option key={m.id} value={m.id}>{m.username}</option>)}
              </select>
            </div>

            {/* Surveys */}
            <div>
              <label style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px', display: 'block' }}>Assigned Surveys</label>
              {assignPopupUser.assigned_surveys?.length > 0 ? (
                <div style={{ border: '1px solid var(--border)', borderRadius: '10px', overflow: 'hidden', marginBottom: '10px' }}>
                  {assignPopupUser.assigned_surveys.map(s => {
                    const isDirect = assignPopupUser.direct_surveys?.some(ds => ds.id === s.id);
                    return (
                      <div key={s.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderTop: '1px solid #f1f5f9', fontSize: '0.85rem' }}>
                        <span className="truncate" style={{ fontWeight: 600 }}>{s.title}</span>
                        {isDirect && (
                          <button onClick={() => handleUnassignPopupSurvey(s.id)} title="Unassign" style={{ background: 'none', border: 'none', color: '#ef4444', padding: 0, display: 'flex', cursor: 'pointer', flexShrink: 0 }}>
                            <X size={14} />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div style={{ padding: '0.85rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem', border: '1px dashed var(--border)', borderRadius: '10px', marginBottom: '10px' }}>
                  No surveys assigned.
                </div>
              )}
              <div style={{ display: 'flex', gap: '8px' }}>
                <select
                  value={assignPopupSurveyId}
                  onChange={e => setAssignPopupSurveyId(e.target.value)}
                  style={{ flex: 1, padding: '10px 12px', borderRadius: '10px', fontSize: '0.85rem', border: '1px solid var(--border)' }}
                >
                  <option value="">Assign another survey...</option>
                  {surveys.filter(s => !assignPopupUser.assigned_surveys?.some(a => a.id === s.id)).map(s => (
                    <option key={s.id} value={s.id}>{s.title} ({s.category || 'General'})</option>
                  ))}
                </select>
                <button
                  className="primary"
                  onClick={handleAssignPopupSurvey}
                  disabled={!assignPopupSurveyId || assignPopupSaving}
                  style={{ padding: '0 16px', borderRadius: '10px', fontSize: '0.82rem', fontWeight: 700, whiteSpace: 'nowrap', opacity: (!assignPopupSurveyId || assignPopupSaving) ? 0.5 : 1 }}
                >
                  Assign
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Custom Delete Confirmation Modal (Single User) */}
      {deleteConfirmUser && (
        <div
          onClick={() => setDeleteConfirmUser(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.4)', backdropFilter: 'blur(4px)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem', animation: 'fade-in 0.2s ease-out' }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ width: '100%', maxWidth: '420px', borderRadius: '24px', padding: '2.25rem 2rem 2rem', background: '#ffffff', boxShadow: '0 20px 40px rgba(0,0,0,0.15)', border: '1px solid var(--border)', textAlign: 'center', position: 'relative', animation: 'pop-in 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)' }}
          >
            <button onClick={() => setDeleteConfirmUser(null)} style={{ position: 'absolute', top: '1.25rem', right: '1.25rem', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <X size={18} />
            </button>

            <div style={{ width: '76px', height: '76px', borderRadius: '50%', background: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem', color: '#ef4444' }}>
              <Trash2 size={32} />
            </div>

            <h3 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '0.75rem', marginTop: 0 }}>Delete User?</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem', lineHeight: 1.55, margin: '0 0 1.5rem', padding: '0 10px' }}>
              Are you sure you want to delete user <strong>"{deleteConfirmUser.username}"</strong>? This action cannot be undone.
            </p>

            {/* History deletion option checkbox */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 14px', background: '#f8fafc', border: '1px dashed var(--border)', borderRadius: '12px', marginBottom: '1.75rem', textAlign: 'left' }}>
              <input
                type="checkbox"
                id="confirm-delete-history"
                checked={deleteConfirmHistoryChecked}
                onChange={e => setDeleteConfirmHistoryChecked(e.target.checked)}
                style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: 'var(--accent-primary)', flexShrink: 0 }}
              />
              <label htmlFor="confirm-delete-history" style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-main)', cursor: 'pointer', userSelect: 'none', lineHeight: 1.4 }}>
                Also delete all activity logs and survey submissions
              </label>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => setDeleteConfirmUser(null)}
                style={{ flex: 1, padding: '12px 0', borderRadius: '14px', border: '1px solid var(--border)', background: '#ffffff', color: 'var(--text-muted)', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer', transition: 'background 0.2s' }}
                onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                onMouseLeave={e => e.currentTarget.style.background = '#ffffff'}
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteUserConfirmed}
                style={{ flex: 1, padding: '12px 0', borderRadius: '14px', border: 'none', background: 'var(--accent-primary)', color: 'white', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer', transition: 'filter 0.2s' }}
                onMouseEnter={e => e.currentTarget.style.filter = 'brightness(1.1)'}
                onMouseLeave={e => e.currentTarget.style.filter = 'none'}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Delete Confirmation Modal (Bulk) */}
      {deleteConfirmBulk && (
        <div
          onClick={() => setDeleteConfirmBulk(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.4)', backdropFilter: 'blur(4px)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem', animation: 'fade-in 0.2s ease-out' }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ width: '100%', maxWidth: '420px', borderRadius: '24px', padding: '2.25rem 2rem 2rem', background: '#ffffff', boxShadow: '0 20px 40px rgba(0,0,0,0.15)', border: '1px solid var(--border)', textAlign: 'center', position: 'relative', animation: 'pop-in 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)' }}
          >
            <button onClick={() => setDeleteConfirmBulk(false)} style={{ position: 'absolute', top: '1.25rem', right: '1.25rem', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <X size={18} />
            </button>

            <div style={{ width: '76px', height: '76px', borderRadius: '50%', background: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem', color: '#ef4444' }}>
              <Trash2 size={32} />
            </div>

            <h3 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '0.75rem', marginTop: 0 }}>Delete Selected?</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem', lineHeight: 1.55, margin: '0 0 1.5rem', padding: '0 10px' }}>
              Are you sure you want to delete the <strong>{checkedUserIds.length}</strong> selected users? This action cannot be undone.
            </p>

            {/* History deletion option checkbox */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 14px', background: '#f8fafc', border: '1px dashed var(--border)', borderRadius: '12px', marginBottom: '1.75rem', textAlign: 'left' }}>
              <input
                type="checkbox"
                id="confirm-delete-history-bulk"
                checked={deleteConfirmHistoryChecked}
                onChange={e => setDeleteConfirmHistoryChecked(e.target.checked)}
                style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: 'var(--accent-primary)', flexShrink: 0 }}
              />
              <label htmlFor="confirm-delete-history-bulk" style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-main)', cursor: 'pointer', userSelect: 'none', lineHeight: 1.4 }}>
                Also delete all activity logs and survey submissions
              </label>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => setDeleteConfirmBulk(false)}
                style={{ flex: 1, padding: '12px 0', borderRadius: '14px', border: '1px solid var(--border)', background: '#ffffff', color: 'var(--text-muted)', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer', transition: 'background 0.2s' }}
                onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                onMouseLeave={e => e.currentTarget.style.background = '#ffffff'}
              >
                Cancel
              </button>
              <button
                onClick={handleBulkDeleteConfirmed}
                style={{ flex: 1, padding: '12px 0', borderRadius: '14px', border: 'none', background: 'var(--accent-primary)', color: 'white', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer', transition: 'filter 0.2s' }}
                onMouseEnter={e => e.currentTarget.style.filter = 'brightness(1.1)'}
                onMouseLeave={e => e.currentTarget.style.filter = 'none'}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Delete Confirmation Modal (Group) */}
      {deleteConfirmGroup && (
        <div
          onClick={() => setDeleteConfirmGroup(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.4)', backdropFilter: 'blur(4px)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem', animation: 'fade-in 0.2s ease-out' }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ width: '100%', maxWidth: '420px', borderRadius: '24px', padding: '2.25rem 2rem 2rem', background: '#ffffff', boxShadow: '0 20px 40px rgba(0,0,0,0.15)', border: '1px solid var(--border)', textAlign: 'center', position: 'relative', animation: 'pop-in 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)' }}
          >
            <button onClick={() => setDeleteConfirmGroup(null)} style={{ position: 'absolute', top: '1.25rem', right: '1.25rem', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <X size={18} />
            </button>

            <div style={{ width: '76px', height: '76px', borderRadius: '50%', background: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem', color: '#ef4444' }}>
              <Trash2 size={32} />
            </div>

            <h3 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '0.75rem', marginTop: 0 }}>Delete Group?</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem', lineHeight: 1.55, margin: '0 0 1.75rem', padding: '0 10px' }}>
              Are you sure you want to permanently delete group <strong>"{deleteConfirmGroup.name}"</strong>? This action cannot be undone.
            </p>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => setDeleteConfirmGroup(null)}
                style={{ flex: 1, padding: '12px 0', borderRadius: '14px', border: '1px solid var(--border)', background: '#ffffff', color: 'var(--text-muted)', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer', transition: 'background 0.2s' }}
                onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                onMouseLeave={e => e.currentTarget.style.background = '#ffffff'}
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteGroupConfirmed}
                style={{ flex: 1, padding: '12px 0', borderRadius: '14px', border: 'none', background: 'var(--accent-primary)', color: 'white', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer', transition: 'filter 0.2s' }}
                onMouseEnter={e => e.currentTarget.style.filter = 'brightness(1.1)'}
                onMouseLeave={e => e.currentTarget.style.filter = 'none'}
              >
                Delete
              </button>
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
