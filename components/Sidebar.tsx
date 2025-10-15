import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';

interface SidebarProps {
  activeScreen: string;
  onNavigate: (screen: string) => void;
}

const menuItems = [
  { id: 'liveStream', label: 'Live Stream', icon: '📹' },
  { id: 'evidenceVault', label: 'Evidence Vault', icon: '🗄️' },
  { id: 'documentScanner', label: 'Document Scanner', icon: '📄' },
  { id: 'evidenceSearch', label: 'Evidence Search', icon: '🔍' },
  { id: 'deviceStatus', label: 'Device Status', icon: '📱' },
  { id: 'accessLogs', label: 'Access Logs / Security Events', icon: '🔐' },
  { id: 'userCase', label: 'User & Case Management', icon: '👥' },
  { id: 'analytics', label: 'Analytics & Reports', icon: '📊' },
  { id: 'settings', label: 'Settings', icon: '⚙️' },
];

export default function Sidebar({ activeScreen, onNavigate }: SidebarProps) {
  return (
    <View style={styles.container}>
      {/* Logo/Title */}
      <View style={styles.header}>
        <View style={styles.logoContainer}>
          <Text style={styles.logoIcon}>👁️</Text>
        </View>
        <Text style={styles.logoText}>LookBack</Text>
        <Text style={styles.subtitle}>Admin Portal</Text>
      </View>

      {/* Menu Items */}
      <ScrollView style={styles.menuContainer} showsVerticalScrollIndicator={false}>
        {menuItems.map((item) => (
          <TouchableOpacity
            key={item.id}
            style={[
              styles.menuItem,
              activeScreen === item.id && styles.menuItemActive,
            ]}
            onPress={() => onNavigate(item.id)}
            activeOpacity={0.7}
          >
            <Text style={styles.menuIcon}>{item.icon}</Text>
            <Text
              style={[
                styles.menuLabel,
                activeScreen === item.id && styles.menuLabelActive,
              ]}
              numberOfLines={2}
            >
              {item.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>v1.0.0</Text>
        <Text style={styles.footerCopyright}>© 2025 LookBack</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 260,
    backgroundColor: '#f8fafc',
    borderRightWidth: 1,
    borderRightColor: '#e2e8f0',
    height: '100%',
  },
  header: {
    padding: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    alignItems: 'center',
  },
  logoContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#3b82f6',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  logoIcon: {
    fontSize: 28,
  },
  logoText: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '500',
  },
  menuContainer: {
    flex: 1,
    paddingVertical: 16,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    marginHorizontal: 12,
    borderRadius: 10,
    marginBottom: 4,
  },
  menuItemActive: {
    backgroundColor: '#3b82f6',
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  menuIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  menuLabel: {
    fontSize: 14,
    color: '#475569',
    fontWeight: '500',
    flex: 1,
  },
  menuLabelActive: {
    color: '#ffffff',
    fontWeight: '600',
  },
  footer: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    color: '#94a3b8',
    marginBottom: 4,
  },
  footerCopyright: {
    fontSize: 10,
    color: '#cbd5e1',
  },
});
