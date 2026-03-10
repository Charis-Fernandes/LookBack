import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, Modal, TextInput, ScrollView, Image, Platform } from 'react-native';
import { WebView } from 'react-native-webview';
import * as ImagePicker from 'expo-image-picker';
import LocalFileStorageService from '../services/LocalFileStorageService';
import FirebaseService from '../services/FirebaseService';
import AIService from '../services/AIService';
import BlynkService from '../services/BlynkService';
import { BLYNK_CONFIG } from '../config/blynk.config';

export default function DocumentScanner() {
  const [streamUrl, setStreamUrl] = useState('http://10.145.212.207:81/stream');
  const [tempUrl, setTempUrl] = useState('http://10.145.212.207:81/stream');
  const [showUrlModal, setShowUrlModal] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [scanCount, setScanCount] = useState<number>(0);
  const [isConnected, setIsConnected] = useState(false);
  const [aiServerOnline, setAiServerOnline] = useState(false);
  const [capturedImageUri, setCapturedImageUri] = useState<string | null>(null);
  const [inputMode, setInputMode] = useState<'esp32' | 'camera' | 'upload'>('esp32');
  const blynkService = new BlynkService(BLYNK_CONFIG.AUTH_TOKEN);

  useEffect(() => {
    loadScanCount();
    checkAIServer();
  }, []);

  const checkAIServer = async () => {
    const online = await AIService.healthCheck();
    setAiServerOnline(online);
    console.log(online ? '🤖 AI Server online' : '🤖 AI Server offline');
  };

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

      // Get base URL without /stream
      const baseUrl = streamUrl.replace(/\/stream$/, '').replace(/:81$/, '');
      const captureUrl = `${baseUrl}/capture`;

      console.log('📸 Capturing from:', captureUrl);

      const response = await fetch(captureUrl);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const blob = await response.blob();
      
      // Convert blob to data URL
      const reader = new FileReader();
      reader.readAsDataURL(blob);
      
      const dataUrl = await new Promise<string>((resolve, reject) => {
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
      });

      await processImageWithPipeline(dataUrl, 'esp32-cam-document');

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

  // ═══ TAKE PHOTO (Device Camera) ═══
  const handleTakePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Camera permission is needed to take photos.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        quality: 0.9,
        base64: true,
        allowsEditing: false,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) return;

      const asset = result.assets[0];
      setIsScanning(true);

      let dataUrl: string;
      if (asset.base64) {
        const mimeType = asset.mimeType || 'image/jpeg';
        dataUrl = `data:${mimeType};base64,${asset.base64}`;
      } else if (asset.uri) {
        // Fallback: fetch the URI and convert to base64
        const response = await fetch(asset.uri);
        const blob = await response.blob();
        const reader = new FileReader();
        reader.readAsDataURL(blob);
        dataUrl = await new Promise<string>((resolve, reject) => {
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
        });
      } else {
        throw new Error('No image data available');
      }

      setCapturedImageUri(asset.uri || null);
      await processImageWithPipeline(dataUrl, 'device-camera');

    } catch (error) {
      console.error('❌ Camera error:', error);
      Alert.alert(
        '❌ Error',
        `Failed to take photo: ${error instanceof Error ? error.message : 'Unknown error'}`,
        [{ text: 'OK' }]
      );
    } finally {
      setIsScanning(false);
    }
  };

  // ═══ UPLOAD IMAGE (Gallery / File Picker) ═══
  const handleUploadImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Gallery permission is needed to upload images.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.9,
        base64: true,
        allowsEditing: false,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) return;

      const asset = result.assets[0];
      setIsScanning(true);

      let dataUrl: string;
      if (asset.base64) {
        const mimeType = asset.mimeType || 'image/jpeg';
        dataUrl = `data:${mimeType};base64,${asset.base64}`;
      } else if (asset.uri) {
        const response = await fetch(asset.uri);
        const blob = await response.blob();
        const reader = new FileReader();
        reader.readAsDataURL(blob);
        dataUrl = await new Promise<string>((resolve, reject) => {
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
        });
      } else {
        throw new Error('No image data available');
      }

      setCapturedImageUri(asset.uri || null);
      await processImageWithPipeline(dataUrl, 'gallery-upload');

    } catch (error) {
      console.error('❌ Upload error:', error);
      Alert.alert(
        '❌ Error',
        `Failed to upload image: ${error instanceof Error ? error.message : 'Unknown error'}`,
        [{ text: 'OK' }]
      );
    } finally {
      setIsScanning(false);
    }
  };

  // ═══ COMMON PROCESSING PIPELINE ═══
  const processImageWithPipeline = async (dataUrl: string, deviceId: string) => {
    // ── Dedup check: hash the image and see if we already processed it ──
    const imageHash = FirebaseService.generateImageHash(dataUrl);
    const existing = await FirebaseService.isDuplicate(imageHash);
    if (existing) {
      console.log('🔁 Duplicate image detected — skipping re-processing');
      Alert.alert(
        '📄 Already Processed',
        `This document was already scanned as "${existing.docType}". Check Evidence Search for details.`,
        [{ text: 'OK' }]
      );
      return;
    }

    // Save to local storage
    console.log('💾 Saving document to Evidence Vault...');
    await LocalFileStorageService.saveSnapshot(dataUrl, {
      deviceId,
      quality: 'HD',
      streamUrl: streamUrl,
    });

    // Save base evidence to Firestore
    console.log('☁️ Saving evidence to Firestore...');
    const evidenceId = await FirebaseService.saveEvidence({
      imageUrl: dataUrl,
      timestamp: Date.now(),
      deviceId,
      quality: 'HD',
      streamUrl: streamUrl,
      tags: ['document', 'scan'],
    }).catch(err => {
      console.warn('Firestore save warning:', err);
      return '';
    });

    setScanCount(prev => prev + 1);
    Alert.alert('✅ Saved', 'Document captured and saved. AI is processing in the background.');

    // ═══ AI PIPELINE — runs entirely in background, no UI blocking ═══
    runAIPipelineInBackground(dataUrl, deviceId, evidenceId, imageHash);
  };

  const runAIPipelineInBackground = async (
    dataUrl: string,
    deviceId: string,
    evidenceId: string,
    imageHash: string
  ) => {
    try {
      console.log('🤖 [Background] Running AI pipeline...');
      const aiResult = await AIService.processDocument(dataUrl, true);

      if (aiResult && aiResult.processing_status === 'success') {
        console.log('🤖 [Background] AI Result:', aiResult.summary?.detected_document_type);

        const docType = aiResult.classification?.doc_type || 'UNKNOWN';
        const fields = aiResult.field_extraction?.extracted_data || {};

        // Update evidence with AI data
        if (evidenceId) {
          await FirebaseService.updateEvidence(evidenceId, {
            aiProcessed: true,
            docType,
            ocrConfidence: aiResult.summary?.ocr_confidence,
            detectedObjects: aiResult.summary?.detected_objects,
          }).catch(() => {});
        }

        // Save to the appropriate typed collection
        let typedDocId = '';

        if (docType === 'FIR') {
          typedDocId = await FirebaseService.saveFIR({
            evidenceId: evidenceId || '',
            firNo: fields.fir_no || 'N/A',
            date: fields.date || 'N/A',
            sections: fields.sections || [],
            sectionDescriptions: fields.section_descriptions || {},
            policeStation: fields.police_station || 'N/A',
            complainant: fields.complainant || 'N/A',
            accused: fields.accused || 'N/A',
            actsReferenced: fields.acts_referenced || [],
            ocrText: aiResult.ocr?.raw_text || '',
            ocrConfidence: aiResult.summary?.ocr_confidence || 0,
            classificationConfidence: aiResult.summary?.classification_confidence || 0,
            detectedObjects: aiResult.summary?.detected_objects || [],
            imageUrl: dataUrl,
            timestamp: Date.now(),
            deviceId,
          }).catch(err => { console.warn('Save FIR warning:', err); return ''; });
        } else if (docType === 'ID_CARD') {
          typedDocId = await FirebaseService.saveIDCard({
            evidenceId: evidenceId || '',
            cardType: 'Unknown',
            name: fields.complainant || '',
            ocrText: aiResult.ocr?.raw_text || '',
            ocrConfidence: aiResult.summary?.ocr_confidence || 0,
            classificationConfidence: aiResult.summary?.classification_confidence || 0,
            detectedObjects: aiResult.summary?.detected_objects || [],
            imageUrl: dataUrl,
            timestamp: Date.now(),
            deviceId,
          }).catch(err => { console.warn('Save ID Card warning:', err); return ''; });
        } else if (docType === 'POLICE_REPORT' || docType === 'CHARGE_SHEET') {
          typedDocId = await FirebaseService.savePoliceReport({
            evidenceId: evidenceId || '',
            reportType: docType,
            date: fields.date || '',
            sections: fields.sections || [],
            ocrText: aiResult.ocr?.raw_text || '',
            ocrConfidence: aiResult.summary?.ocr_confidence || 0,
            classificationConfidence: aiResult.summary?.classification_confidence || 0,
            detectedObjects: aiResult.summary?.detected_objects || [],
            imageUrl: dataUrl,
            timestamp: Date.now(),
            deviceId,
          }).catch(err => { console.warn('Save Police Report warning:', err); return ''; });
        }

        // Build search index + title
        const searchKeywords = FirebaseService.buildSearchKeywords(
          aiResult.ocr?.raw_text || '', fields, docType
        );
        const { title, subtitle } = FirebaseService.buildDocTitle(docType, fields, aiResult.ocr?.raw_text || '');
        const keyFields: Record<string, string> = {};
        for (const [k, v] of Object.entries(fields)) {
          if (typeof v === 'string' && v && v !== 'N/A') keyFields[k] = v;
          if (Array.isArray(v) && v.length > 0) keyFields[k] = v.join(', ');
        }

        // Save to the master processed_documents index
        await FirebaseService.saveProcessedDocument({
          evidenceId: evidenceId || '',
          docType,
          typedDocId,
          ocrText: aiResult.ocr?.raw_text || '',
          ocrConfidence: aiResult.summary?.ocr_confidence || 0,
          classificationConfidence: aiResult.summary?.classification_confidence || 0,
          extractionConfidence: aiResult.summary?.extraction_confidence || 0,
          fieldsExtracted: aiResult.summary?.fields_extracted || 0,
          detectedObjects: aiResult.summary?.detected_objects || [],
          textPreview: aiResult.summary?.text_preview || '',
          imageUrl: dataUrl,
          timestamp: Date.now(),
          processedAt: aiResult.processed_at || Date.now(),
          deviceId,
          imageHash,
          searchKeywords,
          title,
          subtitle,
          keyFields,
        }).catch(err => console.warn('Save processed doc warning:', err));

        // Log analytics
        FirebaseService.logAnalyticsEvent('document_processed', {
          docType,
          fieldsExtracted: aiResult.summary?.fields_extracted || 0,
          ocrConfidence: aiResult.summary?.ocr_confidence || 0,
        });

        console.log('🤖 [Background] Pipeline complete ✓');
      } else {
        console.warn('🤖 [Background] AI processing failed or unavailable');
      }
    } catch (error) {
      console.error('🤖 [Background] Pipeline error:', error);
    }

    blynkService.logEvent('DOCUMENT_SCANNED', 'Document scanned and processed');
    blynkService.sendNotification('📄 Document scanned & AI processed!');
    await loadScanCount();
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
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>

        {/* ═══ Input Mode Selector ═══ */}
        <View style={styles.modeSelector}>
          <TouchableOpacity
            style={[styles.modeTab, inputMode === 'esp32' && styles.modeTabActive]}
            onPress={() => { setInputMode('esp32'); setCapturedImageUri(null); }}
          >
            <Text style={[styles.modeTabText, inputMode === 'esp32' && styles.modeTabTextActive]}>
              📡 ESP32-CAM
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modeTab, inputMode === 'camera' && styles.modeTabActive]}
            onPress={() => { setInputMode('camera'); setCapturedImageUri(null); }}
          >
            <Text style={[styles.modeTabText, inputMode === 'camera' && styles.modeTabTextActive]}>
              📷 Camera
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modeTab, inputMode === 'upload' && styles.modeTabActive]}
            onPress={() => { setInputMode('upload'); setCapturedImageUri(null); }}
          >
            <Text style={[styles.modeTabText, inputMode === 'upload' && styles.modeTabTextActive]}>
              📁 Upload
            </Text>
          </TouchableOpacity>
        </View>

        {/* ═══ Preview Area ═══ */}
        {inputMode === 'esp32' ? (
          /* ESP32-CAM Stream Preview */
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
        ) : (
          /* Camera / Upload Image Preview */
          <View style={styles.cameraContainer}>
            {capturedImageUri ? (
              <Image source={{ uri: capturedImageUri }} style={styles.capturedImage} />
            ) : (
              <View style={styles.cameraPlaceholder}>
                <Text style={styles.cameraIcon}>{inputMode === 'camera' ? '📷' : '📁'}</Text>
                <Text style={styles.cameraText}>
                  {inputMode === 'camera'
                    ? 'Tap "Take Photo" to capture a document'
                    : 'Tap "Upload Image" to select from gallery'}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* AI Server Status + Instructions */}
        <View style={styles.instructionsCard}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <Text style={styles.instructionsTitle}>📋 Document Scanning</Text>
            <View style={[styles.aiBadge, aiServerOnline ? styles.aiOnline : styles.aiOffline]}>
              <Text style={styles.aiBadgeText}>
                {aiServerOnline ? '🤖 AI Online' : '🤖 AI Offline'}
              </Text>
            </View>
          </View>
          <Text style={styles.instructionText}>
            {inputMode === 'esp32'
              ? '1. Position document in front of ESP32-CAM\n2. Align within the blue frame\n3. Tap "Scan Document" to capture & process\n4. AI will classify, extract fields & detect objects'
              : inputMode === 'camera'
              ? '1. Tap "Take Photo" to open device camera\n2. Capture a clear photo of the document\n3. AI processes automatically in the background'
              : '1. Tap "Upload Image" to open gallery\n2. Select a document image\n3. AI processes automatically in the background'}
          </Text>
        </View>

        {/* ═══ Action Buttons ═══ */}
        <View style={styles.actionContainer}>
          {inputMode === 'esp32' && (
            <TouchableOpacity 
              style={[styles.scanButton, isScanning && styles.scanButtonDisabled]}
              onPress={handleScanDocument}
              disabled={isScanning || !isConnected}
            >
              {isScanning ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <>
                  <Text style={styles.scanButtonIcon}>📄</Text>
                  <Text style={styles.scanButtonText}>Scan Document</Text>
                </>
              )}
            </TouchableOpacity>
          )}

          {inputMode === 'camera' && (
            <TouchableOpacity 
              style={[styles.scanButton, styles.cameraButton, isScanning && styles.scanButtonDisabled]}
              onPress={handleTakePhoto}
              disabled={isScanning}
            >
              {isScanning ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <>
                  <Text style={styles.scanButtonIcon}>📷</Text>
                  <Text style={styles.scanButtonText}>Take Photo</Text>
                </>
              )}
            </TouchableOpacity>
          )}

          {inputMode === 'upload' && (
            <TouchableOpacity 
              style={[styles.scanButton, styles.uploadButton, isScanning && styles.scanButtonDisabled]}
              onPress={handleUploadImage}
              disabled={isScanning}
            >
              {isScanning ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <>
                  <Text style={styles.scanButtonIcon}>📁</Text>
                  <Text style={styles.scanButtonText}>Upload Image</Text>
                </>
              )}
            </TouchableOpacity>
          )}

          {/* Secondary buttons only for ESP32 mode */}
          {inputMode === 'esp32' && (
            <View style={styles.secondaryButtons}>
              <TouchableOpacity 
                style={styles.secondaryButton}
                onPress={() => setShowUrlModal(true)}
              >
                <Text style={styles.secondaryButtonText}>🔧 Change URL</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.secondaryButton}
                onPress={() => {
                  checkAIServer();
                  setIsConnected(false);
                  setStreamUrl(streamUrl + '?t=' + Date.now());
                }}
              >
                <Text style={styles.secondaryButtonText}>🔄 Reconnect</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{scanCount}</Text>
            <Text style={styles.statLabel}>Total Scans</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{aiServerOnline ? '🟢' : '🔴'}</Text>
            <Text style={styles.statLabel}>AI Server</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{inputMode === 'esp32' ? (isConnected ? '🟢' : '🔴') : '📱'}</Text>
            <Text style={styles.statLabel}>{inputMode === 'esp32' ? 'ESP32' : 'Device'}</Text>
          </View>
        </View>
      </ScrollView>

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
  // ═══ AI Pipeline Styles ═══
  aiBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  aiOnline: {
    backgroundColor: '#d1fae5',
  },
  aiOffline: {
    backgroundColor: '#fee2e2',
  },
  aiBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  aiProcessingCard: {
    backgroundColor: '#f5f3ff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd6fe',
  },
  aiProcessingText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#7c3aed',
    marginTop: 12,
  },
  aiProcessingSubtext: {
    fontSize: 12,
    color: '#8b5cf6',
    marginTop: 4,
  },
  resultRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  resultLabel: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '600',
  },
  resultValue: {
    fontSize: 14,
    color: '#1e293b',
    fontWeight: '700',
    maxWidth: '60%',
    textAlign: 'right',
  },
  docTypeBadge: {
    backgroundColor: '#dbeafe',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
  },
  docTypeBadgeText: {
    fontSize: 13,
    color: '#2563eb',
    fontWeight: '700',
  },
  textPreview: {
    fontSize: 12,
    color: '#475569',
    marginTop: 6,
    padding: 10,
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    lineHeight: 18,
  },
  // ═══ Input Mode Selector Styles ═══
  modeSelector: {
    flexDirection: 'row',
    backgroundColor: '#e2e8f0',
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
  },
  modeTab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  modeTabActive: {
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  modeTabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
  },
  modeTabTextActive: {
    color: '#3b82f6',
    fontWeight: '700',
  },
  // ═══ Camera & Upload Button Styles ═══
  cameraButton: {
    backgroundColor: '#10b981',
    shadowColor: '#10b981',
  },
  uploadButton: {
    backgroundColor: '#8b5cf6',
    shadowColor: '#8b5cf6',
  },
});
