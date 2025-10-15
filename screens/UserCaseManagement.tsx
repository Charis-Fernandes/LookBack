import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput } from 'react-native';

const mockUsers = [
  { id: 1, name: 'Officer Jane Smith', role: 'Field Officer', cases: 12, status: 'active' },
  { id: 2, name: 'Detective John Doe', role: 'Lead Detective', cases: 8, status: 'active' },
  { id: 3, name: 'Officer Mike Johnson', role: 'Field Officer', cases: 15, status: 'active' },
  { id: 4, name: 'Forensic Analyst Sarah', role: 'Forensics', cases: 6, status: 'inactive' },
];

const mockCases = [
  { id: 1, caseId: '#2024-1045', title: 'Downtown Incident', assignee: 'Jane Smith', status: 'active', date: '2025-10-14' },
  { id: 2, caseId: '#2024-1044', title: 'Robbery Investigation', assignee: 'John Doe', status: 'active', date: '2025-10-13' },
  { id: 3, caseId: '#2024-1043', title: 'Traffic Violation', assignee: 'Mike Johnson', status: 'closed', date: '2025-10-12' },
  { id: 4, caseId: '#2024-1042', title: 'Evidence Collection', assignee: 'Sarah Lee', status: 'active', date: '2025-10-11' },
];

export default function UserCaseManagement() {
  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Users Section */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>👥 Users</Text>
          <TouchableOpacity style={styles.addButton}>
            <Text style={styles.addButtonText}>+ Add User</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.searchBox}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search users..."
            placeholderTextColor="#94a3b8"
          />
        </View>

        <View style={styles.cardsGrid}>
          {mockUsers.map((user) => (
            <View key={user.id} style={styles.userCard}>
              <View style={styles.userAvatar}>
                <Text style={styles.avatarText}>
                  {user.name.split(' ').map(n => n[0]).join('')}
                </Text>
              </View>
              <View style={styles.userInfo}>
                <Text style={styles.userName}>{user.name}</Text>
                <Text style={styles.userRole}>{user.role}</Text>
                <View style={styles.userMeta}>
                  <Text style={styles.userCases}>{user.cases} cases</Text>
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
                </View>
              </View>
              <TouchableOpacity style={styles.moreButton}>
                <Text style={styles.moreButtonText}>⋮</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      </View>

      {/* Cases Section */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>📋 Cases</Text>
          <TouchableOpacity style={styles.addButton}>
            <Text style={styles.addButtonText}>+ New Case</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.searchBox}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search cases..."
            placeholderTextColor="#94a3b8"
          />
        </View>

        {mockCases.map((caseItem) => (
          <TouchableOpacity key={caseItem.id} style={styles.caseCard}>
            <View style={styles.caseHeader}>
              <View>
                <Text style={styles.caseId}>{caseItem.caseId}</Text>
                <Text style={styles.caseTitle}>{caseItem.title}</Text>
              </View>
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
            </View>
            <View style={styles.caseFooter}>
              <Text style={styles.caseAssignee}>👤 {caseItem.assignee}</Text>
              <Text style={styles.caseDate}>📅 {caseItem.date}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>
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
});
