import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
  Alert,
  Modal,
} from 'react-native';
import FirebaseService, { EvidenceItem } from '../services/FirebaseService';
import LocalFileStorageService from '../services/LocalFileStorageService';
import { verifyEvidenceRecord, blockchainContractConfig } from '../services/BlockchainService';

const { width, height } = Dimensions.get('window');
const CARD_WIDTH = (width - 48) / 2; // 2 columns with padding

const isLiveStreamEvidence = (item: Partial<EvidenceItem> & { deviceId?: string }) =>
  item.category === 'snapshot' || item.deviceId === 'esp32-cam';

export default function EvidenceVault() {
  const [snapshots, setSnapshots] = useState<EvidenceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedSnapshot, setSelectedSnapshot] = useState<EvidenceItem | null>(null);
  const [verificationStatus, setVerificationStatus] = useState<Record<string, string>>({});
  const [verifying, setVerifying] = useState<Record<string, boolean>>({});
  const [proofRecords, setProofRecords] = useState<Record<string, { blockchainRecord: any; freshFileHash: string }>>({});

  useEffect(() => {
    loadSnapshots();
  }, []);

  const loadSnapshots = async () => {
    try {
      setLoading(true);
      const [firestoreData, localData] = await Promise.all([
        FirebaseService.listEvidence(),
        LocalFileStorageService.listSnapshots(),
      ]);

      const localMap = new Map(localData.map(item => [item.id, item]));
      const mergedDataRaw: EvidenceItem[] = firestoreData.map(item => {
        const localItem = item.id ? localMap.get(item.id) : undefined;
        const imageUrl = item.imageUrl && item.imageUrl.startsWith('snapshot://')
          ? localItem?.uri || item.imageUrl
          : item.imageUrl || localItem?.uri || '';

        return {
          ...item,
          imageUrl,
          deviceId: item.deviceId || localItem?.deviceId || 'unknown',
          quality: item.quality || localItem?.quality || 'unknown',
          streamUrl: item.streamUrl || localItem?.streamUrl || '',
          caseId: item.caseId || localItem?.caseId,
        };
      });

      const mergedData = mergedDataRaw.filter(isLiveStreamEvidence);
      const mergedIds = new Set(mergedDataRaw.map(item => item.id).filter(Boolean));

      const localOnly = localData
        .filter(localItem => !mergedIds.has(localItem.id) && localItem.deviceId === 'esp32-cam')
        .map(localItem => ({
          id: localItem.id,
          imageUrl: localItem.uri,
          timestamp: localItem.timestamp,
          deviceId: localItem.deviceId,
          quality: localItem.quality,
          streamUrl: localItem.streamUrl,
          caseId: localItem.caseId,
          category: 'snapshot',
        }));

      const data = [...mergedData, ...localOnly].sort((a, b) => b.timestamp - a.timestamp);
      setSnapshots(data);
      console.log(`📁 Loaded ${data.length} live stream evidence items`);
    } catch (error) {
      console.error('Load evidence error:', error);
      // Fallback to local storage on Firestore error
      try {
        const localData = await LocalFileStorageService.listSnapshots();
        const mapped = localData.map(s => ({
          id: s.id,
          imageUrl: s.uri,
          timestamp: s.timestamp,
          deviceId: s.deviceId,
          quality: s.quality,
          streamUrl: s.streamUrl,
          caseId: s.caseId,
          category: 'snapshot',
        })).filter(item => item.deviceId === 'esp32-cam');
        setSnapshots(mapped);
      } catch (localError) {
        Alert.alert('Error', 'Failed to load evidence');
      }
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadSnapshots();
    setRefreshing(false);
  };

  // ── BLOCKCHAIN VERIFICATION ──
  const handleVerify = async (snapshot: EvidenceItem) => {
    const evidenceId = snapshot.blockchainEvidenceId || snapshot.id || '';
    const storedHash = snapshot.fileHash || null;
    const imageUrl = snapshot.imageUrl;

    if (!evidenceId) {
      Alert.alert('Error', 'No evidence ID available for verification');
      return;
    }

    if (!imageUrl) {
      Alert.alert('Error', 'No image available for verification');
      return;
    }

    setVerifying((prev) => ({ ...prev, [evidenceId]: true }));
    try {
      console.log('🔍 Verifying evidence integrity:', evidenceId);
      const {
        blockchainRecord,
        freshFileHash,
        blockchainMatchesFreshHash,
        blockchainMatchesFirebaseHash,
        firebaseMatchesFreshHash,
      } = await verifyEvidenceRecord(evidenceId, storedHash, imageUrl);
      
      setVerificationStatus((prev) => ({
        ...prev,
        [evidenceId]: blockchainMatchesFreshHash
          ? `✅ Verified – image hash matches blockchain (${freshFileHash.slice(0, 12)}...)`
          : storedHash && firebaseMatchesFreshHash
            ? `⚠️ Warning – blockchain hash differs from Firebase hash (${blockchainRecord.evidenceHash.slice(0, 12)}...)`
            : storedHash && blockchainMatchesFirebaseHash
              ? `⚠️ Warning – Firebase hash differs from current image (${freshFileHash.slice(0, 12)}...)`
              : storedHash
                ? `❌ MISMATCH – blockchain, Firebase, and image hashes differ`
                : `❌ MISMATCH – on-chain hash does not match current image`,
      }));
      setProofRecords((prev) => ({
        ...prev,
        [evidenceId]: { blockchainRecord, freshFileHash },
      }));
      
      console.log('✅ Verification result:', {
        freshFileHash,
        blockchainMatchesFreshHash,
        blockchainMatchesFirebaseHash,
        firebaseMatchesFreshHash,
      });
    } catch (err) {
      console.error('❌ Verification error:', err);
      setVerificationStatus((prev) => ({
        ...prev,
        [evidenceId]: "⚠️ Could not verify – " + (err instanceof Error ? err.message : 'Unknown error'),
      }));
    } finally {
      setVerifying((prev) => ({ ...prev, [evidenceId]: false }));
    }
  };

  const handleDelete = async (snapshot: EvidenceItem) => {
    Alert.alert(
      'Delete Evidence',
      'Are you sure you want to delete this evidence?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              if (snapshot.id) {
                await FirebaseService.deleteEvidence(snapshot.id);
              }
              // Also try removing from local storage
              await LocalFileStorageService.deleteSnapshot(snapshot.id || '').catch(() => {});
              await loadSnapshots();
              Alert.alert('Success', 'Evidence deleted');
            } catch (error) {
              Alert.alert('Error', 'Failed to delete evidence');
            }
          },
        },
      ]
    );
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text style={styles.loadingText}>Loading evidence...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Live Stream Vault</Text>
        <Text style={styles.subtitle}>{snapshots.length} live captures stored</Text>
      </View>

      <FlatList
        data={snapshots}
        numColumns={2}
        keyExtractor={(item) => item.id || String(item.timestamp)}
        renderItem={({ item }) => {
          const evidenceKey = item.blockchainEvidenceId || item.id || '';
          const status = evidenceKey ? verificationStatus[evidenceKey] : undefined;

          return (
            <TouchableOpacity
              style={styles.imageCard}
              onPress={() => setSelectedSnapshot(item)}
              onLongPress={() => handleDelete(item)}
            >
              <Image source={{ uri: item.imageUrl }} style={styles.image} />
              <View style={styles.cardInfo}>
                <View>
                  <Text style={styles.cardDate}>{formatDate(item.timestamp)}</Text>
                  {item.blockchainStored && (
                    <Text style={styles.cardChainStatus}>On-chain</Text>
                  )}
                  {!!status && (
                    <Text
                      style={[
                        styles.cardVerifyStatus,
                        status.includes('✅') && styles.statusValid,
                        status.includes('❌') && styles.statusInvalid,
                        status.includes('⚠️') && styles.statusWarning,
                      ]}
                    >
                      {status.includes('✅')
                        ? 'Verified'
                        : status.includes('❌')
                          ? 'Mismatch'
                          : 'Warning'}
                    </Text>
                  )}
                </View>
                <Text style={styles.cardQuality}>{item.quality}</Text>
              </View>
            </TouchableOpacity>
          );
        }}
        contentContainerStyle={styles.grid}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>📸</Text>
            <Text style={styles.emptyText}>No snapshots yet</Text>
            <Text style={styles.emptySubtext}>
              Capture from Live Stream to see them here
            </Text>
          </View>
        }
      />

      {/* Full-screen image modal */}
      <Modal
        visible={selectedSnapshot !== null}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setSelectedSnapshot(null)}
      >
        <View style={styles.modalContainer}>
          <TouchableOpacity
            style={styles.modalBackground}
            activeOpacity={1}
            onPress={() => setSelectedSnapshot(null)}
          >
            <View style={styles.modalContent}>
              {selectedSnapshot && (
                <>
                  <Image
                    source={{ uri: selectedSnapshot.imageUrl }}
                    style={styles.fullscreenImage}
                    resizeMode="contain"
                  />
                  <View style={styles.modalInfo}>
                    <Text style={styles.modalDate}>
                      {formatDate(selectedSnapshot.timestamp)}
                    </Text>
                    <Text style={styles.modalQuality}>{selectedSnapshot.quality}</Text>
                    <Text style={styles.modalDevice}>{selectedSnapshot.deviceId}</Text>
                    
                    {/* Blockchain Information */}
                    {selectedSnapshot.caseId && (
                      <Text style={styles.modalDetail}>Case ID: {selectedSnapshot.caseId}</Text>
                    )}
                    {selectedSnapshot.uploadedBy && (
                      <Text style={styles.modalDetail}>Uploaded by: {selectedSnapshot.uploadedBy}</Text>
                    )}
                    {selectedSnapshot.location && (
                      <Text style={styles.modalDetail}>Source: {selectedSnapshot.location}</Text>
                    )}
                    {selectedSnapshot.fileHash && (
                      <View style={styles.blockchainInfo}>
                        <Text style={styles.blockchainLabel}>🔐 Blockchain Status:</Text>
                        <Text style={styles.blockchainValue}>
                          {selectedSnapshot.blockchainStored ? '✅ Secured' : '⚠️ Not stored'}
                        </Text>
                        <Text style={styles.txHash}>
                          Evidence ID: {(selectedSnapshot.blockchainEvidenceId || selectedSnapshot.id || 'N/A').slice(0, 20)}
                        </Text>
                        <Text style={styles.txHash}>Contract: {blockchainContractConfig.address}</Text>
                        {selectedSnapshot.blockchainTxHash && (
                          <Text style={styles.txHash}>
                            TX: {selectedSnapshot.blockchainTxHash.slice(0, 20)}...
                          </Text>
                        )}
                      </View>
                    )}
                    {proofRecords[(selectedSnapshot.blockchainEvidenceId || selectedSnapshot.id || '')] && (
                      <View style={styles.blockchainProof}>
                        <Text style={styles.blockchainLabel}>🧾 On-chain Proof</Text>
                        <Text style={styles.blockchainValue}>
                          Timestamp: {new Date(proofRecords[(selectedSnapshot.blockchainEvidenceId || selectedSnapshot.id || '')].blockchainRecord.timestamp * 1000).toLocaleString()}
                        </Text>
                        <Text style={styles.blockchainValue}>
                          Officer: {proofRecords[(selectedSnapshot.blockchainEvidenceId || selectedSnapshot.id || '')].blockchainRecord.officerAddress}
                        </Text>
                        <Text style={styles.blockchainValue}>
                          Chain hash: {proofRecords[(selectedSnapshot.blockchainEvidenceId || selectedSnapshot.id || '')].blockchainRecord.evidenceHash.slice(0, 20)}...
                        </Text>
                        <Text style={styles.chainNote}>
                          This record is immutable and stored on the blockchain as proof of custody.
                        </Text>
                      </View>
                    )}
                    
                    {/* Verification Button */}
                    {(selectedSnapshot.blockchainStored || selectedSnapshot.blockchainEvidenceId) ? (
                      <TouchableOpacity
                        style={[
                          styles.verifyButton,
                          verifying[(selectedSnapshot.blockchainEvidenceId || selectedSnapshot.id || '')] && styles.verifyButtonDisabled
                        ]}
                        onPress={() => handleVerify(selectedSnapshot)}
                        disabled={verifying[(selectedSnapshot.blockchainEvidenceId || selectedSnapshot.id || '')]}
                      >
                        <Text style={styles.verifyButtonText}>
                          {verifying[(selectedSnapshot.blockchainEvidenceId || selectedSnapshot.id || '')] ? '🔍 Verifying...' : '🔍 Verify Integrity'}
                        </Text>
                      </TouchableOpacity>
                    ) : (
                      <Text style={styles.noHashNotice}>
                        ⚠️ This evidence has not been stored on-chain yet.
                      </Text>
                    )}
                    
                    {/* Verification Status */}
                    {verificationStatus[(selectedSnapshot.blockchainEvidenceId || selectedSnapshot.id || '')] && (
                      <Text style={[
                        styles.verificationStatus,
                        verificationStatus[(selectedSnapshot.blockchainEvidenceId || selectedSnapshot.id || '')].includes("✅") && styles.statusValid,
                        verificationStatus[(selectedSnapshot.blockchainEvidenceId || selectedSnapshot.id || '')].includes("❌") && styles.statusInvalid,
                        verificationStatus[(selectedSnapshot.blockchainEvidenceId || selectedSnapshot.id || '')].includes("⚠️") && styles.statusWarning
                      ]}>
                        {verificationStatus[(selectedSnapshot.blockchainEvidenceId || selectedSnapshot.id || '')]}
                      </Text>
                    )}
                  </View>
                  <TouchableOpacity
                    style={styles.deleteButton}
                    onPress={() => {
                      setSelectedSnapshot(null);
                      handleDelete(selectedSnapshot);
                    }}
                  >
                    <Text style={styles.deleteButtonText}>🗑️ Delete</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#64748b',
    fontWeight: '500',
  },
  header: {
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 15,
    color: '#64748b',
  },
  grid: {
    paddingBottom: 20,
  },
  imageCard: {
    width: CARD_WIDTH,
    margin: 6,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  image: {
    width: '100%',
    height: 180,
    resizeMode: 'cover',
    backgroundColor: '#e2e8f0',
  },
  cardInfo: {
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardDate: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '500',
  },
  cardChainStatus: {
    marginTop: 4,
    fontSize: 10,
    color: '#2563eb',
    fontWeight: '700',
  },
  cardVerifyStatus: {
    marginTop: 4,
    fontSize: 10,
    fontWeight: '700',
  },
  cardQuality: {
    fontSize: 11,
    color: '#10b981',
    fontWeight: '700',
    backgroundColor: '#d1fae5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 80,
    paddingHorizontal: 40,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 15,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 22,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  searchIcon: {
    fontSize: 18,
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#1e293b',
  },
  filterButton: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  filterText: {
    fontSize: 13,
    color: '#475569',
    fontWeight: '600',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  statCard: {
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
    fontSize: 12,
    color: '#64748b',
  },
  gridContainer: {
    flex: 1,
  },
  mediaPlaceholder: {
    backgroundColor: '#e2e8f0',
    height: 140,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mediaIcon: {
    fontSize: 48,
  },
  cardContent: {
    padding: 12,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 6,
  },
  cardMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cardSize: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '600',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
  },
  modalBackground: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullscreenImage: {
    width: width * 0.9,
    height: height * 0.55,
  },
  modalInfo: {
    position: 'absolute',
    top: 60,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: 16,
    borderRadius: 12,
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 6,
  },
  modalDate: {
    fontSize: 14,
    color: '#ffffff',
    fontWeight: '600',
  },
  modalQuality: {
    fontSize: 12,
    color: '#10b981',
    fontWeight: '700',
    backgroundColor: 'rgba(209, 250, 229, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  modalDevice: {
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: '500',
  },
  deleteButton: {
    position: 'absolute',
    bottom: 60,
    backgroundColor: '#ef4444',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  deleteButtonText: {
    fontSize: 16,
    color: '#ffffff',
    fontWeight: '700',
  },
  // Blockchain Verification Styles
  blockchainInfo: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  blockchainLabel: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '600',
    marginBottom: 4,
  },
  blockchainValue: {
    fontSize: 14,
    color: '#1e293b',
    fontWeight: '500',
    marginBottom: 4,
  },
  modalDetail: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 6,
  },
  blockchainProof: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#e0f2fe',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#bae6fd',
  },
  chainNote: {
    marginTop: 8,
    fontSize: 11,
    color: '#0c4a6e',
    lineHeight: 16,
  },
  txHash: {
    fontSize: 11,
    color: '#94a3b8',
    fontFamily: 'monospace',
  },
  noHashNotice: {
    marginTop: 12,
    fontSize: 12,
    color: '#b45309',
  },
  verifyButton: {
    marginTop: 16,
    backgroundColor: '#3b82f6',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  verifyButtonDisabled: {
    backgroundColor: '#94a3b8',
  },
  verifyButtonText: {
    fontSize: 14,
    color: '#ffffff',
    fontWeight: '600',
  },
  verificationStatus: {
    marginTop: 12,
    padding: 12,
    borderRadius: 8,
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
  statusValid: {
    backgroundColor: '#dcfce7',
    color: '#166534',
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  statusInvalid: {
    backgroundColor: '#fef2f2',
    color: '#dc2626',
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  statusWarning: {
    backgroundColor: '#fef3c7',
    color: '#92400e',
    borderWidth: 1,
    borderColor: '#fde68a',
  },
});
