import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { WebView } from 'react-native-webview';

export default function LiveStream() {
  const [streamUrl, setStreamUrl] = useState('http://10.237.147.207:81/stream');
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [retryCount, setRetryCount] = useState(0);
  const webViewRef = useRef<WebView>(null);

  useEffect(() => {
    if (!isConnected && retryCount > 0 && retryCount < 5) {
      const timer = setTimeout(() => {
        handleReload();
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [isConnected, retryCount]);

  const handleReload = () => {
    setIsLoading(true);
    setRetryCount(prev => prev + 1);
    if (webViewRef.current) {
      webViewRef.current.reload();
    }
  };

  const handleLoadStart = () => {
    setIsLoading(true);
  };

  const handleLoadEnd = () => {
    setIsLoading(false);
    setIsConnected(true);
    setRetryCount(0);
  };

  const handleError = () => {
    setIsLoading(false);
    setIsConnected(false);
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
        <Text numberOfLines={1} ellipsizeMode="middle" style={styles.urlText}>{streamUrl}</Text>
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
