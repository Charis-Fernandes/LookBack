import React, { useState, useRef, useEffect } from 'react';
import {
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
import BlynkService from '../services/BlynkService';
import { BLYNK_CONFIG } from '../config/blynk.config';
import LocalFileStorageService from '../services/LocalFileStorageService';
import FirebaseService from '../services/FirebaseService';

export default function LiveStream() {
  const [streamUrl, setStreamUrl] = useState('http://10.145.212.207:81/stream');
  const [tempUrl, setTempUrl] = useState('http://10.145.212.207:81/stream');
  const [showUrlModal, setShowUrlModal] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [retryCount, setRetryCount] = useState(0);
  const [isCaptureLoading, setIsCaptureLoading] = useState(false);
  const [streamQuality, setStreamQuality] = useState<'SD' | 'HD' | 'FHD'>('HD');
  const [showQualityModal, setShowQualityModal] = useState(false);
  const webViewRef = useRef<WebView>(null);
  const blynkService = useRef(new BlynkService(BLYNK_CONFIG.AUTH_TOKEN)).current;

  useEffect(() => {
    if (!isConnected && retryCount > 0 && retryCount < 5) {
      const timer = setTimeout(() => {
        handleReload();
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [isConnected, retryCount]);

  // Poll Blynk for remote control commands
  useEffect(() => {
    const pollBlynk = async () => {
      try {
        // Check for reconnect trigger from Blynk
        const shouldReconnect = await blynkService.getReconnectTrigger();
        if (shouldReconnect) {
          handleReload();
        }

        // Check camera control state
        const cameraOn = await blynkService.getCameraControl();
        if (!cameraOn && isConnected) {
          // Stop stream if camera is turned off via Blynk
          setIsConnected(false);
        }
      } catch (error) {
        console.error('Blynk poll error:', error);
      }
    };

    const interval = setInterval(pollBlynk, 3000); // Poll every 3 seconds
    return () => clearInterval(interval);
  }, [isConnected]);

  // Update Blynk when connection status changes
  useEffect(() => {
    blynkService.updateStreamStatus(isConnected);
    blynkService.updateCameraControl(isConnected);
    
    if (isConnected) {
      blynkService.updateQuality('Good');
      blynkService.logEvent('STREAM_CONNECT', 'Live stream connected successfully');
    } else {
      blynkService.updateQuality('Offline');
    }
  }, [isConnected]);

  const handleReload = () => {
    setIsLoading(true);
    setRetryCount(prev => prev + 1);
    if (webViewRef.current) {
      webViewRef.current.reload();
    }
    
    // Notify Blynk
    blynkService.logEvent('STREAM_RECONNECT', `Reconnecting to stream (attempt ${retryCount + 1})`);
  };

  const handleLoadStart = () => {
    setIsLoading(true);
  };

  const handleLoadEnd = () => {
    setIsLoading(false);
    setIsConnected(true);
    setRetryCount(0);
    
    // Notify Blynk
    blynkService.sendNotification('📹 LookBack stream is now live!');
  };

  const handleError = () => {
    setIsLoading(false);
    setIsConnected(false);
    
    // Notify Blynk
    blynkService.updateDeviceStatus('Error');
    blynkService.logEvent('STREAM_ERROR', 'Failed to connect to stream');
  };

  const handleUrlChange = () => {
    setStreamUrl(tempUrl);
    setShowUrlModal(false);
    setRetryCount(0);
    handleReload();
    
    // Update Blynk with new URL
    blynkService.updateStreamUrl(tempUrl);
    blynkService.logEvent('URL_CHANGE', `Stream URL updated to ${tempUrl}`);
  };

  const handleCaptureSnapshot = async () => {
    if (!isConnected) {
      Alert.alert('Error', 'Stream is not connected. Please connect first.');
      return;
    }

    try {
      setIsCaptureLoading(true);

      // Capture snapshot from ESP32-CAM - use base URL with /capture
      const baseUrl = streamUrl.replace(':81/stream', '');
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

      // Save to local storage
      console.log('💾 Saving to local storage...');
      await LocalFileStorageService.saveSnapshot(dataUrl, {
        deviceId: 'esp32-cam',
        quality: streamQuality,
        streamUrl: streamUrl,
      });

      // Save metadata to Firestore
      console.log('☁️ Saving metadata to Firestore...');
      await FirebaseService.saveEvidence({
        imageUrl: dataUrl,
        timestamp: Date.now(),
        deviceId: 'esp32-cam',
        quality: streamQuality,
        streamUrl: streamUrl,
      }).catch(err => console.warn('Firestore save warning:', err));

      // Log to Blynk
      blynkService.logEvent('SNAPSHOT_CAPTURED', 'Snapshot saved locally');
      blynkService.sendNotification('📸 Snapshot captured and saved!');

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
      
      blynkService.logEvent('SNAPSHOT_ERROR', `Failed to capture: ${error}`);
    } finally {
      setIsCaptureLoading(false);
    }
  };

  const handleQualityChange = (quality: 'SD' | 'HD' | 'FHD') => {
    setStreamQuality(quality);
    setShowQualityModal(false);
    blynkService.updateQuality(quality);
    blynkService.logEvent('QUALITY_CHANGE', `Quality changed to ${quality}`);
  };

  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            background-color: #f1f5f9;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            overflow: hidden;
          }
          #stream-container {
            width: 100%;
            height: 100%;
            display: flex;
            justify-content: center;
            align-items: center;
          }
          #videoStream {
            width: 100%;
            height: 100%;
            object-fit: contain;
          }
          .error-message {
            color: #ef4444;
            font-family: Arial, sans-serif;
            text-align: center;
            padding: 20px;
          }
          #mjpeg-stream {
            width: 100%;
            height: 100%;
            object-fit: contain;
            transform: rotate(-90deg);
          }
        </style>
      </head>
      <body>
        <div id="stream-container">
          <!-- ESP32-CAM stream -->
          <img id="mjpeg-stream" 
               src="${streamUrl}" 
               onerror="this.style.display='none'; document.getElementById('error').style.display='block';"
               style="display: block;"
          />
          <div id="error" class="error-message" style="display: none;">
            <h2>⚠️ Stream Unavailable</h2>
            <p>Unable to connect to the video stream.</p>
          </div>
        </div>
        <script>
          // Try different streaming methods
          const video = document.getElementById('videoStream');
          const mjpegStream = document.getElementById('mjpeg-stream');
          const errorDiv = document.getElementById('error');
          
          function tryFallbackStream() {
            // Try MJPEG stream
            mjpegStream.src = "${streamUrl}/mjpeg";
            mjpegStream.style.display = 'block';
            
            mjpegStream.onerror = function() {
              // If MJPEG fails, try snapshot mode
              mjpegStream.src = "${streamUrl}/snapshot";
              mjpegStream.style.display = 'block';
              
              // Refresh snapshot every second
              setInterval(() => {
                if (mjpegStream.style.display !== 'none') {
                  mjpegStream.src = "${streamUrl}/snapshot?t=" + new Date().getTime();
                }
              }, 1000);
              
              mjpegStream.onerror = function() {
                mjpegStream.style.display = 'none';
                errorDiv.style.display = 'block';
              }
            }
          }
          
          video.addEventListener('loadeddata', function() {
            video.style.display = 'block';
          });
          
          video.addEventListener('error', function() {
            video.style.display = 'none';
            mjpegStream.style.display = 'block';
          });
          
          // Start with video stream
          video.style.display = 'block';
        </script>
      </body>
    </html>
  `;

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
              placeholder="http://10.56.141.207:81/stream"
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
      <View style={styles.streamContainer}>
        {isLoading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#475569" />
            <Text style={styles.loadingText}>ACQUIRING SIGNAL...</Text>
            {retryCount > 0 && (
              <Text style={styles.retryText}>ATTEMPT 0{retryCount}</Text>
            )}
          </View>
        )}
        
        <WebView
          ref={webViewRef}
          source={{ html: htmlContent }}
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
