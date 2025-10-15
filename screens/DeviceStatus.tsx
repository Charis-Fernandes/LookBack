import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';

const mockDevices = [
  { id: 1, name: 'Smart Glasses Unit #001', status: 'online', battery: 85, lastSync: '2 mins ago' },
  { id: 2, name: 'Smart Glasses Unit #002', status: 'online', battery: 92, lastSync: '5 mins ago' },
  { id: 3, name: 'Smart Glasses Unit #003', status: 'offline', battery: 34, lastSync: '2 hours ago' },
  { id: 4, name: 'Smart Glasses Unit #004', status: 'online', battery: 78, lastSync: '1 min ago' },
  { id: 5, name: 'Smart Glasses Unit #005', status: 'charging', battery: 56, lastSync: '15 mins ago' },
  { id: 6, name: 'Smart Glasses Unit #006', status: 'online', battery: 91, lastSync: '3 mins ago' },
];

export default function DeviceStatus() {
  const onlineCount = mockDevices.filter(d => d.status === 'online').length;
  const offlineCount = mockDevices.filter(d => d.status === 'offline').length;

  return (
    <View style={styles.container}>
      {/* Stats Overview */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statIcon}>✅</Text>
          <Text style={styles.statValue}>{onlineCount}</Text>
          <Text style={styles.statLabel}>Online</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statIcon}>❌</Text>
          <Text style={styles.statValue}>{offlineCount}</Text>
          <Text style={styles.statLabel}>Offline</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statIcon}>📱</Text>
          <Text style={styles.statValue}>{mockDevices.length}</Text>
          <Text style={styles.statLabel}>Total Devices</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statIcon}>🔋</Text>
          <Text style={styles.statValue}>82%</Text>
          <Text style={styles.statLabel}>Avg Battery</Text>
        </View>
      </View>

      {/* Devices List */}
      <ScrollView style={styles.devicesList} showsVerticalScrollIndicator={false}>
        {mockDevices.map((device) => (
          <View key={device.id} style={styles.deviceCard}>
            <View style={styles.deviceHeader}>
              <View style={styles.deviceInfo}>
                <View
                  style={[
                    styles.statusIndicator,
                    device.status === 'online'
                      ? styles.statusOnline
                      : device.status === 'charging'
                      ? styles.statusCharging
                      : styles.statusOffline,
                  ]}
                />
                <View>
                  <Text style={styles.deviceName}>{device.name}</Text>
                  <Text style={styles.deviceSync}>Last sync: {device.lastSync}</Text>
                </View>
              </View>

              <View style={styles.deviceActions}>
                <TouchableOpacity style={styles.actionButton}>
                  <Text style={styles.actionButtonText}>⚙️</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionButton}>
                  <Text style={styles.actionButtonText}>ℹ️</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.deviceDetails}>
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>Status</Text>
                <View
                  style={[
                    styles.statusBadge,
                    device.status === 'online'
                      ? styles.badgeOnline
                      : device.status === 'charging'
                      ? styles.badgeCharging
                      : styles.badgeOffline,
                  ]}
                >
                  <Text
                    style={[
                      styles.statusBadgeText,
                      device.status === 'online'
                        ? styles.badgeTextOnline
                        : device.status === 'charging'
                        ? styles.badgeTextCharging
                        : styles.badgeTextOffline,
                    ]}
                  >
                    {device.status.toUpperCase()}
                  </Text>
                </View>
              </View>

              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>Battery</Text>
                <View style={styles.batteryContainer}>
                  <View style={styles.batteryBar}>
                    <View
                      style={[
                        styles.batteryFill,
                        { width: `${device.battery}%` },
                        device.battery > 60
                          ? styles.batteryHigh
                          : device.battery > 30
                          ? styles.batteryMedium
                          : styles.batteryLow,
                      ]}
                    />
                  </View>
                  <Text style={styles.batteryText}>{device.battery}%</Text>
                </View>
              </View>
            </View>
          </View>
        ))}
      </ScrollView>
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
    marginBottom: 24,
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
  statIcon: {
    fontSize: 28,
    marginBottom: 8,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 11,
    color: '#64748b',
    textAlign: 'center',
  },
  devicesList: {
    flex: 1,
  },
  deviceCard: {
    backgroundColor: '#ffffff',
    padding: 18,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  deviceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  deviceInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  statusIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 12,
  },
  statusOnline: {
    backgroundColor: '#10b981',
  },
  statusOffline: {
    backgroundColor: '#ef4444',
  },
  statusCharging: {
    backgroundColor: '#f59e0b',
  },
  deviceName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 3,
  },
  deviceSync: {
    fontSize: 12,
    color: '#64748b',
  },
  deviceActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    width: 32,
    height: 32,
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionButtonText: {
    fontSize: 16,
  },
  deviceDetails: {
    gap: 12,
  },
  detailItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '500',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeOnline: {
    backgroundColor: '#d1fae5',
  },
  badgeOffline: {
    backgroundColor: '#fee2e2',
  },
  badgeCharging: {
    backgroundColor: '#fef3c7',
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  badgeTextOnline: {
    color: '#059669',
  },
  badgeTextOffline: {
    color: '#dc2626',
  },
  badgeTextCharging: {
    color: '#d97706',
  },
  batteryContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  batteryBar: {
    width: 100,
    height: 8,
    backgroundColor: '#e2e8f0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  batteryFill: {
    height: '100%',
    borderRadius: 4,
  },
  batteryHigh: {
    backgroundColor: '#10b981',
  },
  batteryMedium: {
    backgroundColor: '#f59e0b',
  },
  batteryLow: {
    backgroundColor: '#ef4444',
  },
  batteryText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
});
