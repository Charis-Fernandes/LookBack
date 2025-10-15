import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';

const mockLogs = [
  { id: 1, type: 'login', user: 'admin@lookback.com', action: 'User Login', time: '10:45 AM', severity: 'info' },
  { id: 2, type: 'access', user: 'officer.jane@dept.gov', action: 'Accessed Case #2024-1045', time: '10:32 AM', severity: 'info' },
  { id: 3, type: 'security', user: 'system', action: 'Failed Login Attempt', time: '10:15 AM', severity: 'warning' },
  { id: 4, type: 'upload', user: 'officer.john@dept.gov', action: 'Uploaded Evidence File', time: '09:58 AM', severity: 'info' },
  { id: 5, type: 'security', user: 'system', action: 'Unauthorized Access Blocked', time: '09:45 AM', severity: 'critical' },
  { id: 6, type: 'delete', user: 'admin@lookback.com', action: 'Deleted Draft Report', time: '09:30 AM', severity: 'warning' },
  { id: 7, type: 'access', user: 'forensic.team@dept.gov', action: 'Downloaded Evidence Package', time: '09:12 AM', severity: 'info' },
  { id: 8, type: 'login', user: 'supervisor@dept.gov', action: 'User Login', time: '08:45 AM', severity: 'info' },
];

export default function AccessLogs() {
  return (
    <View style={styles.container}>
      {/* Stats */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>142</Text>
          <Text style={styles.statLabel}>Today's Events</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: '#fef3c7' }]}>
          <Text style={[styles.statValue, { color: '#d97706' }]}>8</Text>
          <Text style={styles.statLabel}>Warnings</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: '#fee2e2' }]}>
          <Text style={[styles.statValue, { color: '#dc2626' }]}>2</Text>
          <Text style={styles.statLabel}>Critical</Text>
        </View>
      </View>

      {/* Filter Buttons */}
      <View style={styles.filterRow}>
        <TouchableOpacity style={[styles.filterButton, styles.filterActive]}>
          <Text style={[styles.filterText, styles.filterTextActive]}>All</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.filterButton}>
          <Text style={styles.filterText}>Login</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.filterButton}>
          <Text style={styles.filterText}>Access</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.filterButton}>
          <Text style={styles.filterText}>Security</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.filterButton}>
          <Text style={styles.filterText}>Changes</Text>
        </TouchableOpacity>
      </View>

      {/* Logs Table */}
      <View style={styles.tableContainer}>
        <View style={styles.tableHeader}>
          <Text style={[styles.tableHeaderText, { flex: 1 }]}>Time</Text>
          <Text style={[styles.tableHeaderText, { flex: 2 }]}>User</Text>
          <Text style={[styles.tableHeaderText, { flex: 3 }]}>Action</Text>
          <Text style={[styles.tableHeaderText, { flex: 1 }]}>Type</Text>
        </View>

        <ScrollView style={styles.tableBody} showsVerticalScrollIndicator={false}>
          {mockLogs.map((log) => (
            <TouchableOpacity key={log.id} style={styles.tableRow}>
              <View style={[styles.tableCell, { flex: 1 }]}>
                <Text style={styles.timeText}>{log.time}</Text>
              </View>
              <View style={[styles.tableCell, { flex: 2 }]}>
                <Text style={styles.userText} numberOfLines={1}>
                  {log.user}
                </Text>
              </View>
              <View style={[styles.tableCell, { flex: 3 }]}>
                <Text style={styles.actionText} numberOfLines={1}>
                  {log.action}
                </Text>
              </View>
              <View style={[styles.tableCell, { flex: 1 }]}>
                <View
                  style={[
                    styles.severityBadge,
                    log.severity === 'critical'
                      ? styles.badgeCritical
                      : log.severity === 'warning'
                      ? styles.badgeWarning
                      : styles.badgeInfo,
                  ]}
                >
                  <Text
                    style={[
                      styles.severityText,
                      log.severity === 'critical'
                        ? styles.textCritical
                        : log.severity === 'warning'
                        ? styles.textWarning
                        : styles.textInfo,
                    ]}
                  >
                    {log.severity === 'critical' ? '🔴' : log.severity === 'warning' ? '⚠️' : 'ℹ️'}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
    padding: 24,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center',
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  filterActive: {
    backgroundColor: '#3b82f6',
    borderColor: '#3b82f6',
  },
  filterText: {
    fontSize: 13,
    color: '#475569',
    fontWeight: '600',
  },
  filterTextActive: {
    color: '#ffffff',
  },
  tableContainer: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    overflow: 'hidden',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f8fafc',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  tableHeaderText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
    textTransform: 'uppercase',
  },
  tableBody: {
    flex: 1,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  tableCell: {
    justifyContent: 'center',
    paddingRight: 8,
  },
  timeText: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '500',
  },
  userText: {
    fontSize: 13,
    color: '#1e293b',
    fontWeight: '500',
  },
  actionText: {
    fontSize: 13,
    color: '#475569',
  },
  severityBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeInfo: {
    backgroundColor: '#dbeafe',
  },
  badgeWarning: {
    backgroundColor: '#fef3c7',
  },
  badgeCritical: {
    backgroundColor: '#fee2e2',
  },
  severityText: {
    fontSize: 14,
  },
  textInfo: {
    color: '#3b82f6',
  },
  textWarning: {
    color: '#d97706',
  },
  textCritical: {
    color: '#dc2626',
  },
});
