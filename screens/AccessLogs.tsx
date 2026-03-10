import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import FirebaseService, { AccessLogItem } from '../services/FirebaseService';

export default function AccessLogs() {
  const [logs, setLogs] = useState<AccessLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState('All');

  const loadLogs = useCallback(async () => {
    try {
      const data = await FirebaseService.getAccessLogs(200);
      setLogs(data);
    } catch (error) {
      console.error('Load logs error:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  const onRefresh = () => {
    setRefreshing(true);
    loadLogs();
  };

  const getSeverity = (action: string): string => {
    if (action.toLowerCase().includes('delete') || action.toLowerCase().includes('unauthorized')) return 'critical';
    if (action.toLowerCase().includes('failed') || action.toLowerCase().includes('warning')) return 'warning';
    return 'info';
  };

  const getType = (action: string): string => {
    if (action.toLowerCase().includes('login') || action.toLowerCase().includes('logout')) return 'login';
    if (action.toLowerCase().includes('access') || action.toLowerCase().includes('view')) return 'access';
    if (action.toLowerCase().includes('delete') || action.toLowerCase().includes('unauthorized') || action.toLowerCase().includes('failed')) return 'security';
    if (action.toLowerCase().includes('upload') || action.toLowerCase().includes('capture') || action.toLowerCase().includes('scan')) return 'upload';
    return 'access';
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const filteredLogs = logs.filter(log => {
    if (filter === 'All') return true;
    return getType(log.action).toLowerCase() === filter.toLowerCase();
  });

  const stats = {
    total: logs.length,
    warnings: logs.filter(l => getSeverity(l.action) === 'warning').length,
    critical: logs.filter(l => getSeverity(l.action) === 'critical').length,
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text style={styles.loadingText}>Loading access logs...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Stats */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{stats.total}</Text>
          <Text style={styles.statLabel}>Total Events</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: '#fef3c7' }]}>
          <Text style={[styles.statValue, { color: '#d97706' }]}>{stats.warnings}</Text>
          <Text style={styles.statLabel}>Warnings</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: '#fee2e2' }]}>
          <Text style={[styles.statValue, { color: '#dc2626' }]}>{stats.critical}</Text>
          <Text style={styles.statLabel}>Critical</Text>
        </View>
      </View>

      {/* Filter Buttons */}
      <View style={styles.filterRow}>
        {['All', 'Login', 'Access', 'Security', 'Upload'].map(f => (
          <TouchableOpacity
            key={f}
            style={[styles.filterButton, filter === f && styles.filterActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>{f}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Logs Table */}
      <View style={styles.tableContainer}>
        <View style={styles.tableHeader}>
          <Text style={[styles.tableHeaderText, { flex: 1 }]}>Time</Text>
          <Text style={[styles.tableHeaderText, { flex: 2 }]}>User</Text>
          <Text style={[styles.tableHeaderText, { flex: 3 }]}>Action</Text>
          <Text style={[styles.tableHeaderText, { flex: 1 }]}>Type</Text>
        </View>

        <ScrollView
          style={styles.tableBody}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {filteredLogs.length === 0 ? (
            <View style={{ padding: 24, alignItems: 'center' }}>
              <Text style={{ color: '#94a3b8', fontSize: 14 }}>No access logs yet</Text>
            </View>
          ) : (
            filteredLogs.map((log) => {
              const severity = getSeverity(log.action);
              return (
                <TouchableOpacity key={log.id} style={styles.tableRow}>
                  <View style={[styles.tableCell, { flex: 1 }]}>
                    <Text style={styles.timeText}>{formatTime(log.timestamp)}</Text>
                  </View>
                  <View style={[styles.tableCell, { flex: 2 }]}>
                    <Text style={styles.userText} numberOfLines={1}>
                      {log.userName}
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
                        severity === 'critical'
                          ? styles.badgeCritical
                          : severity === 'warning'
                          ? styles.badgeWarning
                          : styles.badgeInfo,
                      ]}
                    >
                      <Text
                        style={[
                          styles.severityText,
                          severity === 'critical'
                            ? styles.textCritical
                            : severity === 'warning'
                            ? styles.textWarning
                            : styles.textInfo,
                        ]}
                      >
                        {severity === 'critical' ? '🔴' : severity === 'warning' ? '⚠️' : 'ℹ️'}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
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
});
