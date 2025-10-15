import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  ScrollView,
  TouchableOpacity,
} from 'react-native';

const mockEvidence = [
  { id: 1, type: 'video', title: 'Incident_001.mp4', date: '2025-10-14', size: '45 MB' },
  { id: 2, type: 'image', title: 'Evidence_A.jpg', date: '2025-10-13', size: '2.3 MB' },
  { id: 3, type: 'video', title: 'Scene_Recording.mp4', date: '2025-10-12', size: '128 MB' },
  { id: 4, type: 'image', title: 'Document_Scan.png', date: '2025-10-12', size: '1.8 MB' },
  { id: 5, type: 'audio', title: 'Interview_001.mp3', date: '2025-10-11', size: '15 MB' },
  { id: 6, type: 'video', title: 'Surveillance_B.mp4', date: '2025-10-10', size: '89 MB' },
  { id: 7, type: 'image', title: 'Photo_Evidence.jpg', date: '2025-10-09', size: '3.1 MB' },
  { id: 8, type: 'document', title: 'Report_Final.pdf', date: '2025-10-08', size: '890 KB' },
];

export default function EvidenceVault() {
  return (
    <View style={styles.container}>
      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Search evidence by name, date, or type..."
          placeholderTextColor="#94a3b8"
        />
        <TouchableOpacity style={styles.filterButton}>
          <Text style={styles.filterText}>🎛️ Filter</Text>
        </TouchableOpacity>
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>245</Text>
          <Text style={styles.statLabel}>Total Items</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>8.4 GB</Text>
          <Text style={styles.statLabel}>Storage Used</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>15</Text>
          <Text style={styles.statLabel}>Recent</Text>
        </View>
      </View>

      {/* Evidence Grid */}
      <ScrollView style={styles.gridContainer} showsVerticalScrollIndicator={false}>
        <View style={styles.grid}>
          {mockEvidence.map((item) => (
            <TouchableOpacity key={item.id} style={styles.evidenceCard}>
              <View style={styles.mediaPlaceholder}>
                <Text style={styles.mediaIcon}>
                  {item.type === 'video' ? '🎥' : item.type === 'image' ? '🖼️' : item.type === 'audio' ? '🎵' : '📄'}
                </Text>
              </View>
              <View style={styles.cardContent}>
                <Text style={styles.cardTitle} numberOfLines={1}>
                  {item.title}
                </Text>
                <View style={styles.cardMeta}>
                  <Text style={styles.cardDate}>{item.date}</Text>
                  <Text style={styles.cardSize}>{item.size}</Text>
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
    padding: 24,
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
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  evidenceCard: {
    width: '48%',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    marginBottom: 16,
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
  cardDate: {
    fontSize: 11,
    color: '#64748b',
  },
  cardSize: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '600',
  },
});
