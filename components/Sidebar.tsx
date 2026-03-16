import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';

interface SidebarProps {
  activeScreen: string;
  onNavigate: (screen: string) => void;
}

const menuItems = [
  { id: 'evidenceSearch', label: 'EVIDENCE SEARCH', icon: '🔍' },
  { id: 'documentScanner', label: 'DOCUMENT SCANNER', icon: '📄' },
  { id: 'liveStream', label: 'LIVE STREAM', icon: '📹' },
  { id: 'analytics', label: 'ANALYTICS & REPORTS', icon: '📊' },
  { id: 'userLogs', label: 'USER LOGS & MANAGEMENT', icon: '👥' },
  { id: 'settings', label: 'SYSTEM SETTINGS', icon: '⚙️' },
];

export default function Sidebar({ activeScreen, onNavigate }: SidebarProps) {
  return (
    <View style={styles.container}>
      {/* Logo/Title */}
      <View style={styles.header}>
        <View style={styles.logoContainer}>
          <Text style={styles.logoIcon}>👁️</Text>
        </View>
        <Text style={styles.logoText}>LOOKBACK</Text>
        <Text style={styles.subtitle}>ADMIN PORTAL</Text>
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
    backgroundColor: '#0f172a',
    borderRightWidth: 1,
    borderRightColor: '#1e293b',
    height: '100%',
  },
  header: {
    padding: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
    alignItems: 'center',
    marginTop: 20,
  },
  logoContainer: {
    width: 48,
    height: 48,
    borderRadius: 4,
    backgroundColor: '#1e293b',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  logoIcon: {
    fontSize: 22,
  },
  logoText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#f8fafc',
    marginBottom: 4,
    letterSpacing: 2,
  },
  subtitle: {
    fontSize: 10,
    color: '#64748b',
    fontWeight: '700',
    letterSpacing: 2,
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
    borderRadius: 4,
    marginBottom: 4,
  },
  menuItemActive: {
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
  },
  menuIcon: {
    fontSize: 16,
    marginRight: 14,
  },
  menuLabel: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '700',
    flex: 1,
    letterSpacing: 0.5,
  },
  menuLabelActive: {
    color: '#f8fafc',
    fontWeight: '800',
  },
  footer: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
    alignItems: 'center',
  },
  footerText: {
    fontSize: 10,
    color: '#475569',
    marginBottom: 4,
    fontWeight: '700',
    letterSpacing: 1,
  },
  footerCopyright: {
    fontSize: 10,
    color: '#334155',
    fontWeight: '600',
  },
});
