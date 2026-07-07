import { create } from 'zustand';

const useGroupStore = create((set) => ({
  groups: [],
  loading: false,

  fetchGroups: async () => {
    set({ loading: true });
    try {
      const response = await fetch('http://localhost:8000/api/groups/');
      const data = await response.json();
      set({ groups: data, loading: false });
    } catch (error) {
      console.error("Failed to fetch groups", error);
      set({ loading: false });
    }
  },

  createGroup: async (groupData) => {
    try {
      const response = await fetch('http://localhost:8000/api/groups/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(groupData),
      });
      const newGroup = await response.json();
      set((state) => ({ groups: [...state.groups, newGroup] }));
      return newGroup;
    } catch (error) {
      console.error("Failed to create group", error);
    }
  },

  assignSurvey: async (groupId, surveyId) => {
    try {
      await fetch(`http://localhost:8000/api/groups/${groupId}/assign/${surveyId}`, {
        method: 'POST',
      });
    } catch (error) {
      console.error("Failed to assign survey", error);
    }
  }
}));

export default useGroupStore;
