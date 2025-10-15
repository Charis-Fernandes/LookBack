import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
  SafeAreaView,
  Platform,
  StatusBar as RNStatusBar,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { StatusBar } from 'expo-status-bar';

const { width, height } = Dimensions.get('window');

export default function AdminDashboard() {
  // Configurable stream URL - change this to your server URL
  const [streamUrl, setStreamUrl] = useState('http://10.237.147.207');
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [retryCount, setRetryCount] = useState(0);
  const webViewRef = useRef<WebView>(null);

  // Auto-retry mechanism
  useEffect(() => {
    if (!isConnected && retryCount > 0 && retryCount < 5) {
      const timer = setTimeout(() => {
        handleReload();
      }, 5000); // Retry after 5 seconds

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

  // HTML content for WebView to display the stream
  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          body {
            background-color: #000;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            overflow: hidden;
          }
          img {
            width: 100%;
            height: 100%;
            object-fit: contain;
          }
          .error-message {
            color: #ff4444;
            font-family: Arial, sans-serif;
            text-align: center;
            padding: 20px;
          }
        </style>
      </head>
      <body>
        <img 
          id="stream" 
          src="${streamUrl}" 
          alt="Live Stream"
          onerror="this.style.display='none'; document.getElementById('error').style.display='block';"
          onload="this.style.display='block'; document.getElementById('error').style.display='none';"
        />
        <div id="error" class="error-message" style="display: none;">
          <h2>⚠️ Stream Unavailable</h2>
          <p>Unable to connect to the video stream.</p>
          <p style="margin-top: 10px; font-size: 12px;">URL: ${streamUrl}</p>
        </div>
      </body>
    </html>
  `;

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <View style={styles.titleContainer}>
              <View style={styles.logoCircle}>
                <Text style={styles.logoText}>👁️</Text>
              </View>
              <Text style={styles.headerTitle}>LookBack Admin Dashboard</Text>
            </View>
            
            {/* Connection Status */}
            <View style={[styles.statusBadge, isConnected ? styles.connected : styles.disconnected]}>
              <View style={[styles.statusDot, isConnected ? styles.dotConnected : styles.dotDisconnected]} />
              <Text style={styles.statusText}>
                {isConnected ? 'Connected' : 'Disconnected'}
              </Text>
            </View>
          </View>
        </View>

        {/* Stream Container */}
        <View style={styles.streamContainer}>
          <View style={styles.streamWrapper}>
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

          {/* Stream Info Card */}
          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>📡 Stream URL:</Text>
              <Text style={styles.infoValue} numberOfLines={1}>
                {streamUrl}
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>🔄 Status:</Text>
              <Text style={[styles.infoValue, { color: isConnected ? '#10b981' : '#ef4444' }]}>
                {isConnected ? 'Live' : 'Offline'}
              </Text>
            </View>
          </View>
        </View>

        {/* Control Panel */}
        <View style={styles.controlPanel}>
          <TouchableOpacity 
            style={styles.reloadButton}
            onPress={handleReload}
            activeOpacity={0.8}
          >
            <Text style={styles.reloadIcon}>🔄</Text>
            <Text style={styles.reloadText}>Reload Stream</Text>
          </TouchableOpacity>

          <View style={styles.statsContainer}>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{isConnected ? '✓' : '✗'}</Text>
              <Text style={styles.statLabel}>Connection</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{retryCount}</Text>
              <Text style={styles.statLabel}>Retries</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>🎥</Text>
              <Text style={styles.statLabel}>Live Feed</Text>
            </View>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0f172a',
    paddingTop: Platform.OS === 'android' ? RNStatusBar.currentHeight : 0,
  },
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  header: {
    backgroundColor: '#1e293b',
    paddingVertical: 20,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  logoCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#3b82f6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  logoText: {
    fontSize: 20,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#f1f5f9',
    flex: 1,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginLeft: 10,
  },
  connected: {
    backgroundColor: '#10b98120',
    borderWidth: 1,
    borderColor: '#10b981',
  },
  disconnected: {
    backgroundColor: '#ef444420',
    borderWidth: 1,
    borderColor: '#ef4444',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  dotConnected: {
    backgroundColor: '#10b981',
  },
  dotDisconnected: {
    backgroundColor: '#ef4444',
  },
  statusText: {
    color: '#f1f5f9',
    fontSize: 12,
    fontWeight: '600',
  },
  streamContainer: {
    flex: 1,
    padding: 16,
  },
  streamWrapper: {
    flex: 1,
    backgroundColor: '#000',
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
    marginBottom: 16,
  },
  webview: {
    flex: 1,
    backgroundColor: '#000',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#00000090',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  loadingText: {
    color: '#f1f5f9',
    marginTop: 12,
    fontSize: 14,
    fontWeight: '500',
  },
  retryText: {
    color: '#94a3b8',
    marginTop: 4,
    fontSize: 12,
  },
  infoCard: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  infoLabel: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: '500',
  },
  infoValue: {
    color: '#f1f5f9',
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
    textAlign: 'right',
    marginLeft: 8,
  },
  controlPanel: {
    padding: 16,
    backgroundColor: '#1e293b',
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  reloadButton: {
    backgroundColor: '#3b82f6',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  reloadIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  reloadText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statBox: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#3b82f6',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#94a3b8',
  },
});
