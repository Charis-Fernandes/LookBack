import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  ScrollView,
  TouchableOpacity,
} from 'react-native';

const mockResults = [
  { id: 1, title: 'Case #2024-1045 Evidence', type: 'Video', date: '2025-10-14', relevance: 95 },
  { id: 2, title: 'Incident Report - Downtown', type: 'Document', date: '2025-10-13', relevance: 89 },
  { id: 3, title: 'Witness Statement A', type: 'Audio', date: '2025-10-12', relevance: 87 },
  { id: 4, title: 'Scene Photography Set', type: 'Images', date: '2025-10-11', relevance: 85 },
  { id: 5, title: 'Surveillance Footage', type: 'Video', date: '2025-10-10', relevance: 82 },
  { id: 6, title: 'Forensic Analysis Report', type: 'Document', date: '2025-10-09', relevance: 78 },
];

export default function EvidenceSearch() {
  return (
    <View style={styles.container}>
      {/* Search Header */}
      <View style={styles.searchHeader}>
        <View style={styles.searchBox}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search evidence, cases, keywords..."
            placeholderTextColor="#94a3b8"
          />
        </View>

        <View style={styles.filterRow}>
          <TouchableOpacity style={styles.filterChip}>
            <Text style={styles.filterChipText}>All Types</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.filterChip}>
            <Text style={styles.filterChipText}>Date Range</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.filterChip}>
            <Text style={styles.filterChipText}>Case ID</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.filterChip}>
            <Text style={styles.filterChipText}>Location</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Results Info */}
      <View style={styles.resultsInfo}>
        <Text style={styles.resultsText}>Found <Text style={styles.resultsBold}>126 results</Text></Text>
        <TouchableOpacity>
          <Text style={styles.sortText}>Sort by: Relevance ▼</Text>
        </TouchableOpacity>
      </View>

      {/* Results List */}
      <ScrollView style={styles.resultsList} showsVerticalScrollIndicator={false}>
        {mockResults.map((item) => (
          <TouchableOpacity key={item.id} style={styles.resultCard}>
            <View style={styles.resultIcon}>
              <Text style={styles.resultIconText}>
                {item.type === 'Video' ? '🎥' : item.type === 'Document' ? '📄' : item.type === 'Audio' ? '🎵' : '🖼️'}
              </Text>
            </View>

            <View style={styles.resultContent}>
              <Text style={styles.resultTitle}>{item.title}</Text>
              <View style={styles.resultMeta}>
                <View style={styles.resultBadge}>
                  <Text style={styles.resultBadgeText}>{item.type}</Text>
                </View>
                <Text style={styles.resultDate}>{item.date}</Text>
                <View style={styles.relevanceBar}>
                  <View style={[styles.relevanceFill, { width: `${item.relevance}%` }]} />
                </View>
                <Text style={styles.relevanceText}>{item.relevance}%</Text>
              </View>
            </View>

            <TouchableOpacity style={styles.viewButton}>
              <Text style={styles.viewButtonText}>View →</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        ))}
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
  searchHeader: {
    marginBottom: 20,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  searchIcon: {
    fontSize: 20,
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#1e293b',
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
  },
  filterChip: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  filterChipText: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '600',
  },
  resultsInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  resultsText: {
    fontSize: 14,
    color: '#64748b',
  },
  resultsBold: {
    fontWeight: '700',
    color: '#1e293b',
  },
  sortText: {
    fontSize: 13,
    color: '#3b82f6',
    fontWeight: '600',
  },
  resultsList: {
    flex: 1,
  },
  resultCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  resultIcon: {
    width: 48,
    height: 48,
    backgroundColor: '#f1f5f9',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  resultIconText: {
    fontSize: 24,
  },
  resultContent: {
    flex: 1,
  },
  resultTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 6,
  },
  resultMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  resultBadge: {
    backgroundColor: '#dbeafe',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  resultBadgeText: {
    fontSize: 11,
    color: '#3b82f6',
    fontWeight: '600',
  },
  resultDate: {
    fontSize: 12,
    color: '#64748b',
  },
  relevanceBar: {
    width: 50,
    height: 4,
    backgroundColor: '#e2e8f0',
    borderRadius: 2,
    overflow: 'hidden',
  },
  relevanceFill: {
    height: '100%',
    backgroundColor: '#10b981',
  },
  relevanceText: {
    fontSize: 11,
    color: '#10b981',
    fontWeight: '600',
  },
  viewButton: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    marginLeft: 12,
  },
  viewButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
  },
});
