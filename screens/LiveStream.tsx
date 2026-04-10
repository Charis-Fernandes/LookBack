import React, { useState, useRef, useEffect } from 'react';
import {
  Platform,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Modal,
  Alert,
} from 'react-native';
import { WebView } from 'react-native-webview';
import LocalFileStorageService from '../services/LocalFileStorageService';
import FirebaseService from '../services/FirebaseService';
import { createEvidenceOnChain, hashDataUrl } from '../services/BlockchainService';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { storage } from '../config/firebase.config';
import UserProfileService from '../services/UserProfileService';

const DEFAULT_STREAM_URL = 'http://10.57.121.241:81';

const normalizeStreamBaseUrl = (url: string) =>
  url.replace(/\/(stream|mjpeg|snapshot|capture)\/?$/, '').replace(/\/$/, '');

export default function LiveStream() {
  const [streamUrl, setStreamUrl] = useState(DEFAULT_STREAM_URL);
  const [tempUrl, setTempUrl] = useState(DEFAULT_STREAM_URL);
  const [showUrlModal, setShowUrlModal] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [retryCount, setRetryCount] = useState(0);
  const [streamReloadToken, setStreamReloadToken] = useState(0);
  const [isCaptureLoading, setIsCaptureLoading] = useState(false);
  const [streamQuality, setStreamQuality] = useState<'SD' | 'HD' | 'FHD'>('HD');
  const [showQualityModal, setShowQualityModal] = useState(false);
  const webViewRef = useRef<WebView>(null);
  const hasLoggedConnectionRef = useRef(false);
  const streamSourceUrl = normalizeStreamBaseUrl(streamUrl);
  const liveStreamEndpoint = `${streamSourceUrl}/stream`;
  const liveStreamUrlWithToken = `${liveStreamEndpoint}?t=${streamReloadToken}`;

  const uploadSnapshotToFirebase = async (dataUrl: string) => {
    const dataResponse = await fetch(dataUrl);
    const blob = await dataResponse.blob();
    const extension = (blob.type || '').includes('png') ? 'png' : 'jpg';
    const filePath = `evidence_snapshots/livestream/${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`;
    const fileRef = ref(storage, filePath);

    await uploadBytes(fileRef, blob, {
      contentType: blob.type || 'image/jpeg',
      customMetadata: {
        source: 'live-stream',
        platform: Platform.OS,
      },
    });

    return getDownloadURL(fileRef);
  };

  const webImageStyle: React.CSSProperties = {
    width: '100%',
    height: '100%',
    objectFit: 'contain',
    backgroundColor: '#000000',
    transform: 'rotate(90deg)',
    transformOrigin: 'center center',
  };

  useEffect(() => {
    console.log('[LiveStream] init', {
      platform: Platform.OS,
      streamUrl,
      streamSourceUrl,
      liveStreamEndpoint,
    });
  }, [liveStreamEndpoint, streamSourceUrl, streamUrl]);

  useEffect(() => {
    if (!isConnected && retryCount > 0 && retryCount < 5) {
      const timer = setTimeout(() => {
        handleReload();
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [isConnected, retryCount]);

  useEffect(() => {
    const logEspConnection = async () => {
      if (!isConnected || hasLoggedConnectionRef.current) return;
      hasLoggedConnectionRef.current = true;

      const actor = await UserProfileService.getAuditIdentity();
      await FirebaseService.logAccess({
        userId: actor.userId,
        userName: actor.userName,
        action: 'ESP32-CAM connected',
        resource: streamSourceUrl,
        timestamp: Date.now(),
      });
    };

    logEspConnection().catch((error) => {
      console.warn('[LiveStream] failed to log ESP connection', error);
    });
  }, [isConnected, streamSourceUrl]);

  const handleReload = () => {
    console.log('[LiveStream] reload requested', {
      platform: Platform.OS,
      streamUrl,
      streamSourceUrl,
      liveStreamEndpoint,
      liveStreamUrlWithToken,
      retryCount,
    });
    setIsLoading(true);
    setRetryCount(prev => prev + 1);
    setStreamReloadToken(prev => prev + 1);
    if (webViewRef.current) {
      webViewRef.current.reload();
    }
  };

  const handleLoadStart = () => {
    console.log('[LiveStream] load start', {
      platform: Platform.OS,
      streamUrl,
      streamSourceUrl,
      liveStreamEndpoint,
      liveStreamUrlWithToken,
    });
    setIsLoading(true);
  };

  const handleLoadEnd = () => {
    console.log('[LiveStream] load end', {
      platform: Platform.OS,
      streamUrl,
      streamSourceUrl,
      liveStreamEndpoint,
      liveStreamUrlWithToken,
    });
    setIsLoading(false);
    setIsConnected(true);
    setRetryCount(0);
  };

  const handleError = (error?: unknown) => {
    console.warn('[LiveStream] load error', {
      platform: Platform.OS,
      streamUrl,
      streamSourceUrl,
      liveStreamEndpoint,
      liveStreamUrlWithToken,
      error,
    });
    setIsLoading(false);
    setIsConnected(false);
  };

  const handleUrlChange = () => {
    const normalizedUrl = normalizeStreamBaseUrl(tempUrl);
    console.log('[LiveStream] url changed', {
      previous: streamUrl,
      input: tempUrl,
      normalizedUrl,
    });
    setStreamUrl(normalizedUrl);
    setTempUrl(normalizedUrl);
    setShowUrlModal(false);
    setRetryCount(0);
    handleReload();
  };

  const handleCaptureSnapshot = async () => {
    if (!isConnected) {
      Alert.alert('Error', 'Stream is not connected. Please connect first.');
      return;
    }

    try {
      setIsCaptureLoading(true);
      console.log('[LiveStream] capture requested', {
        platform: Platform.OS,
        streamUrl,
        streamSourceUrl,
        liveStreamEndpoint,
        liveStreamUrlWithToken,
      });

      // Capture snapshot from ESP32-CAM - use base URL with /capture
      const baseUrl = streamSourceUrl;
      const captureUrl = `${baseUrl}/capture`;
      console.log('📸 Capturing from:', captureUrl);

      // Fetch the image
      const response = await fetch(captureUrl);
      if (!response.ok) {
        throw new Error('Failed to capture image from stream');
      }

      const blob = await response.blob();
      
      // Convert blob to data URL for local storage
      const reader = new FileReader();
      reader.readAsDataURL(blob);
      
      const dataUrl = await new Promise<string>((resolve, reject) => {
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
      });

      const fileHash = hashDataUrl(dataUrl);

      // Save to local storage
      console.log('💾 Saving to local storage...');
      await LocalFileStorageService.saveSnapshot(dataUrl, {
        deviceId: 'esp32-cam',
        quality: streamQuality,
        streamUrl: streamUrl,
      });

      // Upload image to Firebase Storage and keep public URL in evidence metadata
      console.log('☁️ Uploading snapshot image to Firebase Storage...');
      const firebaseImageUrl = await uploadSnapshotToFirebase(dataUrl);
      console.log('✅ Firebase Storage upload complete:', firebaseImageUrl);

      // Save metadata to Firestore
      console.log('☁️ Saving metadata to Firestore...');
      const evidenceId = await FirebaseService.saveEvidence({
        imageUrl: firebaseImageUrl,
        thumbnailUrl: firebaseImageUrl,
        timestamp: Date.now(),
        deviceId: 'esp32-cam',
        quality: streamQuality,
        streamUrl: streamUrl,
        category: 'snapshot',
        fileHash,
        blockchainStored: false,
      }).catch(err => console.warn('Firestore save warning:', err));

      // ── BLOCKCHAIN INTEGRATION: Store evidence hash on-chain ──
      if (evidenceId) {
        try {
          console.log('🔗 Storing evidence on blockchain...');

          const txHash = await createEvidenceOnChain(evidenceId, fileHash);
          
          // Update Firestore with blockchain data
          await FirebaseService.updateEvidence(evidenceId, {
            fileHash,
            blockchainTxHash: txHash,
            blockchainStored: true,
            blockchainEvidenceId: evidenceId,
          });
          
          console.log('✅ Evidence secured on blockchain:', txHash);
        } catch (blockchainError) {
          console.warn('⚠️ Blockchain storage failed:', blockchainError);
          // Continue with upload even if blockchain fails
        }
      }

      // Log to Blynk

      Alert.alert(
        '✅ Success',
        'Snapshot captured and saved to local storage!',
        [{ text: 'OK' }]
      );

      console.log('✅ Snapshot saved to local storage');
    } catch (error) {
      console.error('❌ Capture error:', error);
      Alert.alert(
        '❌ Error',
        'Failed to capture snapshot. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsCaptureLoading(false);
    }
  };

  const handleQualityChange = (quality: 'SD' | 'HD' | 'FHD') => {
    setStreamQuality(quality);
    setShowQualityModal(false);
  };

  return (
    <View style={styles.container}>
      {/* URL Configuration Modal */}
      <Modal
        visible={showUrlModal}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowUrlModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>SOURCE CONFIGURATION</Text>
            <Text style={styles.modalSubtitle}>
              INPUT DEVICE IP ADDRESS OR NODE ENDPOINT
            </Text>
            <TextInput
              style={styles.urlInput}
              value={tempUrl}
              onChangeText={setTempUrl}
              placeholder="http://10.57.121.241:81"
              placeholderTextColor="#94a3b8"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
            />
            <View style={styles.modalHint}>
              <Text style={styles.hintText}>[SYS]: VERIFY NETWORK ISOLATION PROTOCOLS</Text>
            </View>
            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={[styles.modalButton, styles.cancelButton]} 
                onPress={() => {
                  setTempUrl(streamUrl);
                  setShowUrlModal(false);
                }}
              >
                <Text style={styles.cancelButtonText}>ABORT</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalButton, styles.saveButton]} 
                onPress={handleUrlChange}
              >
                <Text style={styles.saveButtonText}>INITIALIZE</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Status Bar */}
      <View style={styles.statusBar}>
        <View style={styles.statusItem}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={[styles.statusDot, isConnected ? styles.connected : styles.disconnected]} />
            <Text style={styles.statusText}>
              {isConnected ? 'LINK_ESTABLISHED' : 'LINK_TERMINATED'}
            </Text>
          </View>
        </View>
        <TouchableOpacity onPress={() => setShowUrlModal(true)} style={{ marginTop: 8, marginBottom: 12 }}>
          <Text numberOfLines={1} ellipsizeMode="middle" style={styles.urlTextEditable}>
            {streamUrl} [EDIT]
          </Text>
        </TouchableOpacity>
        <View style={styles.buttonGroup}>
          <TouchableOpacity 
            style={[styles.actionButton, styles.captureButton]} 
            onPress={handleCaptureSnapshot}
            disabled={!isConnected || isCaptureLoading}
          >
            <Text style={styles.actionButtonText}>
              {isCaptureLoading ? '[YIELD]' : 'CAPTURE'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionButton, styles.reconnectButton]} onPress={handleReload}>
            <Text style={styles.actionButtonText}>RE-SYNC</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Stream Container */}
      <View style={[styles.streamContainer, Platform.OS === 'web' && styles.streamContainerWeb]}>
        {isLoading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#475569" />
            <Text style={styles.loadingText}>ACQUIRING SIGNAL...</Text>
            {retryCount > 0 && (
              <Text style={styles.retryText}>ATTEMPT 0{retryCount}</Text>
            )}
          </View>
        )}

        {Platform.OS === 'web' ? (
          <img
            key={`${liveStreamUrlWithToken}-${retryCount}`}
            src={liveStreamUrlWithToken}
            style={webImageStyle}
            onLoad={handleLoadEnd}
            onError={handleError}
            alt="Live stream"
          />
        ) : (
          <WebView
            ref={webViewRef}
            source={{ uri: liveStreamEndpoint }}
            style={styles.webview}
            onLoadStart={handleLoadStart}
            onLoadEnd={handleLoadEnd}
            onError={handleError}
            scrollEnabled={false}
            bounces={false}
            allowsInlineMediaPlayback={true}
            mediaPlaybackRequiresUserAction={false}
            javaScriptEnabled={true}
            domStorageEnabled={true}
          />
        )}
        
        {/* Overlay Overlay Crosshair for Tactical look */}
        <View style={styles.crosshairContainer} pointerEvents="none">
          <View style={styles.crosshairCenter} />
          <View style={styles.crosshairTop} />
          <View style={styles.crosshairBottom} />
          <View style={styles.crosshairLeft} />
          <View style={styles.crosshairRight} />
        </View>
      </View>

      {/* Info Cards */}
      <View style={styles.infoRow}>
        <View style={styles.infoCard}>
          <Text style={styles.infoLabel}>STATUS</Text>
          <Text style={[styles.infoValue, { color: isConnected ? '#10b981' : '#b91c1c' }]}>
            {isConnected ? 'LIVE' : 'DOWN'}
          </Text>
        </View>
        <View style={styles.infoCard}>
          <Text style={styles.infoLabel}>RETRIES</Text>
          <Text style={styles.infoValue}>0{retryCount}</Text>
        </View>
        <View style={styles.infoCard}>
          <Text style={styles.infoLabel}>SIGNAL</Text>
          <Text style={styles.infoValue}>UHF-HD</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f1f5f9',
    padding: 18,
  },
  statusBar: {
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 4,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  statusItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 0,
    marginRight: 8,
  },
  connected: {
    backgroundColor: '#10b981',
  },
  disconnected: {
    backgroundColor: '#b91c1c',
  },
  statusText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: 1,
  },
  urlTextEditable: {
    fontSize: 11,
    color: '#0f172a',
    width: '100%',
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#f8fafc',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    overflow: 'hidden',
    fontWeight: '700',
    fontFamily: 'monospace',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderRadius: 4,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  modalTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 8,
    letterSpacing: 1,
  },
  modalSubtitle: {
    fontSize: 10,
    color: '#64748b',
    marginBottom: 20,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  urlInput: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 4,
    padding: 14,
    fontSize: 12,
    color: '#0f172a',
    marginBottom: 12,
    fontFamily: 'monospace',
  },
  modalHint: {
    backgroundColor: '#f1f5f9',
    padding: 12,
    borderRadius: 4,
    marginBottom: 20,
    borderLeftWidth: 3,
    borderLeftColor: '#475569',
  },
  hintText: {
    fontSize: 10,
    color: '#475569',
    fontWeight: '800',
    fontFamily: 'monospace',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 4,
    alignItems: 'center',
    borderWidth: 1,
  },
  cancelButton: {
    backgroundColor: '#f8fafc',
    borderColor: '#cbd5e1',
  },
  cancelButtonText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#475569',
    letterSpacing: 1,
  },
  saveButton: {
    backgroundColor: '#0f172a',
    borderColor: '#0f172a',
  },
  saveButtonText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: 1,
  },
  buttonGroup: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    width: '100%',
  },
  actionButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 4,
    alignItems: 'center',
    borderWidth: 1,
  },
  actionButtonText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  reconnectButton: {
    backgroundColor: '#1e293b',
    borderColor: '#0f172a',
  },
  captureButton: {
    backgroundColor: '#0f172a',
    borderColor: '#000000',
  },
  streamContainer: {
    flex: 1,
    backgroundColor: '#000000',
    borderRadius: 4,
    overflow: 'hidden',
    position: 'relative',
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#1e293b',
  },
  streamContainerWeb: {
    height: 380,
    minHeight: 320,
    width: '100%',
    flexGrow: 0,
    flexShrink: 0,
  },
  webview: {
    flex: 1,
    backgroundColor: '#000000',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  loadingText: {
    color: '#f8fafc',
    marginTop: 16,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 2,
    fontFamily: 'monospace',
  },
  retryText: {
    color: '#94a3b8',
    marginTop: 8,
    fontSize: 10,
    fontWeight: '700',
    fontFamily: 'monospace',
  },
  crosshairContainer: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 500,
  },
  crosshairCenter: {
    width: 2, height: 2, backgroundColor: 'rgba(255,255,255,0.7)',
  },
  crosshairTop: {
    position: 'absolute', top: '35%', width: 1, height: 20, backgroundColor: 'rgba(255,255,255,0.5)',
  },
  crosshairBottom: {
    position: 'absolute', bottom: '35%', width: 1, height: 20, backgroundColor: 'rgba(255,255,255,0.5)',
  },
  crosshairLeft: {
    position: 'absolute', left: '35%', width: 20, height: 1, backgroundColor: 'rgba(255,255,255,0.5)',
  },
  crosshairRight: {
    position: 'absolute', right: '35%', width: 20, height: 1, backgroundColor: 'rgba(255,255,255,0.5)',
  },
  infoRow: {
    flexDirection: 'row',
    gap: 12,
  },
  infoCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 4,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  infoLabel: {
    fontSize: 10,
    color: '#64748b',
    marginBottom: 6,
    fontWeight: '700',
    letterSpacing: 1,
  },
  infoValue: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a',
    fontFamily: 'monospace',
  },
});
