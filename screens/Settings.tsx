import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Switch, TouchableOpacity, TextInput, Platform } from 'react-native';

export default function Settings() {
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [autoBackup, setAutoBackup] = useState(true);
  const [biometricAuth, setBiometricAuth] = useState(false);
  const [darkMode, setDarkMode] = useState(false);

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Save Button */}
      <TouchableOpacity style={styles.topSaveBtn}>
        <Text style={styles.topSaveBtnText}>SAVE CONFIGURATION</Text>
      </TouchableOpacity>

      {/* Account Info */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>SYSTEM ADMINISTRATOR</Text>
        <View style={styles.settingsCard}>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>OPERATOR NAME</Text>
            <TextInput
              style={styles.input}
              placeholder="ADMIN USER"
              placeholderTextColor="#94a3b8"
            />
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>CONTACT EMAIL</Text>
            <TextInput
              style={styles.input}
              placeholder="admin@lookback.sys"
              placeholderTextColor="#94a3b8"
              keyboardType="email-address"
            />
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>ACCESS LEVEL</Text>
            <View style={styles.roleTag}>
              <Text style={styles.roleTagText}>LEVEL-5 (ADMIN)</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Blynk IoT Integration Status */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>EXTERNAL INTEGRATION</Text>
        <View style={styles.settingsCard}>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>BLYNK IOT NODE</Text>
            <View style={styles.statusRow}>
              <View style={styles.statusDotGreen} />
              <Text style={styles.statusText}>CONNECTED</Text>
            </View>
            <Text style={styles.settingDescription}>
              TMPL: lookback (TMPL31Se8tinV)
            </Text>
            <Text style={styles.settingDescription}>
              UPLINK ACTIVE
            </Text>
          </View>
        </View>
      </View>

      {/* Notifications */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>NODE ALERTS</Text>
        <View style={styles.settingsCard}>
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>SYSTEM PUSH ALERTS</Text>
              <Text style={styles.settingDescription}>CRITICAL EVENT NOTIFICATIONS</Text>
            </View>
            <Switch
              value={notificationsEnabled}
              onValueChange={setNotificationsEnabled}
              trackColor={{ false: '#e2e8f0', true: '#1e293b' }}
              thumbColor={'#f8fafc'}
            />
          </View>
          <View style={styles.divider} />
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>REPORT DIGEST</Text>
              <Text style={styles.settingDescription}>END-OF-SHIFT SUMMARY</Text>
            </View>
            <Switch
              value={true}
              onValueChange={() => {}}
              trackColor={{ false: '#e2e8f0', true: '#1e293b' }}
              thumbColor={'#f8fafc'}
            />
          </View>
        </View>
      </View>

      {/* Security */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>ACCESS CONTROL</Text>
        <View style={styles.settingsCard}>
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>BIOMETRIC LOCK</Text>
              <Text style={styles.settingDescription}>REQUIRE HARDWARE AUTH</Text>
            </View>
            <Switch
              value={biometricAuth}
              onValueChange={setBiometricAuth}
              trackColor={{ false: '#e2e8f0', true: '#1e293b' }}
              thumbColor={'#f8fafc'}
            />
          </View>
          <View style={styles.divider} />
          <TouchableOpacity style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>UPDATE PASSPHRASE</Text>
              <Text style={styles.settingDescription}>LAST ROTATED: 45 DAYS AGO</Text>
            </View>
            <Text style={styles.arrow}>{'>'}</Text>
          </TouchableOpacity>
          <View style={styles.divider} />
          <TouchableOpacity style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>MULTI-FACTOR AUTH</Text>
              <Text style={styles.settingDescription}>ENFORCED</Text>
            </View>
            <Text style={styles.arrow}>{'>'}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Storage & Backup */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>DATA RETENTION</Text>
        <View style={styles.settingsCard}>
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>AUTO ARCHIVE</Text>
              <Text style={styles.settingDescription}>SYNC AT 0200 HRS</Text>
            </View>
            <Switch
              value={autoBackup}
              onValueChange={setAutoBackup}
              trackColor={{ false: '#e2e8f0', true: '#1e293b' }}
              thumbColor={'#f8fafc'}
            />
          </View>
          <View style={styles.divider} />
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>LOCAL CAPACITY</Text>
              <Text style={styles.settingDescription}>8.4 GB / 50 GB ALLOCATED</Text>
            </View>
            <View style={styles.storageBar}>
              <View style={styles.storageFill} />
            </View>
          </View>
        </View>
      </View>

      {/* Appearance */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>INTERFACE PROTOCOL</Text>
        <View style={styles.settingsCard}>
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>NIGHT OPERATIONS MODE</Text>
              <Text style={styles.settingDescription}>HIGH CONTRAST THEME</Text>
            </View>
            <Switch
              value={darkMode}
              onValueChange={setDarkMode}
              trackColor={{ false: '#e2e8f0', true: '#1e293b' }}
              thumbColor={'#f8fafc'}
            />
          </View>
        </View>
      </View>

      {/* About */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>SYSTEM DIAGNOSTICS</Text>
        <View style={styles.settingsCard}>
          <View style={styles.aboutRow}>
            <Text style={styles.aboutLabel}>FIRMWARE</Text>
            <Text style={styles.aboutValue}>v1.4.2</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.aboutRow}>
            <Text style={styles.aboutLabel}>BUILD HASH</Text>
            <Text style={styles.aboutValue}>LK102025.10.15</Text>
          </View>
          <View style={styles.divider} />
          <TouchableOpacity style={styles.aboutRow}>
            <Text style={styles.aboutLabel}>OPERATING PROTOCOLS</Text>
            <Text style={styles.arrow}>{'>'}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Danger Zone */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>RESTRICTED OPERATIONS</Text>
        <View style={styles.settingsCard}>
          <TouchableOpacity style={[styles.dangerButton, { backgroundColor: '#f1f5f9', borderColor: '#cbd5e1' }]}>
            <Text style={[styles.dangerButtonText, { color: '#0f172a' }]}>TERMINATE SESSION</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.dangerButton, { backgroundColor: '#fef2f2', borderColor: '#fca5a5', marginTop: 10 }]}>
            <Text style={[styles.dangerButtonText, { color: '#b91c1c' }]}>WIPE LOCAL CACHE</Text>
          </TouchableOpacity>
        </View>
      </View>
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f1f5f9',
    padding: 18,
  },
  topSaveBtn: {
    backgroundColor: '#0f172a',
    paddingVertical: 12,
    borderRadius: 4,
    alignItems: 'center',
    marginBottom: 24,
  },
  topSaveBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748b',
    marginBottom: 8,
    letterSpacing: 1,
  },
  settingsCard: {
    backgroundColor: '#ffffff',
    borderRadius: 4,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 4,
    padding: 12,
    fontSize: 12,
    color: '#0f172a',
    fontWeight: '600',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  roleTag: {
    backgroundColor: '#1e293b',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  roleTagText: {
    fontSize: 10,
    color: '#f8fafc',
    fontWeight: '800',
    letterSpacing: 0.5,
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
    fontSize: 11,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  settingDescription: {
    fontSize: 10,
    color: '#64748b',
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  divider: {
    height: 1,
    backgroundColor: '#e2e8f0',
  },
  arrow: {
    fontSize: 14,
    color: '#94a3b8',
    fontWeight: '800',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  storageBar: {
    width: 100,
    height: 6,
    backgroundColor: '#e2e8f0',
    borderRadius: 2,
    overflow: 'hidden',
  },
  storageFill: {
    width: '17%',
    height: '100%',
    backgroundColor: '#0f172a',
  },
  aboutRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  aboutLabel: {
    fontSize: 11,
    color: '#475569',
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  aboutValue: {
    fontSize: 11,
    color: '#0f172a',
    fontWeight: '800',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  dangerButton: {
    paddingVertical: 14,
    borderRadius: 4,
    alignItems: 'center',
    borderWidth: 1,
  },
  dangerButtonText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 6,
  },
  statusDotGreen: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10b981',
    marginRight: 6,
  },
  statusText: {
    fontSize: 11,
    color: '#0f172a',
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});
