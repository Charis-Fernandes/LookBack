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
import LocalFileStorageService, { StoredSnapshot } from '../services/LocalFileStorageService';

const { width, height } = Dimensions.get('window');
const CARD_WIDTH = (width - 48) / 2; // 2 columns with padding

export default function EvidenceVault() {
  const [snapshots, setSnapshots] = useState<EvidenceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedSnapshot, setSelectedSnapshot] = useState<EvidenceItem | null>(null);

  useEffect(() => {
    loadSnapshots();
  }, []);

  const loadSnapshots = async () => {
    try {
      setLoading(true);
      // Try Firestore first, fall back to local storage
      let data = await FirebaseService.listEvidence();
      if (data.length === 0) {
        // Fallback: load from local storage for backward compatibility
        const localData = await LocalFileStorageService.listSnapshots();
        data = localData.map(s => ({
          id: s.id,
          imageUrl: s.uri,
          timestamp: s.timestamp,
          deviceId: s.deviceId,
          quality: s.quality,
          streamUrl: s.streamUrl,
          caseId: s.caseId,
        }));
      }
      setSnapshots(data);
      console.log(`📁 Loaded ${data.length} evidence items`);
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
        }));
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
        <Text style={styles.title}>📁 Evidence Vault</Text>
        <Text style={styles.subtitle}>{snapshots.length} snapshots stored</Text>
      </View>

      <FlatList
        data={snapshots}
        numColumns={2}
        keyExtractor={(item) => item.id || String(item.timestamp)}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.imageCard}
            onPress={() => setSelectedSnapshot(item)}
            onLongPress={() => handleDelete(item)}
          >
            <Image source={{ uri: item.imageUrl }} style={styles.image} />
            <View style={styles.cardInfo}>
              <Text style={styles.cardDate}>{formatDate(item.timestamp)}</Text>
              <Text style={styles.cardQuality}>{item.quality}</Text>
            </View>
          </TouchableOpacity>
        )}
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
    transform: [{ rotate: '-90deg' }],
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
    width: height * 0.8, // Swap width/height for rotated image
    height: width,
    transform: [{ rotate: '-90deg' }],
  },
  modalInfo: {
    position: 'absolute',
    top: 60,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: 16,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
});
