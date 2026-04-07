import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, Modal, TextInput, ScrollView, Image, Platform } from 'react-native';
import { WebView } from 'react-native-webview';
import * as ImagePicker from 'expo-image-picker';
import LocalFileStorageService from '../services/LocalFileStorageService';
import FirebaseService from '../services/FirebaseService';
import AIService from '../services/AIService';
import BlynkService from '../services/BlynkService';
import { BLYNK_CONFIG } from '../config/blynk.config';
import { createEvidenceOnChain, hashDataUrl } from '../services/BlockchainService';

export default function DocumentScanner() {
  const [streamUrl, setStreamUrl] = useState('http://10.145.212.207:81/stream');
  const [tempUrl, setTempUrl] = useState('http://10.145.212.207:81/stream');
  const [showUrlModal, setShowUrlModal] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [scanCount, setScanCount] = useState<number>(0);
  const [isConnected, setIsConnected] = useState(false);
  const [aiServerOnline, setAiServerOnline] = useState(false);
  const [capturedImageUri, setCapturedImageUri] = useState<string | null>(null);
  const [caseId, setCaseId] = useState('');
  const [uploadedBy, setUploadedBy] = useState('Local Operator');
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

    const fileHash = hashDataUrl(dataUrl);

    // Save to local storage and retain the snapshot ID
    console.log('💾 Saving document to Evidence Vault...');
    const snapshotId = await LocalFileStorageService.saveSnapshot(dataUrl, {
      deviceId,
      quality: 'HD',
      streamUrl: streamUrl,
    });

    // Save evidence metadata to Firestore with a stable id
    console.log('☁️ Saving evidence metadata to Firestore...');
    const sourceLocation = inputMode === 'esp32'
      ? 'ESP32-CAM'
      : inputMode === 'camera'
        ? 'Device Camera'
        : 'Local Upload';

    const evidenceId = await FirebaseService.saveEvidence({
      imageUrl: `snapshot://${snapshotId}`,
      timestamp: Date.now(),
      deviceId,
      quality: 'HD',
      streamUrl: streamUrl,
      category: 'document',
      tags: ['document', 'scan'],
      caseId: caseId || 'UNASSIGNED',
      uploadedBy: uploadedBy || 'Local Operator',
      location: sourceLocation,
      fileHash,
      blockchainStored: false,
      blockchainEvidenceId: snapshotId,
    }, snapshotId).catch(err => {
      console.warn('Firestore save warning:', err);
      return '';
    });

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
    } else {
      console.warn('⚠️ Evidence ID not available, blockchain storage skipped');
    }

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
              [ESP32 LINK]
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modeTab, inputMode === 'camera' && styles.modeTabActive]}
            onPress={() => { setInputMode('camera'); setCapturedImageUri(null); }}
          >
            <Text style={[styles.modeTabText, inputMode === 'camera' && styles.modeTabTextActive]}>
              [DEVICE CAM]
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modeTab, inputMode === 'upload' && styles.modeTabActive]}
            onPress={() => { setInputMode('upload'); setCapturedImageUri(null); }}
          >
            <Text style={[styles.modeTabText, inputMode === 'upload' && styles.modeTabTextActive]}>
              [LOCAL FILES]
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
                  <ActivityIndicator size="large" color="#475569" />
                  <Text style={styles.loadingText}>AWAITING DATA STREAM...</Text>
                </View>
              )}
            />
            {/* Connection Status */}
            <View style={[styles.statusBadge, isConnected ? styles.statusConnected : styles.statusDisconnected]}>
              <Text style={styles.statusText}>
                {isConnected ? 'NODE CONNECTED' : 'SIGNAL LOST'}
              </Text>
            </View>
            {/* Scan Frame */}
            <View style={styles.scanFrame} />
            
            {/* Tactical Crosshair */}
            <View style={styles.crosshairContainer} pointerEvents="none">
              <View style={styles.crosshairCenter} />
              <View style={styles.crosshairTop} />
              <View style={styles.crosshairBottom} />
              <View style={styles.crosshairLeft} />
              <View style={styles.crosshairRight} />
            </View>
          </View>
        ) : (
          /* Camera / Upload Image Preview */
          <View style={styles.cameraContainer}>
            {capturedImageUri ? (
              <Image source={{ uri: capturedImageUri }} style={styles.capturedImage} />
            ) : (
              <View style={styles.cameraPlaceholder}>
                <Text style={styles.cameraIcon}>{'>_'}</Text>
                <Text style={styles.cameraText}>
                  {inputMode === 'camera'
                    ? 'AWAITING LOCAL CAPTURE'
                    : 'AWAITING FILE SELECTION'}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* AI Server Status + Instructions */}
        <View style={styles.instructionsCard}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <Text style={styles.instructionsTitle}>INGESTION PROTOCOL</Text>
            <View style={[styles.aiBadge, aiServerOnline ? styles.aiOnline : styles.aiOffline]}>
              <Text style={styles.aiBadgeText}>
                {aiServerOnline ? 'AI PIPELINE: ONLINE' : 'AI PIPELINE: OFFLINE'}
              </Text>
            </View>
          </View>
          <Text style={styles.instructionText}>
            {inputMode === 'esp32'
              ? '1. ALIGN DOCUMENT WITHIN BOUNDARIES\n2. INITIATE HARDWARE CAPTURE COMMAND\n3. VERIFY CLASSIFICATION STATUS'
              : inputMode === 'camera'
              ? '1. UTILIZE ONBOARD SENSOR\n2. VERIFY LIGHTING CONDITIONS\n3. EXPORT TO LOG'
              : '1. ACCESS SECURE PARTITION\n2. SELECT TARGET DOCUMENT\n3. INITIATE AI PARSING'}
          </Text>
        </View>

        <View style={styles.metadataCard}>
          <Text style={styles.metaLabel}>CASE ID</Text>
          <TextInput
            style={styles.metaInput}
            value={caseId}
            onChangeText={setCaseId}
            placeholder="Case #2024-0001"
            placeholderTextColor="#94a3b8"
            autoCapitalize="characters"
          />
          <Text style={styles.metaLabel}>UPLOADED BY</Text>
          <TextInput
            style={styles.metaInput}
            value={uploadedBy}
            onChangeText={setUploadedBy}
            placeholder="Operator name"
            placeholderTextColor="#94a3b8"
          />
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
                  <Text style={styles.scanButtonText}>[ EXECUTE HARDWARE SCAN ]</Text>
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
                  <Text style={styles.scanButtonText}>[ ENGAGE DEVICE CAMERA ]</Text>
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
                <ActivityIndicator color="#f8fafc" />
              ) : (
                <>
                  <Text style={styles.scanButtonText}>[ UPLOAD FROM LOCAL FS ]</Text>
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
                <Text style={styles.secondaryButtonText}>EDIT ENDPOINT</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.secondaryButton}
                onPress={() => {
                  checkAIServer();
                  setIsConnected(false);
                  setStreamUrl(streamUrl + '?t=' + Date.now());
                }}
              >
                <Text style={styles.secondaryButtonText}>FORCE RECONNECT</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{scanCount}</Text>
            <Text style={styles.statLabel}>PROCESSED DOCS</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={[styles.statValue, { color: aiServerOnline ? '#10b981' : '#b91c1c' }]}>{aiServerOnline ? 'ACTIVE' : 'DOWN'}</Text>
            <Text style={styles.statLabel}>PIPELINE STATUS</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={[styles.statValue, { color: inputMode === 'esp32' ? (isConnected ? '#10b981' : '#b91c1c') : '#3b82f6' }]}>
              {inputMode === 'esp32' ? (isConnected ? 'SYNCED' : 'AWAITING') : 'READY'}
            </Text>
            <Text style={styles.statLabel}>INPUT HANDLER</Text>
          </View>
        </View>
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* URL Configuration Modal */}
      <Modal
        visible={showUrlModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowUrlModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>CONFIGURE UPLINK NODE</Text>
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
                <Text style={styles.modalCancelText}>ABORT</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalSaveButton}
                onPress={handleChangeUrl}
              >
                <Text style={styles.modalSaveText}>INITIALIZE</Text>
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
    backgroundColor: '#f1f5f9',
    padding: 18,
  },
  content: {
    flex: 1,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 11,
    color: '#f8fafc',
    fontWeight: '800',
    letterSpacing: 2,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
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
    color: '#0f172a',
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
    backgroundColor: '#0f172a',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 4,
  },
  permissionButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
  },
  cameraContainer: {
    position: 'relative',
    backgroundColor: '#000000',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 20,
    borderWidth: 2,
    borderColor: '#1e293b',
  },
  camera: {
    height: 400,
    backgroundColor: '#000000',
  },
  capturedImage: {
    height: 400,
    resizeMode: 'contain',
    backgroundColor: '#000000',
  },
  cameraPlaceholder: {
    backgroundColor: '#cbd5e1',
    height: 400,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraIcon: {
    fontSize: 40,
    marginBottom: 12,
    color: '#475569',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontWeight: '800',
  },
  cameraText: {
    fontSize: 11,
    color: '#475569',
    fontWeight: '800',
    letterSpacing: 1,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  scanFrame: {
    position: 'absolute',
    top: 60,
    left: 40,
    right: 40,
    height: 280,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.4)',
    borderRadius: 4,
    borderStyle: 'dashed',
  },
  crosshairContainer: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
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
  instructionsCard: {
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 4,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  instructionsTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: 1,
  },
  instructionText: {
    fontSize: 10,
    color: '#475569',
    lineHeight: 20,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontWeight: '700',
  },
  actionContainer: {
    marginBottom: 20,
  },
  scanButton: {
    backgroundColor: '#0f172a',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
    borderRadius: 4,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#000000',
  },
  scanButtonDisabled: {
    backgroundColor: '#94a3b8',
    borderColor: '#64748b',
  },
  scanButtonIcon: {
    fontSize: 20,
    marginRight: 10,
  },
  scanButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.5,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  secondaryButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: '#f1f5f9',
    padding: 14,
    borderRadius: 4,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  secondaryButtonText: {
    fontSize: 10,
    color: '#475569',
    fontWeight: '800',
    letterSpacing: 1,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  statBox: {
    flex: 1,
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 4,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  statValue: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 6,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  statLabel: {
    fontSize: 9,
    color: '#64748b',
    textAlign: 'center',
    fontWeight: '800',
    letterSpacing: 1,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusBadge: {
    position: 'absolute',
    top: 16,
    right: 16,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
    borderWidth: 1,
  },
  statusConnected: {
    backgroundColor: '#d1fae5',
    borderColor: '#059669',
  },
  statusDisconnected: {
    backgroundColor: '#fee2e2',
    borderColor: '#b91c1c',
  },
  statusText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1,
    color: '#0f172a',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
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
    borderColor: '#cbd5e1',
  },
  modalTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 16,
    textAlign: 'center',
    letterSpacing: 1,
  },
  modalInput: {
    backgroundColor: '#f8fafc',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    padding: 14,
    fontSize: 12,
    color: '#0f172a',
    marginBottom: 20,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontWeight: '600',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalCancelButton: {
    flex: 1,
    backgroundColor: '#f1f5f9',
    padding: 14,
    borderRadius: 4,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  modalCancelText: {
    fontSize: 10,
    color: '#475569',
    fontWeight: '800',
    letterSpacing: 1,
  },
  modalSaveButton: {
    flex: 1,
    backgroundColor: '#0f172a',
    padding: 14,
    borderRadius: 4,
    alignItems: 'center',
  },
  modalSaveText: {
    fontSize: 10,
    color: '#ffffff',
    fontWeight: '800',
    letterSpacing: 1,
  },
  aiBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 2,
    borderWidth: 1,
  },
  aiOnline: {
    backgroundColor: '#f8fafc',
    borderColor: '#10b981',
  },
  aiOffline: {
    backgroundColor: '#f8fafc',
    borderColor: '#ef4444',
  },
  aiBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1,
    color: '#0f172a',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  modeSelector: {
    flexDirection: 'row',
    backgroundColor: '#e2e8f0',
    borderRadius: 4,
    padding: 4,
    marginBottom: 16,
  },
  modeTab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 2,
    alignItems: 'center',
  },
  modeTabActive: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  modeTabText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748b',
    letterSpacing: 0.5,
  },
  modeTabTextActive: {
    color: '#0f172a',
  },
  metadataCard: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    padding: 14,
    marginBottom: 20,
  },
  metaLabel: {
    fontSize: 10,
    color: '#475569',
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 6,
  },
  metaInput: {
    backgroundColor: '#f8fafc',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
    fontSize: 12,
    color: '#0f172a',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontWeight: '600',
  },
  cameraButton: {
    backgroundColor: '#1e293b',
    borderColor: '#0f172a',
  },
  uploadButton: {
    backgroundColor: '#334155',
    borderColor: '#1e293b',
  },
});
