import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Modal,
} from 'react-native';
import { WebView } from 'react-native-webview';
import BlynkService from '../services/BlynkService';
import { BLYNK_CONFIG } from '../config/blynk.config';

export default function LiveStream() {
  const [streamUrl, setStreamUrl] = useState('http://10.56.141.207:81/stream');
  const [tempUrl, setTempUrl] = useState('http://10.56.141.207:81/stream');
  const [showUrlModal, setShowUrlModal] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [retryCount, setRetryCount] = useState(0);
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
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowUrlModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Configure Stream URL</Text>
            <Text style={styles.modalSubtitle}>
              Enter the IP address of your ESP32-CAM or streaming device
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
              <Text style={styles.hintText}>💡 Make sure your device is on the same network</Text>
            </View>
            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={[styles.modalButton, styles.cancelButton]} 
                onPress={() => {
                  setTempUrl(streamUrl);
                  setShowUrlModal(false);
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalButton, styles.saveButton]} 
                onPress={handleUrlChange}
              >
                <Text style={styles.saveButtonText}>Connect</Text>
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
              {isConnected ? 'Connected' : 'Disconnected'}
            </Text>
          </View>
        </View>
        <TouchableOpacity onPress={() => setShowUrlModal(true)}>
          <Text numberOfLines={1} ellipsizeMode="middle" style={styles.urlTextEditable}>
            {streamUrl} ✏️
          </Text>
        </TouchableOpacity>
        <View style={styles.buttonGroup}>
          <TouchableOpacity style={[styles.button, styles.stopButton]} onPress={() => {
            setIsConnected(false);
            if (webViewRef.current) {
              webViewRef.current.injectJavaScript(`
                document.getElementById('mjpeg-stream').style.display = 'none';
                document.getElementById('error').style.display = 'block';
              `);
            }
          }}>
            <Text style={styles.buttonText}>⏹️ Stop</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.button, styles.reconnectButton]} onPress={handleReload}>
            <Text style={styles.buttonText}>🔄 Reconnect</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Stream Container */}
      <View style={styles.streamContainer}>
        {isLoading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#3b82f6" />
            <Text style={styles.loadingText}>Connecting to stream...</Text>
            {retryCount > 0 && (
              <Text style={styles.retryText}>Attempt {retryCount}</Text>
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
      </View>

      {/* Info Cards */}
      <View style={styles.infoRow}>
        <View style={styles.infoCard}>
          <Text style={styles.infoLabel}>Status</Text>
          <Text style={[styles.infoValue, { color: isConnected ? '#10b981' : '#ef4444' }]}>
            {isConnected ? 'Live' : 'Offline'}
          </Text>
        </View>
        <View style={styles.infoCard}>
          <Text style={styles.infoLabel}>Retries</Text>
          <Text style={styles.infoValue}>{retryCount}</Text>
        </View>
        <View style={styles.infoCard}>
          <Text style={styles.infoLabel}>Quality</Text>
          <Text style={styles.infoValue}>HD</Text>
        </View>
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
  statusBar: {
    flexDirection: 'column',
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    gap: 12,
  },
  statusItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  connected: {
    backgroundColor: '#10b981',
  },
  disconnected: {
    backgroundColor: '#ef4444',
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e293b',
  },
  urlText: {
    fontSize: 13,
    color: '#64748b',
    width: '100%',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#f1f5f9',
    borderRadius: 6,
    overflow: 'hidden',
  },
  urlTextEditable: {
    fontSize: 13,
    color: '#3b82f6',
    width: '100%',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#f1f5f9',
    borderRadius: 6,
    overflow: 'hidden',
    fontWeight: '600',
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
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 20,
    lineHeight: 20,
  },
  urlInput: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    padding: 14,
    fontSize: 14,
    color: '#1e293b',
    marginBottom: 12,
  },
  modalHint: {
    backgroundColor: '#dbeafe',
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
  },
  hintText: {
    fontSize: 13,
    color: '#1e40af',
    lineHeight: 18,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  cancelButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#475569',
  },
  saveButton: {
    backgroundColor: '#3b82f6',
  },
  saveButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#ffffff',
  },
  buttonGroup: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    width: '100%',
  },
  button: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    minWidth: 120,
    alignItems: 'center',
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  reconnectButton: {
    backgroundColor: '#3b82f6',
  },
  stopButton: {
    backgroundColor: '#ef4444',
  },
  streamContainer: {
    flex: 1,
    backgroundColor: '#e2e8f0',
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  webview: {
    flex: 1,
    backgroundColor: '#f1f5f9',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#f8fafcdd',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  loadingText: {
    color: '#1e293b',
    marginTop: 12,
    fontSize: 14,
    fontWeight: '500',
  },
  retryText: {
    color: '#64748b',
    marginTop: 4,
    fontSize: 12,
  },
  infoRow: {
    flexDirection: 'row',
    gap: 12,
  },
  infoCard: {
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
  infoLabel: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1e293b',
  },
});
