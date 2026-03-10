import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, Modal, TextInput } from 'react-native';
import { WebView } from 'react-native-webview';
import LocalFileStorageService from '../services/LocalFileStorageService';
import BlynkService from '../services/BlynkService';
import { BLYNK_CONFIG } from '../config/blynk.config';

export default function DocumentScanner() {
  const [streamUrl, setStreamUrl] = useState('http://10.145.212.207:81/stream');
  const [tempUrl, setTempUrl] = useState('http://10.145.212.207:81/stream');
  const [showUrlModal, setShowUrlModal] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [scanCount, setScanCount] = useState(0);
  const [isConnected, setIsConnected] = useState(false);
  const blynkService = new BlynkService(BLYNK_CONFIG.AUTH_TOKEN);

  useEffect(() => {
    loadScanCount();
  }, []);

  const loadScanCount = async () => {
    try {
      const count = await LocalFileStorageService.getSnapshotCount();
      setScanCount(count);
    } catch (error) {
      console.error('Error loading scan count:', error);
    }
  };

  const handleScanDocument = async () => {
    try {
      setIsScanning(true);
      console.log('📸 Scanning document from ESP32-CAM...');
      console.log('Current stream URL:', streamUrl);

      // Get base URL without /stream
      const baseUrl = streamUrl.replace(/\/stream$/, '').replace(/:81$/, '');
      const captureUrl = `${baseUrl}/capture`;

      console.log('📸 Capturing from:', captureUrl);

      const response = await fetch(captureUrl);
      console.log('Response status:', response.status);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const blob = await response.blob();
      console.log('Blob size:', blob.size, 'type:', blob.type);
      
      // Convert blob to data URL
      const reader = new FileReader();
      reader.readAsDataURL(blob);
      
      const dataUrl = await new Promise<string>((resolve, reject) => {
        reader.onloadend = () => {
          console.log('Data URL created, length:', (reader.result as string).length);
          resolve(reader.result as string);
        };
        reader.onerror = reject;
      });

      // Save to local storage
      console.log('💾 Saving document to Evidence Vault...');
      await LocalFileStorageService.saveSnapshot(dataUrl, {
        deviceId: 'esp32-cam-document',
        quality: 'HD',
        streamUrl: streamUrl,
      });

      // Log to Blynk
      blynkService.logEvent('DOCUMENT_SCANNED', 'Document scanned and saved');
      blynkService.sendNotification('📄 Document scanned successfully!');

      Alert.alert(
        '✅ Success',
        'Document scanned and saved to Evidence Vault!',
        [{ text: 'OK' }]
      );

      await loadScanCount();
    } catch (error) {
      console.error('❌ Scan error:', error);
      Alert.alert(
        '❌ Error',
        `Failed to scan document: ${error instanceof Error ? error.message : 'Unknown error'}`,
        [{ text: 'OK' }]
      );
    } finally {
      setIsScanning(false);
    }
  };

  const handleChangeUrl = () => {
    setStreamUrl(tempUrl);
    setShowUrlModal(false);
    setIsConnected(false);
  };

  const handleStreamLoad = () => {
    setIsConnected(true);
    console.log('✅ ESP32-CAM stream connected');
  };

  const handleStreamError = () => {
    setIsConnected(false);
    console.error('❌ ESP32-CAM stream connection failed');
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        {/* ESP32-CAM Stream Preview */}
        <View style={styles.cameraContainer}>
          <WebView
            source={{ uri: streamUrl }}
            style={styles.camera}
            onLoad={handleStreamLoad}
            onError={handleStreamError}
            startInLoadingState={true}
            injectedJavaScript={`
              const style = document.createElement('style');
              style.innerHTML = '#mjpeg-stream { transform: rotate(-90deg); width: 100vh; height: 100vw; }';
              document.head.appendChild(style);
              true;
            `}
            renderLoading={() => (
              <View style={styles.loadingOverlay}>
                <ActivityIndicator size="large" color="#3b82f6" />
                <Text style={styles.loadingText}>Loading ESP32-CAM stream...</Text>
              </View>
            )}
          />

          {/* Connection Status */}
          <View style={[styles.statusBadge, isConnected ? styles.statusConnected : styles.statusDisconnected]}>
            <Text style={styles.statusText}>
              {isConnected ? '🟢 Connected' : '🔴 Disconnected'}
            </Text>
          </View>

          {/* Scan Frame */}
          <View style={styles.scanFrame} />
        </View>

        {/* Instructions */}
        <View style={styles.instructionsCard}>
          <Text style={styles.instructionsTitle}>📋 Document Scanning</Text>
          <Text style={styles.instructionText}>
            1. Position document in front of ESP32-CAM{'\n'}
            2. Align within the blue frame{'\n'}
            3. Ensure good lighting and focus{'\n'}
            4. Tap "Scan Document" to capture
          </Text>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionContainer}>
          <TouchableOpacity 
            style={[styles.scanButton, isScanning && styles.scanButtonDisabled]}
            onPress={handleScanDocument}
            disabled={isScanning || !isConnected}
          >
            {isScanning ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <>
                <Text style={styles.scanButtonIcon}>�</Text>
                <Text style={styles.scanButtonText}>Scan Document</Text>
              </>
            )}
          </TouchableOpacity>

          <View style={styles.secondaryButtons}>
            <TouchableOpacity 
              style={styles.secondaryButton}
              onPress={() => setShowUrlModal(true)}
            >
              <Text style={styles.secondaryButtonText}>� Change URL</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.secondaryButton}
              onPress={() => {
                setIsConnected(false);
                setStreamUrl(streamUrl + '?t=' + Date.now());
              }}
            >
              <Text style={styles.secondaryButtonText}>🔄 Reconnect</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{scanCount}</Text>
            <Text style={styles.statLabel}>Total Scans</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>ESP32</Text>
            <Text style={styles.statLabel}>Camera</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>HD</Text>
            <Text style={styles.statLabel}>Quality</Text>
          </View>
        </View>
      </View>

      {/* URL Configuration Modal */}
      <Modal
        visible={showUrlModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowUrlModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>🔧 Configure ESP32-CAM URL</Text>
            <TextInput
              style={styles.modalInput}
              value={tempUrl}
              onChangeText={setTempUrl}
              placeholder="http://192.168.x.x:81/stream"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setShowUrlModal(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalSaveButton}
                onPress={handleChangeUrl}
              >
                <Text style={styles.modalSaveText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
    padding: 24,
  },
  content: {
    flex: 1,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#64748b',
    fontWeight: '500',
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  permissionIcon: {
    fontSize: 80,
    marginBottom: 20,
  },
  permissionTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 12,
    textAlign: 'center',
  },
  permissionText: {
    fontSize: 16,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  permissionButton: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  permissionButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  cameraContainer: {
    position: 'relative',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  camera: {
    height: 400,
  },
  capturedImage: {
    height: 400,
    resizeMode: 'contain',
    backgroundColor: '#000000',
  },
  cameraPlaceholder: {
    backgroundColor: '#e2e8f0',
    height: 400,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraIcon: {
    fontSize: 80,
    marginBottom: 12,
  },
  cameraText: {
    fontSize: 16,
    color: '#64748b',
    fontWeight: '500',
  },
  scanFrame: {
    position: 'absolute',
    top: 60,
    left: 40,
    right: 40,
    height: 280,
    borderWidth: 3,
    borderColor: '#3b82f6',
    borderRadius: 12,
    borderStyle: 'dashed',
  },
  instructionsCard: {
    backgroundColor: '#ffffff',
    padding: 20,
    borderRadius: 12,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  instructionsTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 12,
  },
  instructionText: {
    fontSize: 14,
    color: '#475569',
    lineHeight: 22,
  },
  actionContainer: {
    marginBottom: 20,
  },
  scanButton: {
    backgroundColor: '#3b82f6',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  scanButtonDisabled: {
    backgroundColor: '#94a3b8',
    shadowColor: '#94a3b8',
  },
  scanButtonIcon: {
    fontSize: 24,
    marginRight: 10,
  },
  scanButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: '#ffffff',
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  secondaryButtonText: {
    fontSize: 14,
    color: '#475569',
    fontWeight: '600',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  statBox: {
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
    fontSize: 20,
    fontWeight: '700',
    color: '#3b82f6',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 11,
    color: '#64748b',
    textAlign: 'center',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#e2e8f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusBadge: {
    position: 'absolute',
    top: 16,
    right: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  statusConnected: {
    backgroundColor: '#d1fae5',
  },
  statusDisconnected: {
    backgroundColor: '#fee2e2',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 6,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 16,
    textAlign: 'center',
  },
  modalInput: {
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
    padding: 14,
    fontSize: 14,
    color: '#1e293b',
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalCancelButton: {
    flex: 1,
    backgroundColor: '#f1f5f9',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '600',
  },
  modalSaveButton: {
    flex: 1,
    backgroundColor: '#3b82f6',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalSaveText: {
    fontSize: 14,
    color: '#ffffff',
    fontWeight: '700',
  },
});
