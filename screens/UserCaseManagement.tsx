import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, ActivityIndicator, Modal, RefreshControl } from 'react-native';
import FirebaseService, { UserItem, CaseItem } from '../services/FirebaseService';

export default function UserCaseManagement() {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [cases, setCases] = useState<CaseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userSearch, setUserSearch] = useState('');
  const [caseSearch, setCaseSearch] = useState('');

  // Add User Modal
  const [showAddUser, setShowAddUser] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [newUserRole, setNewUserRole] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');

  // Add Case Modal
  const [showAddCase, setShowAddCase] = useState(false);
  const [newCaseTitle, setNewCaseTitle] = useState('');
  const [newCaseAssignee, setNewCaseAssignee] = useState('');
  const [newCaseDescription, setNewCaseDescription] = useState('');

  const loadData = useCallback(async () => {
    try {
      const [usersData, casesData] = await Promise.all([
        FirebaseService.listUsers(),
        FirebaseService.listCases(),
      ]);
      setUsers(usersData);
      setCases(casesData);
    } catch (error) {
      console.error('Load data error:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  // ─── User CRUD ───

  const handleAddUser = async () => {
    if (!newUserName.trim() || !newUserRole.trim()) {
      Alert.alert('Error', 'Name and Role are required');
      return;
    }
    try {
      await FirebaseService.addUser({
        name: newUserName.trim(),
        role: newUserRole.trim(),
        email: newUserEmail.trim() || undefined,
        status: 'active',
        caseCount: 0,
        createdAt: Date.now(),
      });
      setShowAddUser(false);
      setNewUserName('');
      setNewUserRole('');
      setNewUserEmail('');
      await loadData();
      Alert.alert('✅ Success', 'User added');
    } catch (error) {
      Alert.alert('Error', 'Failed to add user');
    }
  };

  const handleDeleteUser = (user: UserItem) => {
    Alert.alert('Delete User', `Remove ${user.name}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          if (user.id) await FirebaseService.deleteUser(user.id);
          await loadData();
        },
      },
    ]);
  };

  const handleToggleUserStatus = async (user: UserItem) => {
    if (!user.id) return;
    const newStatus = user.status === 'active' ? 'inactive' : 'active';
    await FirebaseService.updateUser(user.id, { status: newStatus });
    await loadData();
  };

  // ─── Case CRUD ───

  const handleAddCase = async () => {
    if (!newCaseTitle.trim() || !newCaseAssignee.trim()) {
      Alert.alert('Error', 'Title and Assignee are required');
      return;
    }
    const year = new Date().getFullYear();
    const num = String(cases.length + 1).padStart(4, '0');
    try {
      await FirebaseService.createCase({
        caseId: `#${year}-${num}`,
        title: newCaseTitle.trim(),
        description: newCaseDescription.trim() || undefined,
        assignee: newCaseAssignee.trim(),
        status: 'active',
        date: new Date().toISOString().split('T')[0],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      setShowAddCase(false);
      setNewCaseTitle('');
      setNewCaseAssignee('');
      setNewCaseDescription('');
      await loadData();
      Alert.alert('✅ Success', 'Case created');
    } catch (error) {
      Alert.alert('Error', 'Failed to create case');
    }
  };

  const handleToggleCaseStatus = async (caseItem: CaseItem) => {
    if (!caseItem.id) return;
    const newStatus = caseItem.status === 'active' ? 'closed' : 'active';
    await FirebaseService.updateCase(caseItem.id, { status: newStatus });
    await loadData();
  };

  const handleDeleteCase = (caseItem: CaseItem) => {
    Alert.alert('Delete Case', `Remove ${caseItem.caseId}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          if (caseItem.id) await FirebaseService.deleteCase(caseItem.id);
          await loadData();
        },
      },
    ]);
  };

  // ─── Filtering ───

  const filteredUsers = users.filter(u =>
    u.name.toLowerCase().includes(userSearch.toLowerCase()) ||
    u.role.toLowerCase().includes(userSearch.toLowerCase())
  );
  const filteredCases = cases.filter(c =>
    c.title.toLowerCase().includes(caseSearch.toLowerCase()) ||
    c.caseId.toLowerCase().includes(caseSearch.toLowerCase()) ||
    c.assignee.toLowerCase().includes(caseSearch.toLowerCase())
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text style={styles.loadingText}>Loading data...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* Users Section */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>👥 Users ({users.length})</Text>
          <TouchableOpacity style={styles.addButton} onPress={() => setShowAddUser(true)}>
            <Text style={styles.addButtonText}>+ Add User</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.searchBox}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search users..."
            placeholderTextColor="#94a3b8"
            value={userSearch}
            onChangeText={setUserSearch}
          />
        </View>

        <View style={styles.cardsGrid}>
          {filteredUsers.length === 0 ? (
            <Text style={styles.emptyText}>No users yet. Tap "+ Add User" to create one.</Text>
          ) : (
            filteredUsers.map((user) => (
              <View key={user.id} style={styles.userCard}>
                <View style={styles.userAvatar}>
                  <Text style={styles.avatarText}>
                    {user.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                  </Text>
                </View>
                <View style={styles.userInfo}>
                  <Text style={styles.userName}>{user.name}</Text>
                  <Text style={styles.userRole}>{user.role}</Text>
                  <View style={styles.userMeta}>
                    <Text style={styles.userCases}>{user.caseCount} cases</Text>
                    <TouchableOpacity onPress={() => handleToggleUserStatus(user)}>
                      <View
                        style={[
                          styles.userStatus,
                          user.status === 'active' ? styles.statusActive : styles.statusInactive,
                        ]}
                      >
                        <Text
                          style={[
                            styles.statusText,
                            user.status === 'active' ? styles.statusTextActive : styles.statusTextInactive,
                          ]}
                        >
                          {user.status}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  </View>
                </View>
                <TouchableOpacity style={styles.moreButton} onPress={() => handleDeleteUser(user)}>
                  <Text style={styles.moreButtonText}>🗑️</Text>
                </TouchableOpacity>
              </View>
            ))
          )}
        </View>
      </View>

      {/* Cases Section */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>📋 Cases ({cases.length})</Text>
          <TouchableOpacity style={styles.addButton} onPress={() => setShowAddCase(true)}>
            <Text style={styles.addButtonText}>+ New Case</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.searchBox}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search cases..."
            placeholderTextColor="#94a3b8"
            value={caseSearch}
            onChangeText={setCaseSearch}
          />
        </View>

        {filteredCases.length === 0 ? (
          <Text style={styles.emptyText}>No cases yet. Tap "+ New Case" to create one.</Text>
        ) : (
          filteredCases.map((caseItem) => (
            <TouchableOpacity key={caseItem.id} style={styles.caseCard} onLongPress={() => handleDeleteCase(caseItem)}>
              <View style={styles.caseHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.caseId}>{caseItem.caseId}</Text>
                  <Text style={styles.caseTitle}>{caseItem.title}</Text>
                </View>
                <TouchableOpacity onPress={() => handleToggleCaseStatus(caseItem)}>
                  <View
                    style={[
                      styles.caseStatus,
                      caseItem.status === 'active' ? styles.caseActive : styles.caseClosed,
                    ]}
                  >
                    <Text
                      style={[
                        styles.caseStatusText,
                        caseItem.status === 'active' ? styles.caseStatusTextActive : styles.caseStatusTextClosed,
                      ]}
                    >
                      {caseItem.status.toUpperCase()}
                    </Text>
                  </View>
                </TouchableOpacity>
              </View>
              <View style={styles.caseFooter}>
                <Text style={styles.caseAssignee}>👤 {caseItem.assignee}</Text>
                <Text style={styles.caseDate}>📅 {caseItem.date}</Text>
              </View>
            </TouchableOpacity>
          ))
        )}
      </View>

      {/* Add User Modal */}
      <Modal visible={showAddUser} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add New User</Text>
            <TextInput style={styles.modalInput} placeholder="Full Name *" placeholderTextColor="#94a3b8" value={newUserName} onChangeText={setNewUserName} />
            <TextInput style={styles.modalInput} placeholder="Role (e.g. Field Officer) *" placeholderTextColor="#94a3b8" value={newUserRole} onChangeText={setNewUserRole} />
            <TextInput style={styles.modalInput} placeholder="Email (optional)" placeholderTextColor="#94a3b8" value={newUserEmail} onChangeText={setNewUserEmail} keyboardType="email-address" />
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.cancelButton} onPress={() => setShowAddUser(false)}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.submitButton} onPress={handleAddUser}>
                <Text style={styles.submitButtonText}>Add User</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Add Case Modal */}
      <Modal visible={showAddCase} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Create New Case</Text>
            <TextInput style={styles.modalInput} placeholder="Case Title *" placeholderTextColor="#94a3b8" value={newCaseTitle} onChangeText={setNewCaseTitle} />
            <TextInput style={styles.modalInput} placeholder="Assignee Name *" placeholderTextColor="#94a3b8" value={newCaseAssignee} onChangeText={setNewCaseAssignee} />
            <TextInput style={[styles.modalInput, { height: 80 }]} placeholder="Description (optional)" placeholderTextColor="#94a3b8" value={newCaseDescription} onChangeText={setNewCaseDescription} multiline />
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.cancelButton} onPress={() => setShowAddCase(false)}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.submitButton} onPress={handleAddCase}>
                <Text style={styles.submitButtonText}>Create Case</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
    padding: 24,
  },
  section: {
    marginBottom: 32,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1e293b',
  },
  addButton: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  searchIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#1e293b',
  },
  cardsGrid: {
    gap: 12,
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  userAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#3b82f6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 3,
  },
  userRole: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 6,
  },
  userMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  userCases: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '500',
  },
  userStatus: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusActive: {
    backgroundColor: '#d1fae5',
  },
  statusInactive: {
    backgroundColor: '#fee2e2',
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  statusTextActive: {
    color: '#059669',
  },
  statusTextInactive: {
    color: '#dc2626',
  },
  moreButton: {
    padding: 8,
  },
  moreButtonText: {
    fontSize: 20,
    color: '#64748b',
  },
  caseCard: {
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  caseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  caseId: {
    fontSize: 13,
    color: '#3b82f6',
    fontWeight: '700',
    marginBottom: 4,
  },
  caseTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1e293b',
  },
  caseStatus: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  caseActive: {
    backgroundColor: '#d1fae5',
  },
  caseClosed: {
    backgroundColor: '#e2e8f0',
  },
  caseStatusText: {
    fontSize: 10,
    fontWeight: '700',
  },
  caseStatusTextActive: {
    color: '#059669',
  },
  caseStatusTextClosed: {
    color: '#475569',
  },
  caseFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  caseAssignee: {
    fontSize: 12,
    color: '#64748b',
  },
  caseDate: {
    fontSize: 12,
    color: '#64748b',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#64748b',
    fontWeight: '500',
  },
  emptyText: {
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
    paddingVertical: 24,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 20,
  },
  modalInput: {
    backgroundColor: '#f1f5f9',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14,
    color: '#1e293b',
    marginBottom: 12,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 8,
  },
  cancelButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
  },
  cancelButtonText: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '600',
  },
  submitButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#3b82f6',
  },
  submitButtonText: {
    fontSize: 14,
    color: '#ffffff',
    fontWeight: '600',
  },
});
