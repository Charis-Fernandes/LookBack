import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  Alert,
  Image,
  Dimensions,
  Platform,
} from 'react-native';
import FirebaseService, {
  ProcessedDocument,
  FIRDocument,
  IDCardDocument,
  PoliceReportDocument,
} from '../services/FirebaseService';

type DocTypeFilter = 'ALL' | 'FIR' | 'ID_CARD' | 'POLICE_REPORT' | 'CHARGE_SHEET';

interface CollectionStats {
  firs: number;
  id_cards: number;
  police_reports: number;
  processed_documents: number;
  evidence: number;
}

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const SCREEN_WIDTH = Dimensions.get('window').width;

export default function EvidenceSearch() {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<DocTypeFilter>('ALL');
  const [results, setResults] = useState<ProcessedDocument[]>([]);
  const [loading, setLoading] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);
  const [stats, setStats] = useState<CollectionStats>({
    firs: 0, id_cards: 0, police_reports: 0, processed_documents: 0, evidence: 0,
  });
  const [filterYear, setFilterYear] = useState<number | null>(null);
  const [filterMonth, setFilterMonth] = useState<number | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<ProcessedDocument | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [firDetail, setFirDetail] = useState<FIRDocument | null>(null);
  const [idCardDetail, setIdCardDetail] = useState<IDCardDocument | null>(null);
  const [reportDetail, setReportDetail] = useState<PoliceReportDocument | null>(null);
  const [showImage, setShowImage] = useState(false);

  useEffect(() => { loadInitialData(); }, []);
  useEffect(() => { if (!initialLoad) performSearch(); }, [activeFilter, filterYear, filterMonth]);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      const [docs, collectionStats] = await Promise.all([
        FirebaseService.listProcessedDocuments(200),
        FirebaseService.getCollectionStats(),
      ]);
      setResults(docs);
      setStats(collectionStats as unknown as CollectionStats);
    } catch (error) {
      console.error('Load error:', error);
    } finally {
      setLoading(false);
      setInitialLoad(false);
    }
  };

  const performSearch = useCallback(async () => {
    setLoading(true);
    try {
      let docs: ProcessedDocument[];
      if (filterYear || filterMonth || (activeFilter !== 'ALL')) {
        docs = await FirebaseService.searchByDateRange({
          year: filterYear || undefined,
          month: filterMonth || undefined,
          docType: activeFilter !== 'ALL' ? activeFilter : undefined,
        }, 200);
      } else if (searchQuery.trim()) {
        docs = await FirebaseService.searchProcessedDocuments(searchQuery.trim());
      } else {
        docs = await FirebaseService.listProcessedDocuments(200);
      }
      if (searchQuery.trim()) {
        const term = searchQuery.trim().toLowerCase();
        docs = docs.filter(d =>
          d.ocrText?.toLowerCase().includes(term) ||
          d.textPreview?.toLowerCase().includes(term) ||
          d.title?.toLowerCase().includes(term) ||
          d.subtitle?.toLowerCase().includes(term) ||
          d.searchKeywords?.some(k => k.includes(term))
        );
      }
      setResults(docs);
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setLoading(false);
    }
  }, [searchQuery, activeFilter, filterYear, filterMonth]);

  const handleSearch = () => performSearch();

  const handleViewDetail = async (pdoc: ProcessedDocument) => {
    setSelectedDoc(pdoc);
    setFirDetail(null);
    setIdCardDetail(null);
    setReportDetail(null);
    setShowImage(false);
    if (pdoc.typedDocId) {
      try {
        if (pdoc.docType === 'FIR') {
          const firs = await FirebaseService.listFIRs(100);
          const found = firs.find(f => f.id === pdoc.typedDocId);
          if (found) setFirDetail(found);
        } else if (pdoc.docType === 'ID_CARD') {
          const cards = await FirebaseService.listIDCards(100);
          const found = cards.find(c => c.id === pdoc.typedDocId);
          if (found) setIdCardDetail(found);
        } else if (pdoc.docType === 'POLICE_REPORT' || pdoc.docType === 'CHARGE_SHEET') {
          const reports = await FirebaseService.listPoliceReports(100);
          const found = reports.find(r => r.id === pdoc.typedDocId);
          if (found) setReportDetail(found);
        }
      } catch (error) {
        console.warn('Could not load typed detail:', error);
      }
    }
    setShowDetailModal(true);
  };

  const handleDelete = async (pdoc: ProcessedDocument) => {
    const doDelete = async () => {
      try {
        if (pdoc.id) {
          await FirebaseService.deleteProcessedDocument(pdoc.id);
          setResults(prev => prev.filter(r => r.id !== pdoc.id));
          setShowDetailModal(false);
          const newStats = await FirebaseService.getCollectionStats();
          setStats(newStats as unknown as CollectionStats);
        }
      } catch (error) {
        if (Platform.OS === 'web') {
          (globalThis as any).alert('Failed to delete document');
        } else {
          Alert.alert('Error', 'Failed to delete document');
        }
      }
    };

    if (Platform.OS === 'web') {
      if ((globalThis as any).confirm('This will permanently delete this document record. Continue?')) {
        await doDelete();
      }
    } else {
      Alert.alert('Delete Document', 'This will permanently delete this document record.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: doDelete },
      ]);
    }
  };

  const getDocIcon = (docType: string): string => {
    switch (docType) {
      case 'FIR': return '\u{1F4CB}';
      case 'ID_CARD': return '\u{1FAAA}';
      case 'POLICE_REPORT': return '\u{1F4DD}';
      case 'CHARGE_SHEET': return '\u{2696}\u{FE0F}';
      default: return '\u{1F4C4}';
    }
  };

  const getDocColor = (docType: string): string => {
    switch (docType) {
      case 'FIR': return '#ef4444';
      case 'ID_CARD': return '#3b82f6';
      case 'POLICE_REPORT': return '#f59e0b';
      case 'CHARGE_SHEET': return '#8b5cf6';
      default: return '#64748b';
    }
  };

  const getDocLabel = (docType: string): string => {
    switch (docType) {
      case 'FIR': return 'FIR';
      case 'ID_CARD': return 'ID Card';
      case 'POLICE_REPORT': return 'Police Report';
      case 'CHARGE_SHEET': return 'Charge Sheet';
      default: return 'Document';
    }
  };

  const formatDate = (ts: number): string => {
    if (!ts) return '';
    const d = new Date(ts);
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const formatTime = (ts: number): string => {
    if (!ts) return '';
    const d = new Date(ts);
    return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  };

  const getDisplayTitle = (item: ProcessedDocument): string => {
    if (item.title && item.title !== 'Police Report' && item.title !== 'Unknown Document'
        && item.title !== 'ID Card' && item.title !== 'First Information Report') {
      return item.title;
    }
    // Fallback: use OCR text preview
    const preview = item.ocrText || item.textPreview || '';
    if (preview.length > 5) {
      return preview.replace(/\s+/g, ' ').trim().substring(0, 60);
    }
    return item.title || getDocLabel(item.docType);
  };

  const getDisplaySubtitle = (item: ProcessedDocument): string => {
    if (item.subtitle && item.subtitle !== 'Details pending'
        && !item.subtitle.endsWith('Document')) {
      return item.subtitle;
    }
    return formatDate(item.processedAt || item.timestamp);
  };

  const clearAllFilters = () => {
    setFilterYear(null);
    setFilterMonth(null);
    setActiveFilter('ALL');
    setShowFilters(false);
  };

  const hasActiveFilters = activeFilter !== 'ALL' || filterYear !== null || filterMonth !== null;

  const DOC_TYPE_OPTIONS: { label: string; value: DocTypeFilter; icon: string; count: number }[] = [
    { label: 'All Types', value: 'ALL', icon: '\u{1F5C2}\u{FE0F}', count: stats.processed_documents },
    { label: 'FIR', value: 'FIR', icon: '\u{1F4CB}', count: stats.firs },
    { label: 'ID Card', value: 'ID_CARD', icon: '\u{1FAAA}', count: stats.id_cards },
    { label: 'Police Report', value: 'POLICE_REPORT', icon: '\u{1F4DD}', count: stats.police_reports },
  ];

  return (
    <View style={styles.container}>
      {/* Search Bar */}
      <View style={styles.searchBar}>
        <Text style={styles.searchIcon}>{'\u{1F50D}'}</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Search by FIR no, name, section, text..."
          placeholderTextColor="#94a3b8"
          value={searchQuery}
          onChangeText={setSearchQuery}
          onSubmitEditing={handleSearch}
          returnKeyType="search"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => { setSearchQuery(''); performSearch(); }}>
            <Text style={{ fontSize: 18, color: '#94a3b8' }}>{'\u2715'}</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Filter Toggle Button */}
      <View style={styles.filterToggleRow}>
        <TouchableOpacity
          style={[styles.filterToggleBtn, hasActiveFilters && styles.filterToggleBtnActive]}
          onPress={() => setShowFilters(!showFilters)}
        >
          <Text style={[styles.filterToggleBtnText, hasActiveFilters && { color: '#fff' }]}>
            {'\u{2699}\u{FE0F}'} Filters
            {hasActiveFilters ? ` (${[activeFilter !== 'ALL' ? getDocLabel(activeFilter) : '', filterYear, filterMonth ? MONTHS[filterMonth - 1] : ''].filter(Boolean).join(', ')})` : ''}
          </Text>
        </TouchableOpacity>
        {hasActiveFilters && (
          <TouchableOpacity onPress={clearAllFilters} style={styles.clearAllBtn}>
            <Text style={styles.clearAllBtnText}>{'\u2715'} Clear</Text>
          </TouchableOpacity>
        )}
        <View style={{ flex: 1 }} />
        <Text style={styles.resultsCount}>
          {results.length} result{results.length !== 1 ? 's' : ''}
        </Text>
        <TouchableOpacity onPress={loadInitialData} style={{ marginLeft: 10 }}>
          <Text style={styles.refreshBtn}>{'\u21BB'} Refresh</Text>
        </TouchableOpacity>
      </View>

      {/* Filter Panel */}
      {showFilters && (
        <View style={styles.filterPanel}>
          {/* Doc Type */}
          <Text style={styles.filterSectionLabel}>Document Type</Text>
          <View style={styles.filterChipRow}>
            {DOC_TYPE_OPTIONS.map(f => (
              <TouchableOpacity
                key={f.value}
                style={[styles.filterChip, activeFilter === f.value && styles.filterChipActive]}
                onPress={() => setActiveFilter(f.value)}
              >
                <Text style={[styles.filterChipText, activeFilter === f.value && styles.filterChipTextActive]}>
                  {f.icon} {f.label} ({f.count})
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Year */}
          <Text style={[styles.filterSectionLabel, { marginTop: 12 }]}>Year</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <TouchableOpacity
              style={[styles.dateChip, !filterYear && styles.dateChipActive]}
              onPress={() => setFilterYear(null)}
            >
              <Text style={[styles.dateChipText, !filterYear && styles.dateChipTextActive]}>Any</Text>
            </TouchableOpacity>
            {[2026, 2025, 2024, 2023].map(y => (
              <TouchableOpacity
                key={y}
                style={[styles.dateChip, filterYear === y && styles.dateChipActive]}
                onPress={() => setFilterYear(y)}
              >
                <Text style={[styles.dateChipText, filterYear === y && styles.dateChipTextActive]}>{y}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Month */}
          <Text style={[styles.filterSectionLabel, { marginTop: 12 }]}>Month</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <TouchableOpacity
              style={[styles.dateChip, !filterMonth && styles.dateChipActive]}
              onPress={() => setFilterMonth(null)}
            >
              <Text style={[styles.dateChipText, !filterMonth && styles.dateChipTextActive]}>Any</Text>
            </TouchableOpacity>
            {MONTHS.map((m, i) => (
              <TouchableOpacity
                key={m}
                style={[styles.dateChip, filterMonth === i + 1 && styles.dateChipActive]}
                onPress={() => setFilterMonth(i + 1)}
              >
                <Text style={[styles.dateChipText, filterMonth === i + 1 && styles.dateChipTextActive]}>{m}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Loading */}
      {loading && (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color="#3b82f6" />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      )}

      {/* Empty State */}
      {!loading && results.length === 0 && (
        <View style={styles.centerBox}>
          <Text style={{ fontSize: 56, marginBottom: 12 }}>{'\u{1F4C2}'}</Text>
          <Text style={styles.emptyTitle}>No Documents Found</Text>
          <Text style={styles.emptyText}>
            {'Scan documents using the Document Scanner.\nAI will process them in the background.'}
          </Text>
        </View>
      )}

      {/* Document Cards */}
      <ScrollView style={styles.resultsList} showsVerticalScrollIndicator={false}>
        {results.map((item) => {
          const title = getDisplayTitle(item);
          const subtitle = getDisplaySubtitle(item);
          const keyFields = item.keyFields || {};
          const topKeys = Object.entries(keyFields).slice(0, 3);

          return (
            <TouchableOpacity
              key={item.id}
              style={styles.docCard}
              onPress={() => handleViewDetail(item)}
              activeOpacity={0.7}
            >
              {/* Thumbnail */}
              {item.imageUrl ? (
                <View style={styles.docCardThumb}>
                  <Image
                    source={{ uri: item.imageUrl }}
                    style={styles.thumbImage}
                    resizeMode="cover"
                  />
                </View>
              ) : (
                <View style={[styles.docCardIcon, { backgroundColor: getDocColor(item.docType) + '12' }]}>
                  <Text style={{ fontSize: 28 }}>{getDocIcon(item.docType)}</Text>
                </View>
              )}
              <View style={styles.docCardBody}>
                <View style={styles.docCardHeader}>
                  <View style={[styles.typeBadge, { backgroundColor: getDocColor(item.docType) + '18' }]}>
                    <Text style={[styles.typeBadgeText, { color: getDocColor(item.docType) }]}>
                      {item.docType.replace('_', ' ')}
                    </Text>
                  </View>
                  <Text style={styles.docDate}>{formatDate(item.processedAt || item.timestamp)}</Text>
                </View>
                <Text style={styles.docTitle} numberOfLines={2}>{title}</Text>
                <Text style={styles.docSubtitle} numberOfLines={1}>{subtitle}</Text>
                {topKeys.length > 0 && (
                  <View style={styles.keyFieldsRow}>
                    {topKeys.map(([k, v]) => (
                      <Text key={k} style={styles.keyFieldText} numberOfLines={1}>
                        {k.replace(/_/g, ' ')}: {v}
                      </Text>
                    ))}
                  </View>
                )}
              </View>
              <View style={styles.docCardArrow}>
                <Text style={{ fontSize: 18, color: '#94a3b8' }}>{'\u203A'}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* ═══ Detail Modal ═══ */}
      <Modal
        visible={showDetailModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowDetailModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '92%' }]}>
            {selectedDoc && (
              <>
                {/* Header */}
                <View style={styles.modalHeader}>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <Text style={{ fontSize: 24 }}>{getDocIcon(selectedDoc.docType)}</Text>
                      <View style={[styles.typeBadge, { backgroundColor: getDocColor(selectedDoc.docType) + '18' }]}>
                        <Text style={[styles.typeBadgeText, { color: getDocColor(selectedDoc.docType) }]}>
                          {selectedDoc.docType.replace('_', ' ')}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.modalTitle}>
                      {getDisplayTitle(selectedDoc)}
                    </Text>
                    <Text style={styles.modalSubtitle}>
                      {getDisplaySubtitle(selectedDoc)} {'\u00B7'} {formatTime(selectedDoc.processedAt || selectedDoc.timestamp)}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => setShowDetailModal(false)} style={styles.closeX}>
                    <Text style={{ fontSize: 22, color: '#94a3b8' }}>{'\u2715'}</Text>
                  </TouchableOpacity>
                </View>

                <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
                  {/* Document Image */}
                  {selectedDoc.imageUrl && (
                    <View style={styles.detailCard}>
                      <TouchableOpacity onPress={() => setShowImage(!showImage)}>
                        <Text style={styles.detailCardTitle}>
                          {'\u{1F4F7}'} Uploaded Document {showImage ? '\u25B2' : '\u25BC'}
                        </Text>
                      </TouchableOpacity>
                      {showImage && (
                        <Image
                          source={{ uri: selectedDoc.imageUrl }}
                          style={styles.docFullImage}
                          resizeMode="contain"
                        />
                      )}
                      {!showImage && (
                        <TouchableOpacity
                          style={styles.viewImageBtn}
                          onPress={() => setShowImage(true)}
                        >
                          <Image
                            source={{ uri: selectedDoc.imageUrl }}
                            style={styles.docPreviewImage}
                            resizeMode="cover"
                          />
                          <View style={styles.viewImageOverlay}>
                            <Text style={styles.viewImageText}>Tap to view full document</Text>
                          </View>
                        </TouchableOpacity>
                      )}
                    </View>
                  )}

                  {/* FIR Details */}
                  {firDetail && (
                    <View style={styles.detailCard}>
                      <Text style={styles.detailCardTitle}>{'\u{1F4CB}'} FIR Information</Text>
                      <DetailField label="FIR Number" value={firDetail.firNo} highlight />
                      <DetailField label="Date" value={firDetail.date} />
                      <DetailField label="Police Station" value={firDetail.policeStation} />
                      <DetailField label="Complainant" value={firDetail.complainant} />
                      <DetailField label="Accused" value={firDetail.accused} />
                      {firDetail.sections.length > 0 && (
                        <DetailField label="IPC Sections" value={firDetail.sections.join(', ')} />
                      )}
                      {firDetail.actsReferenced.length > 0 && (
                        <DetailField label="Acts Referenced" value={firDetail.actsReferenced.join(', ')} />
                      )}
                      {firDetail.sectionDescriptions && Object.keys(firDetail.sectionDescriptions).length > 0 && (
                        <View style={{ marginTop: 8 }}>
                          <Text style={styles.fieldLabel}>Section Details</Text>
                          {Object.entries(firDetail.sectionDescriptions).map(([sec, desc]) => (
                            <Text key={sec} style={styles.sectionDetailText}>
                              {'\u2022'} {sec}: {desc}
                            </Text>
                          ))}
                        </View>
                      )}
                    </View>
                  )}

                  {/* ID Card Details */}
                  {idCardDetail && (
                    <View style={styles.detailCard}>
                      <Text style={styles.detailCardTitle}>{'\u{1FAAA}'} ID Card Information</Text>
                      <DetailField label="Card Type" value={idCardDetail.cardType} highlight />
                      {idCardDetail.name ? <DetailField label="Name" value={idCardDetail.name} /> : null}
                      {idCardDetail.idNumber ? <DetailField label="ID Number" value={idCardDetail.idNumber} /> : null}
                      {idCardDetail.dateOfBirth ? <DetailField label="Date of Birth" value={idCardDetail.dateOfBirth} /> : null}
                      {idCardDetail.address ? <DetailField label="Address" value={idCardDetail.address} /> : null}
                    </View>
                  )}

                  {/* Report Details */}
                  {reportDetail && (
                    <View style={styles.detailCard}>
                      <Text style={styles.detailCardTitle}>{'\u{1F4DD}'} Report Information</Text>
                      <DetailField label="Report Type" value={reportDetail.reportType} highlight />
                      {reportDetail.reportNumber ? <DetailField label="Report No." value={reportDetail.reportNumber} /> : null}
                      {reportDetail.date ? <DetailField label="Date" value={reportDetail.date} /> : null}
                      {reportDetail.officer ? <DetailField label="Officer" value={reportDetail.officer} /> : null}
                      {reportDetail.sections.length > 0 && (
                        <DetailField label="Sections" value={reportDetail.sections.join(', ')} />
                      )}
                    </View>
                  )}

                  {/* Extracted Key Fields (fallback if no typed detail) */}
                  {selectedDoc.keyFields && Object.keys(selectedDoc.keyFields).length > 0 && !firDetail && !idCardDetail && !reportDetail && (
                    <View style={styles.detailCard}>
                      <Text style={styles.detailCardTitle}>{'\u{1F4CA}'} Extracted Information</Text>
                      {Object.entries(selectedDoc.keyFields).map(([k, v]) => (
                        <DetailField key={k} label={k.replace(/_/g, ' ')} value={v} />
                      ))}
                    </View>
                  )}

                  {/* Detected Objects */}
                  {selectedDoc.detectedObjects && selectedDoc.detectedObjects.length > 0 && (
                    <View style={styles.detailCard}>
                      <Text style={styles.detailCardTitle}>{'\u{1F50E}'} Detected Objects</Text>
                      <View style={styles.tagRow}>
                        {selectedDoc.detectedObjects.map((obj, idx) => (
                          <View key={idx} style={styles.tag}>
                            <Text style={styles.tagText}>{obj}</Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  )}

                  {/* Full OCR Text */}
                  {selectedDoc.ocrText ? (
                    <View style={styles.detailCard}>
                      <Text style={styles.detailCardTitle}>{'\u{1F4C3}'} Full Document Text</Text>
                      <ScrollView style={{ maxHeight: 250 }} nestedScrollEnabled>
                        <Text style={styles.ocrFullText} selectable>{selectedDoc.ocrText}</Text>
                      </ScrollView>
                    </View>
                  ) : null}

                  {/* Processing Details */}
                  <View style={[styles.detailCard, { backgroundColor: '#f1f5f9' }]}>
                    <Text style={[styles.detailCardTitle, { fontSize: 12, color: '#94a3b8' }]}>{'\u{1F527}'} Processing Details</Text>
                    <View style={styles.techRow}>
                      <Text style={styles.techLabel}>OCR Confidence</Text>
                      <Text style={styles.techValue}>{((selectedDoc.ocrConfidence || 0) * 100).toFixed(0)}%</Text>
                    </View>
                    <View style={styles.techRow}>
                      <Text style={styles.techLabel}>Classification</Text>
                      <Text style={styles.techValue}>{((selectedDoc.classificationConfidence || 0) * 100).toFixed(0)}%</Text>
                    </View>
                    <View style={styles.techRow}>
                      <Text style={styles.techLabel}>Fields Found</Text>
                      <Text style={styles.techValue}>{selectedDoc.fieldsExtracted || 0}</Text>
                    </View>
                    <View style={styles.techRow}>
                      <Text style={styles.techLabel}>Document ID</Text>
                      <Text style={[styles.techValue, { fontSize: 10 }]}>{selectedDoc.id ? selectedDoc.id.substring(0, 12) + '...' : 'N/A'}</Text>
                    </View>
                  </View>
                </ScrollView>

                {/* Actions */}
                <View style={styles.modalActions}>
                  <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(selectedDoc)}>
                    <Text style={styles.deleteBtnText}>{'\u{1F5D1}\u{FE0F}'} Delete</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.closeBtn} onPress={() => setShowDetailModal(false)}>
                    <Text style={styles.closeBtnText}>Close</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

function DetailField({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  if (!value || value === 'N/A') return null;
  return (
    <View style={dfStyles.row}>
      <Text style={dfStyles.label}>{label}</Text>
      <Text style={[dfStyles.value, highlight && dfStyles.highlighted]} numberOfLines={3} selectable>
        {value}
      </Text>
    </View>
  );
}

const dfStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  label: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '600',
    flex: 1,
    textTransform: 'capitalize',
  },
  value: {
    fontSize: 13,
    color: '#1e293b',
    fontWeight: '600',
    flex: 1.5,
    textAlign: 'right',
  },
  highlighted: {
    color: '#2563eb',
    fontWeight: '700',
    fontSize: 15,
  },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc', padding: 20 },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff',
    borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, marginBottom: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  searchIcon: { fontSize: 18, marginRight: 10 },
  searchInput: { flex: 1, fontSize: 15, color: '#1e293b' },

  filterToggleRow: {
    flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 10,
  },
  filterToggleBtn: {
    backgroundColor: '#fff', paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 20, borderWidth: 1, borderColor: '#e2e8f0',
  },
  filterToggleBtnActive: { backgroundColor: '#3b82f6', borderColor: '#3b82f6' },
  filterToggleBtnText: { fontSize: 12, color: '#475569', fontWeight: '600' },
  clearAllBtn: { paddingHorizontal: 10, paddingVertical: 6 },
  clearAllBtnText: { fontSize: 12, color: '#ef4444', fontWeight: '600' },
  resultsCount: { fontSize: 13, color: '#64748b', fontWeight: '600' },
  refreshBtn: { fontSize: 13, color: '#3b82f6', fontWeight: '700' },

  filterPanel: {
    backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  filterSectionLabel: {
    fontSize: 11, fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase',
    letterSpacing: 0.5, marginBottom: 8,
  },
  filterChipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  filterChip: {
    backgroundColor: '#f1f5f9', paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0',
  },
  filterChipActive: { backgroundColor: '#3b82f6', borderColor: '#3b82f6' },
  filterChipText: { fontSize: 12, color: '#475569', fontWeight: '600' },
  filterChipTextActive: { color: '#fff' },
  dateChip: {
    backgroundColor: '#f1f5f9', paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 14, marginRight: 6,
  },
  dateChipActive: { backgroundColor: '#3b82f6' },
  dateChipText: { fontSize: 11, color: '#64748b', fontWeight: '600' },
  dateChipTextActive: { color: '#fff' },

  centerBox: { padding: 40, alignItems: 'center' },
  loadingText: { marginTop: 12, fontSize: 14, color: '#64748b' },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#1e293b', marginBottom: 8 },
  emptyText: { fontSize: 14, color: '#94a3b8', textAlign: 'center', lineHeight: 22 },
  resultsList: { flex: 1 },

  docCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff',
    borderRadius: 14, padding: 14, marginBottom: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 6, elevation: 1,
  },
  docCardThumb: {
    width: 56, height: 56, borderRadius: 10, overflow: 'hidden',
    marginRight: 14, backgroundColor: '#f1f5f9',
  },
  thumbImage: { width: 56, height: 56 },
  docCardIcon: {
    width: 56, height: 56, borderRadius: 10,
    justifyContent: 'center', alignItems: 'center', marginRight: 14,
  },
  docCardBody: { flex: 1 },
  docCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  typeBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  typeBadgeText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  docDate: { fontSize: 11, color: '#94a3b8' },
  docTitle: { fontSize: 14, fontWeight: '700', color: '#1e293b', marginBottom: 2 },
  docSubtitle: { fontSize: 12, color: '#64748b', marginBottom: 4 },
  keyFieldsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  keyFieldText: { fontSize: 11, color: '#94a3b8', fontWeight: '500' },
  docCardArrow: { paddingLeft: 8, justifyContent: 'center' },

  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center', alignItems: 'center', padding: 16,
  },
  modalContent: {
    backgroundColor: '#fff', borderRadius: 18, padding: 20,
    width: '100%', maxWidth: 540,
    shadowColor: '#000', shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15, shadowRadius: 16, elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row', marginBottom: 16,
    borderBottomWidth: 1, borderBottomColor: '#f1f5f9', paddingBottom: 14,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#1e293b', marginTop: 4 },
  modalSubtitle: { fontSize: 13, color: '#64748b', marginTop: 2 },
  closeX: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#f1f5f9', justifyContent: 'center', alignItems: 'center',
  },
  detailCard: { backgroundColor: '#f8fafc', borderRadius: 12, padding: 16, marginBottom: 14 },
  detailCardTitle: { fontSize: 14, fontWeight: '700', color: '#1e293b', marginBottom: 10 },
  fieldLabel: { fontSize: 12, fontWeight: '600', color: '#64748b', marginBottom: 6 },
  sectionDetailText: { fontSize: 12, color: '#475569', lineHeight: 20, paddingLeft: 4 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag: { backgroundColor: '#dbeafe', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  tagText: { fontSize: 12, color: '#3b82f6', fontWeight: '600' },
  ocrFullText: {
    fontSize: 12, color: '#475569', lineHeight: 20, padding: 12,
    backgroundColor: '#fff', borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0',
  },
  docFullImage: {
    width: '100%', height: 350, borderRadius: 10, marginTop: 8,
    backgroundColor: '#f1f5f9',
  },
  docPreviewImage: {
    width: '100%', height: 120, borderRadius: 10,
    backgroundColor: '#f1f5f9',
  },
  viewImageBtn: { position: 'relative', borderRadius: 10, overflow: 'hidden', marginTop: 8 },
  viewImageOverlay: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: 'rgba(0,0,0,0.5)', paddingVertical: 8, alignItems: 'center',
  },
  viewImageText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  techRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  techLabel: { fontSize: 11, color: '#94a3b8' },
  techValue: { fontSize: 11, color: '#94a3b8', fontWeight: '600' },
  modalActions: {
    flexDirection: 'row', gap: 12, marginTop: 14,
    paddingTop: 14, borderTopWidth: 1, borderTopColor: '#f1f5f9',
  },
  deleteBtn: {
    flex: 1, backgroundColor: '#fef2f2', padding: 14, borderRadius: 10,
    alignItems: 'center', borderWidth: 1, borderColor: '#fecaca',
  },
  deleteBtnText: { fontSize: 14, color: '#ef4444', fontWeight: '600' },
  closeBtn: { flex: 2, backgroundColor: '#3b82f6', padding: 14, borderRadius: 10, alignItems: 'center' },
  closeBtnText: { fontSize: 14, color: '#fff', fontWeight: '700' },
});
