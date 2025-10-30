import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Switch, TouchableOpacity, TextInput } from 'react-native';

export default function Settings() {
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [autoBackup, setAutoBackup] = useState(true);
  const [biometricAuth, setBiometricAuth] = useState(false);
  const [darkMode, setDarkMode] = useState(false);

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Profile Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>👤 Profile Settings</Text>
        <View style={styles.settingsCard}>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Full Name</Text>
            <TextInput
              style={styles.input}
              placeholder="Admin User"
              placeholderTextColor="#94a3b8"
            />
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Email</Text>
            <TextInput
              style={styles.input}
              placeholder="admin@lookback.com"
              placeholderTextColor="#94a3b8"
              keyboardType="email-address"
            />
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Role</Text>
            <View style={styles.roleTag}>
              <Text style={styles.roleTagText}>Administrator</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.saveButton}>
            <Text style={styles.saveButtonText}>💾 Save Changes</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Blynk IoT Integration Status */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🌐 Blynk IoT Integration</Text>
        <View style={styles.settingsCard}>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Status</Text>
            <View style={styles.statusRow}>
              <View style={styles.statusDotGreen} />
              <Text style={styles.statusText}>Connected to Blynk Cloud</Text>
            </View>
            <Text style={styles.settingDescription}>
              💡 Template: lookback (TMPL31Se8tinV)
            </Text>
            <Text style={styles.settingDescription}>
              🔗 Remote monitoring and control enabled
            </Text>
          </View>
        </View>
      </View>

      {/* Notifications */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🔔 Notifications</Text>
        <View style={styles.settingsCard}>
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Push Notifications</Text>
              <Text style={styles.settingDescription}>Receive alerts for new evidence</Text>
            </View>
            <Switch
              value={notificationsEnabled}
              onValueChange={setNotificationsEnabled}
              trackColor={{ false: '#e2e8f0', true: '#93c5fd' }}
              thumbColor={notificationsEnabled ? '#3b82f6' : '#f1f5f9'}
            />
          </View>
          <View style={styles.divider} />
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Email Notifications</Text>
              <Text style={styles.settingDescription}>Daily summary reports</Text>
            </View>
            <Switch
              value={true}
              onValueChange={() => {}}
              trackColor={{ false: '#e2e8f0', true: '#93c5fd' }}
              thumbColor={'#3b82f6'}
            />
          </View>
        </View>
      </View>

      {/* Security */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🔒 Security</Text>
        <View style={styles.settingsCard}>
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Biometric Authentication</Text>
              <Text style={styles.settingDescription}>Use fingerprint or Face ID</Text>
            </View>
            <Switch
              value={biometricAuth}
              onValueChange={setBiometricAuth}
              trackColor={{ false: '#e2e8f0', true: '#93c5fd' }}
              thumbColor={biometricAuth ? '#3b82f6' : '#f1f5f9'}
            />
          </View>
          <View style={styles.divider} />
          <TouchableOpacity style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Change Password</Text>
              <Text style={styles.settingDescription}>Last changed 45 days ago</Text>
            </View>
            <Text style={styles.arrow}>→</Text>
          </TouchableOpacity>
          <View style={styles.divider} />
          <TouchableOpacity style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Two-Factor Authentication</Text>
              <Text style={styles.settingDescription}>Enabled</Text>
            </View>
            <Text style={styles.arrow}>→</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Storage & Backup */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>💾 Storage & Backup</Text>
        <View style={styles.settingsCard}>
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Auto Backup</Text>
              <Text style={styles.settingDescription}>Backup data daily at 2:00 AM</Text>
            </View>
            <Switch
              value={autoBackup}
              onValueChange={setAutoBackup}
              trackColor={{ false: '#e2e8f0', true: '#93c5fd' }}
              thumbColor={autoBackup ? '#3b82f6' : '#f1f5f9'}
            />
          </View>
          <View style={styles.divider} />
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Storage Used</Text>
              <Text style={styles.settingDescription}>8.4 GB / 50 GB</Text>
            </View>
            <View style={styles.storageBar}>
              <View style={styles.storageFill} />
            </View>
          </View>
        </View>
      </View>

      {/* Appearance */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🎨 Appearance</Text>
        <View style={styles.settingsCard}>
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Dark Mode</Text>
              <Text style={styles.settingDescription}>Currently using light theme</Text>
            </View>
            <Switch
              value={darkMode}
              onValueChange={setDarkMode}
              trackColor={{ false: '#e2e8f0', true: '#93c5fd' }}
              thumbColor={darkMode ? '#3b82f6' : '#f1f5f9'}
            />
          </View>
        </View>
      </View>

      {/* About */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>ℹ️ About</Text>
        <View style={styles.settingsCard}>
          <View style={styles.aboutRow}>
            <Text style={styles.aboutLabel}>Version</Text>
            <Text style={styles.aboutValue}>1.0.0</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.aboutRow}>
            <Text style={styles.aboutLabel}>Build</Text>
            <Text style={styles.aboutValue}>2025.10.15</Text>
          </View>
          <View style={styles.divider} />
          <TouchableOpacity style={styles.aboutRow}>
            <Text style={styles.aboutLabel}>Terms of Service</Text>
            <Text style={styles.arrow}>→</Text>
          </TouchableOpacity>
          <View style={styles.divider} />
          <TouchableOpacity style={styles.aboutRow}>
            <Text style={styles.aboutLabel}>Privacy Policy</Text>
            <Text style={styles.arrow}>→</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Danger Zone */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>⚠️ Danger Zone</Text>
        <View style={styles.settingsCard}>
          <TouchableOpacity style={styles.dangerButton}>
            <Text style={styles.dangerButtonText}>🚪 Logout</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.dangerButton, { backgroundColor: '#fee2e2', marginTop: 10 }]}>
            <Text style={[styles.dangerButtonText, { color: '#dc2626' }]}>🗑️ Clear All Data</Text>
          </TouchableOpacity>
        </View>
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
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 12,
  },
  settingsCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#1e293b',
  },
  roleTag: {
    backgroundColor: '#dbeafe',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  roleTagText: {
    fontSize: 13,
    color: '#3b82f6',
    fontWeight: '600',
  },
  saveButton: {
    backgroundColor: '#3b82f6',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  settingInfo: {
    flex: 1,
    marginRight: 16,
  },
  settingLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 3,
  },
  settingDescription: {
    fontSize: 12,
    color: '#64748b',
  },
  divider: {
    height: 1,
    backgroundColor: '#f1f5f9',
  },
  arrow: {
    fontSize: 18,
    color: '#94a3b8',
  },
  storageBar: {
    width: 100,
    height: 8,
    backgroundColor: '#e2e8f0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  storageFill: {
    width: '17%',
    height: '100%',
    backgroundColor: '#3b82f6',
  },
  aboutRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  aboutLabel: {
    fontSize: 14,
    color: '#475569',
    fontWeight: '500',
  },
  aboutValue: {
    fontSize: 14,
    color: '#1e293b',
    fontWeight: '600',
  },
  dangerButton: {
    backgroundColor: '#fef3c7',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  dangerButtonText: {
    color: '#d97706',
    fontSize: 14,
    fontWeight: '600',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 12,
  },
  statusDotGreen: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#10b981',
    marginRight: 8,
  },
  statusText: {
    fontSize: 14,
    color: '#1e293b',
    fontWeight: '500',
  },
});
