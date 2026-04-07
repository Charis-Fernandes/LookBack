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
  EvidenceItem,
  ProcessedDocument,
  FIRDocument,
  IDCardDocument,
  PoliceReportDocument,
} from '../services/FirebaseService';
import { verifyEvidenceAgainstFirebaseHash, blockchainContractConfig } from '../services/BlockchainService';

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
  const [selectedEvidence, setSelectedEvidence] = useState<EvidenceItem | null>(null);
  const [showImage, setShowImage] = useState(false);
  const [verifying, setVerifying] = useState<Record<string, boolean>>({});

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
    setSelectedEvidence(null);
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

    if (pdoc.evidenceId) {
      try {
        const evidence = await FirebaseService.getEvidenceById(pdoc.evidenceId);
        setSelectedEvidence(evidence);
      } catch (error) {
        console.warn('Could not load evidence detail:', error);
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

  const handleVerify = async (pdoc: ProcessedDocument) => {
    const evidenceId = pdoc.evidenceId || '';

    if (!evidenceId) {
      Alert.alert('Verification Unavailable', 'No linked evidence ID found for this document.');
      return;
    }

    setVerifying((prev) => ({ ...prev, [evidenceId]: true }));
    try {
      const evidence: EvidenceItem | null = selectedEvidence || await FirebaseService.getEvidenceById(evidenceId);
      const firebaseHash = evidence?.fileHash?.trim() || '';

      if (!firebaseHash) {
        throw new Error('Firebase file hash is missing for this evidence.');
      }

      const { blockchainRecord, blockchainMatchesFirebaseHash, firebaseFileHash } =
        await verifyEvidenceAgainstFirebaseHash(evidenceId, firebaseHash);

      const verificationStatus = blockchainMatchesFirebaseHash ? 'VERIFIED' : 'MISMATCH';
      const verificationMessage = blockchainMatchesFirebaseHash
        ? `Verified: Firebase hash matches blockchain (${firebaseFileHash.slice(0, 12)}...)`
        : `Mismatch: Firebase hash does not match blockchain (${blockchainRecord.evidenceHash.slice(0, 12)}...)`;

      await FirebaseService.updateEvidence(evidenceId, {
        verificationStatus,
        verificationMessage,
        verificationMode: 'FIREBASE_VS_BLOCKCHAIN',
        lastVerifiedAt: Date.now(),
        lastVerifiedOnChainHash: blockchainRecord.evidenceHash,
        lastVerifiedFirebaseHash: firebaseFileHash,
        lastVerifiedOfficerAddress: blockchainRecord.officerAddress,
        lastVerifiedOnChainTimestamp: blockchainRecord.timestamp,
      });

      const refreshedEvidence = await FirebaseService.getEvidenceById(evidenceId);
      setSelectedEvidence(refreshedEvidence);
    } catch (error) {
      const message = `Could not verify: ${error instanceof Error ? error.message : 'Unknown error'}`;

      await FirebaseService.updateEvidence(evidenceId, {
        verificationStatus: 'ERROR',
        verificationMessage: message,
        verificationMode: 'FIREBASE_VS_BLOCKCHAIN',
        lastVerifiedAt: Date.now(),
      });

      const refreshedEvidence = await FirebaseService.getEvidenceById(evidenceId);
      setSelectedEvidence(refreshedEvidence);
    } finally {
      setVerifying((prev) => ({ ...prev, [evidenceId]: false }));
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
        <Text style={styles.searchIcon}>{'>'}</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="SEARCH DATABASE..."
          placeholderTextColor="#94a3b8"
          value={searchQuery}
          onChangeText={setSearchQuery}
          onSubmitEditing={handleSearch}
          returnKeyType="search"
          autoCapitalize="characters"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => { setSearchQuery(''); performSearch(); }}>
            <Text style={{ fontSize: 16, color: '#94a3b8', fontWeight: '800' }}>{'\u2715'}</Text>
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
            FILTERS
            {hasActiveFilters ? ` [ACTIVE]` : ''}
          </Text>
        </TouchableOpacity>
        {hasActiveFilters && (
          <TouchableOpacity onPress={clearAllFilters} style={styles.clearAllBtn}>
            <Text style={styles.clearAllBtnText}>[CLEAR]</Text>
          </TouchableOpacity>
        )}
        <View style={{ flex: 1 }} />
        <Text style={styles.resultsCount}>
          {results.length} RECORD{results.length !== 1 ? 'S' : ''}
        </Text>
        <TouchableOpacity onPress={loadInitialData} style={{ marginLeft: 10 }}>
          <Text style={styles.refreshBtn}>[RE-SYNC]</Text>
        </TouchableOpacity>
      </View>

      {/* Filter Panel */}
      {showFilters && (
        <View style={styles.filterPanel}>
          {/* Doc Type */}
          <Text style={styles.filterSectionLabel}>DOCUMENT CLASSIFICATION</Text>
          <View style={styles.filterChipRow}>
            {DOC_TYPE_OPTIONS.map(f => (
              <TouchableOpacity
                key={f.value}
                style={[styles.filterChip, activeFilter === f.value && styles.filterChipActive]}
                onPress={() => setActiveFilter(f.value)}
              >
                <Text style={[styles.filterChipText, activeFilter === f.value && styles.filterChipTextActive]}>
                  {f.label.toUpperCase()} [{f.count}]
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Year */}
          <Text style={[styles.filterSectionLabel, { marginTop: 12 }]}>TIMEFRAME: YEAR</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <TouchableOpacity
              style={[styles.dateChip, !filterYear && styles.dateChipActive]}
              onPress={() => setFilterYear(null)}
            >
              <Text style={[styles.dateChipText, !filterYear && styles.dateChipTextActive]}>ALL</Text>
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
          <Text style={[styles.filterSectionLabel, { marginTop: 12 }]}>TIMEFRAME: MONTH</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <TouchableOpacity
              style={[styles.dateChip, !filterMonth && styles.dateChipActive]}
              onPress={() => setFilterMonth(null)}
            >
              <Text style={[styles.dateChipText, !filterMonth && styles.dateChipTextActive]}>ALL</Text>
            </TouchableOpacity>
            {MONTHS.map((m, i) => (
              <TouchableOpacity
                key={m}
                style={[styles.dateChip, filterMonth === i + 1 && styles.dateChipActive]}
                onPress={() => setFilterMonth(i + 1)}
              >
                <Text style={[styles.dateChipText, filterMonth === i + 1 && styles.dateChipTextActive]}>{m.toUpperCase()}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Loading */}
      {loading && (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color="#0f172a" />
          <Text style={styles.loadingText}>QUERYING DATABASE...</Text>
        </View>
      )}

      {/* Empty State */}
      {!loading && results.length === 0 && (
        <View style={styles.centerBox}>
          <Text style={styles.emptyTitle}>0 RECORDS RETURNED</Text>
          <Text style={styles.emptyText}>
            {'AWAITING NEW DOCUMENT INGESTION.'}
          </Text>
        </View>
      )}

      {/* Document Cards */}
      <ScrollView style={styles.resultsList} showsVerticalScrollIndicator={false}>
        {results.map((item) => {
          const title = getDisplayTitle(item).toUpperCase();
          const subtitle = getDisplaySubtitle(item).toUpperCase();
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
                <View style={[styles.docCardIcon, { backgroundColor: getDocColor(item.docType) + '12', borderWidth: 1, borderColor: getDocColor(item.docType) }]}>
                  <Text style={{ fontSize: 18, fontWeight: '800', color: getDocColor(item.docType) }}>DOC</Text>
                </View>
              )}
              <View style={styles.docCardBody}>
                <View style={styles.docCardHeader}>
                  <View style={[styles.typeBadge, { backgroundColor: getDocColor(item.docType), borderWidth: 0 }]}>
                    <Text style={[styles.typeBadgeText, { color: '#ffffff' }]}>
                      {item.docType.replace('_', ' ')}
                    </Text>
                  </View>
                  <Text style={styles.docDate}>{formatDate(item.processedAt || item.timestamp).toUpperCase()}</Text>
                </View>
                <Text style={styles.docTitle} numberOfLines={2}>{title}</Text>
                <Text style={styles.docSubtitle} numberOfLines={1}>{subtitle}</Text>
                {topKeys.length > 0 && (
                  <View style={styles.keyFieldsRow}>
                    {topKeys.map(([k, v]) => (
                      <Text key={k} style={styles.keyFieldText} numberOfLines={1}>
                        {k.replace(/_/g, ' ').toUpperCase()}: {String(v).toUpperCase()}
                      </Text>
                    ))}
                  </View>
                )}
              </View>
              <View style={styles.docCardArrow}>
                <Text style={{ fontSize: 18, color: '#94a3b8', fontWeight: '800' }}>{'>'}</Text>
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
        animationType="fade"
        onRequestClose={() => setShowDetailModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '92%' }]}>
            {selectedDoc && (
              <>
                {/* Header */}
                <View style={styles.modalHeader}>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <View style={[styles.typeBadge, { backgroundColor: getDocColor(selectedDoc.docType) }]}>
                        <Text style={[styles.typeBadgeText, { color: '#ffffff', fontSize: 10 }]}>
                          {selectedDoc.docType.replace('_', ' ')}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.modalTitle}>
                      {getDisplayTitle(selectedDoc).toUpperCase()}
                    </Text>
                    <Text style={styles.modalSubtitle}>
                      {getDisplaySubtitle(selectedDoc).toUpperCase()} {'\u00B7'} {formatTime(selectedDoc.processedAt || selectedDoc.timestamp)}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => setShowDetailModal(false)} style={styles.closeX}>
                    <Text style={{ fontSize: 16, color: '#475569', fontWeight: '800' }}>{'\u2715'}</Text>
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
                      <Text style={styles.detailCardTitle}>{'\u{1F4CB}'} FIR INFORMATION</Text>
                      <DetailField label="FIR NUMBER" value={firDetail.firNo} highlight />
                      <DetailField label="DATE" value={firDetail.date} />
                      <DetailField label="POLICE STATION" value={firDetail.policeStation} />
                      <DetailField label="COMPLAINANT" value={firDetail.complainant} />
                      <DetailField label="ACCUSED" value={firDetail.accused} />
                      {firDetail.sections.length > 0 && (
                        <DetailField label="IPC SECTIONS" value={firDetail.sections.join(', ')} />
                      )}
                      {firDetail.actsReferenced.length > 0 && (
                        <DetailField label="ACTS REFERENCED" value={firDetail.actsReferenced.join(', ')} />
                      )}
                      {firDetail.sectionDescriptions && Object.keys(firDetail.sectionDescriptions).length > 0 && (
                        <View style={{ marginTop: 8 }}>
                          <Text style={styles.fieldLabel}>SECTION DETAILS</Text>
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
                      <Text style={styles.detailCardTitle}>{'\u{1FAAA}'} ID CARD INFORMATION</Text>
                      <DetailField label="CARD TYPE" value={idCardDetail.cardType} highlight />
                      {idCardDetail.name ? <DetailField label="NAME" value={idCardDetail.name} /> : null}
                      {idCardDetail.idNumber ? <DetailField label="ID NUMBER" value={idCardDetail.idNumber} /> : null}
                      {idCardDetail.dateOfBirth ? <DetailField label="DATE OF BIRTH" value={idCardDetail.dateOfBirth} /> : null}
                      {idCardDetail.address ? <DetailField label="ADDRESS" value={idCardDetail.address} /> : null}
                    </View>
                  )}

                  {/* Report Details */}
                  {reportDetail && (
                    <View style={styles.detailCard}>
                      <Text style={styles.detailCardTitle}>{'\u{1F4DD}'} REPORT INFORMATION</Text>
                      <DetailField label="REPORT TYPE" value={reportDetail.reportType} highlight />
                      {reportDetail.reportNumber ? <DetailField label="REPORT NO." value={reportDetail.reportNumber} /> : null}
                      {reportDetail.date ? <DetailField label="DATE" value={reportDetail.date} /> : null}
                      {reportDetail.officer ? <DetailField label="OFFICER" value={reportDetail.officer} /> : null}
                      {reportDetail.sections.length > 0 && (
                        <DetailField label="SECTIONS" value={reportDetail.sections.join(', ')} />
                      )}
                    </View>
                  )}

                  {/* Extracted Key Fields (fallback if no typed detail) */}
                  {selectedDoc.keyFields && Object.keys(selectedDoc.keyFields).length > 0 && !firDetail && !idCardDetail && !reportDetail && (
                    <View style={styles.detailCard}>
                      <Text style={styles.detailCardTitle}>{'\u{1F4CA}'} EXTRACTED INFORMATION</Text>
                      {Object.entries(selectedDoc.keyFields).map(([k, v]) => (
                        <DetailField key={k} label={k.replace(/_/g, ' ')} value={v} />
                      ))}
                    </View>
                  )}

                  {/* Detected Objects */}
                  {selectedDoc.detectedObjects && selectedDoc.detectedObjects.length > 0 && (
                    <View style={styles.detailCard}>
                      <Text style={styles.detailCardTitle}>{'\u{1F50E}'} DETECTED OBJECTS</Text>
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
                      <Text style={styles.detailCardTitle}>{'\u{1F4C3}'} FULL DOCUMENT TEXT</Text>
                      <ScrollView style={{ maxHeight: 250 }} nestedScrollEnabled>
                        <Text style={styles.ocrFullText} selectable>{selectedDoc.ocrText}</Text>
                      </ScrollView>
                    </View>
                  ) : null}

                  {/* Processing Details */}
                  <View style={[styles.detailCard, { backgroundColor: '#f1f5f9' }]}>
                    <Text style={[styles.detailCardTitle, { fontSize: 12, color: '#94a3b8' }]}>{'\u{1F527}'} PROCESSING DETAILS</Text>
                    <View style={styles.techRow}>
                      <Text style={styles.techLabel}>OCR CONFIDENCE</Text>
                      <Text style={styles.techValue}>{((selectedDoc.ocrConfidence || 0) * 100).toFixed(0)}%</Text>
                    </View>
                    <View style={styles.techRow}>
                      <Text style={styles.techLabel}>CLASSIFICATION</Text>
                      <Text style={styles.techValue}>{((selectedDoc.classificationConfidence || 0) * 100).toFixed(0)}%</Text>
                    </View>
                    <View style={styles.techRow}>
                      <Text style={styles.techLabel}>FIELDS FOUND</Text>
                      <Text style={styles.techValue}>{selectedDoc.fieldsExtracted || 0}</Text>
                    </View>
                    <View style={styles.techRow}>
                      <Text style={styles.techLabel}>DOCUMENT ID</Text>
                      <Text style={[styles.techValue, { fontSize: 10 }]}>{selectedDoc.id ? selectedDoc.id.substring(0, 12) + '...' : 'N/A'}</Text>
                    </View>
                    <View style={styles.techRow}>
                      <Text style={styles.techLabel}>EVIDENCE ID</Text>
                      <Text style={[styles.techValue, { fontSize: 10 }]}>{selectedDoc.evidenceId ? selectedDoc.evidenceId.substring(0, 12) + '...' : 'N/A'}</Text>
                    </View>
                    <View style={styles.techRow}>
                      <Text style={styles.techLabel}>CONTRACT</Text>
                      <Text style={[styles.techValue, { fontSize: 10 }]}>{blockchainContractConfig.address.substring(0, 12)}...</Text>
                    </View>
                  </View>

                  {/* Blockchain Verification */}
                  {selectedDoc.evidenceId ? (
                    <View style={styles.detailCard}>
                      <Text style={styles.detailCardTitle}>BLOCKCHAIN VERIFICATION</Text>
                      <TouchableOpacity
                        style={[styles.verifyButton, verifying[selectedDoc.evidenceId] && styles.verifyButtonDisabled]}
                        onPress={() => handleVerify(selectedDoc)}
                        disabled={verifying[selectedDoc.evidenceId]}
                      >
                        <Text style={styles.verifyButtonText}>
                          {verifying[selectedDoc.evidenceId] ? '[VERIFYING...]' : '[VERIFY INTEGRITY]'}
                        </Text>
                      </TouchableOpacity>

                      {selectedEvidence?.verificationMessage && (
                        <Text
                          style={[
                            styles.verificationStatus,
                            selectedEvidence.verificationStatus === 'VERIFIED' && styles.statusValid,
                            selectedEvidence.verificationStatus === 'MISMATCH' && styles.statusInvalid,
                            selectedEvidence.verificationStatus === 'ERROR' && styles.statusWarning,
                          ]}
                        >
                          {selectedEvidence.verificationMessage}
                        </Text>
                      )}

                      {selectedEvidence?.lastVerifiedOnChainTimestamp && selectedEvidence?.lastVerifiedOfficerAddress && selectedEvidence?.lastVerifiedOnChainHash && (
                        <View style={styles.blockchainProof}>
                          <Text style={styles.fieldLabel}>ON-CHAIN PROOF</Text>
                          <Text style={styles.sectionDetailText}>
                            Timestamp: {new Date(selectedEvidence.lastVerifiedOnChainTimestamp * 1000).toLocaleString()}
                          </Text>
                          <Text style={styles.sectionDetailText}>
                            Officer: {selectedEvidence.lastVerifiedOfficerAddress}
                          </Text>
                          <Text style={styles.sectionDetailText}>
                            Hash: {selectedEvidence.lastVerifiedOnChainHash.slice(0, 20)}...
                          </Text>
                        </View>
                      )}
                    </View>
                  ) : null}
                </ScrollView>

                {/* Actions */}
                <View style={styles.modalActions}>
                  <TouchableOpacity style={[styles.btn, styles.btnDanger]} onPress={() => handleDelete(selectedDoc)}>
                    <Text style={styles.btnDangerText}>[PURGE RECORD]</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.btn, styles.btnSecondary]} onPress={() => setShowDetailModal(false)}>
                    <Text style={styles.btnSecondaryText}>[DISMISS]</Text>
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
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  label: {
    fontSize: 10,
    color: '#64748b',
    fontWeight: '800',
    flex: 1,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  value: {
    fontSize: 11,
    color: '#0f172a',
    fontWeight: '700',
    flex: 1.5,
    textAlign: 'right',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    textTransform: 'uppercase',
  },
  highlighted: {
    color: '#0f172a',
    fontWeight: '800',
    fontSize: 12,
  },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9', padding: 18 },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#ffffff',
    borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 4, 
    paddingHorizontal: 16, paddingVertical: 12, marginBottom: 12,
  },
  searchIcon: { fontSize: 16, marginRight: 10, color: '#475569', fontWeight: '800', fontFamily: 'monospace' },
  searchInput: { flex: 1, fontSize: 12, color: '#0f172a', fontWeight: '800', fontFamily: 'monospace' },

  filterToggleRow: {
    flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 10,
  },
  filterToggleBtn: {
    backgroundColor: '#ffffff', paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 4, borderWidth: 1, borderColor: '#cbd5e1',
  },
  filterToggleBtnActive: { backgroundColor: '#1e293b', borderColor: '#0f172a' },
  filterToggleBtnText: { fontSize: 10, color: '#475569', fontWeight: '800', letterSpacing: 1, fontFamily: 'monospace' },
  clearAllBtn: { paddingHorizontal: 10, paddingVertical: 8 },
  clearAllBtnText: { fontSize: 10, color: '#ef4444', fontWeight: '800', letterSpacing: 1, fontFamily: 'monospace' },
  resultsCount: { fontSize: 10, color: '#475569', fontWeight: '800', letterSpacing: 1, fontFamily: 'monospace' },
  refreshBtn: { fontSize: 10, color: '#0f172a', fontWeight: '800', letterSpacing: 1, fontFamily: 'monospace' },

  filterPanel: {
    backgroundColor: '#ffffff', borderRadius: 4, padding: 16, marginBottom: 12,
    borderWidth: 1, borderColor: '#cbd5e1',
  },
  filterSectionLabel: {
    fontSize: 10, fontWeight: '800', color: '#64748b', textTransform: 'uppercase',
    letterSpacing: 1, marginBottom: 8,
  },
  filterChipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  filterChip: {
    backgroundColor: '#f1f5f9', paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 4, borderWidth: 1, borderColor: '#cbd5e1',
  },
  filterChipActive: { backgroundColor: '#1e293b', borderColor: '#0f172a' },
  filterChipText: { fontSize: 10, color: '#475569', fontWeight: '800', letterSpacing: 1, fontFamily: 'monospace' },
  filterChipTextActive: { color: '#f8fafc' },
  dateChip: {
    backgroundColor: '#f1f5f9', paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 4, marginRight: 6, borderWidth: 1, borderColor: '#cbd5e1',
  },
  dateChipActive: { backgroundColor: '#1e293b', borderColor: '#0f172a' },
  dateChipText: { fontSize: 10, color: '#475569', fontWeight: '800', letterSpacing: 1, fontFamily: 'monospace' },
  dateChipTextActive: { color: '#f8fafc' },

  centerBox: { padding: 40, alignItems: 'center' },
  loadingText: { marginTop: 16, fontSize: 11, color: '#475569', fontWeight: '800', letterSpacing: 2, fontFamily: 'monospace' },
  emptyTitle: { fontSize: 13, fontWeight: '800', color: '#0f172a', marginBottom: 8, letterSpacing: 1, fontFamily: 'monospace' },
  emptyText: { fontSize: 11, color: '#64748b', textAlign: 'center', lineHeight: 20, fontFamily: 'monospace', fontWeight: '700' },
  resultsList: { flex: 1 },

  docCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#ffffff',
    borderRadius: 4, padding: 14, marginBottom: 10,
    borderWidth: 1, borderColor: '#cbd5e1',
  },
  docCardThumb: {
    width: 60, height: 60, borderRadius: 2, overflow: 'hidden',
    marginRight: 14, backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#e2e8f0',
  },
  thumbImage: { width: '100%', height: '100%' },
  docCardIcon: {
    width: 60, height: 60, borderRadius: 2,
    justifyContent: 'center', alignItems: 'center', marginRight: 14,
    backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#e2e8f0',
  },
  docCardBody: { flex: 1 },
  docCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  typeBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 2 },
  typeBadgeText: { fontSize: 9, fontWeight: '800', letterSpacing: 1.5, color: '#fff', fontFamily: 'monospace' },
  docDate: { fontSize: 9, color: '#64748b', fontWeight: '800', fontFamily: 'monospace', letterSpacing: 1 },
  docTitle: { fontSize: 12, fontWeight: '800', color: '#0f172a', marginBottom: 4, letterSpacing: 0.5 },
  docSubtitle: { fontSize: 10, color: '#475569', marginBottom: 6, fontWeight: '700', fontFamily: 'monospace' },
  keyFieldsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  keyFieldText: { fontSize: 9, color: '#475569', fontWeight: '800', letterSpacing: 0.5, backgroundColor: '#f1f5f9', paddingHorizontal: 6, paddingVertical: 4, borderRadius: 2, borderWidth: 1, borderColor: '#e2e8f0', fontFamily: 'monospace' },
  docCardArrow: { paddingLeft: 12, justifyContent: 'center' },

  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(15,23,42,0.85)',
    justifyContent: 'center', alignItems: 'center', padding: 16,
  },
  modalContent: {
    backgroundColor: '#ffffff', borderRadius: 4, padding: 20,
    width: '100%', maxWidth: 540, borderWidth: 1, borderColor: '#cbd5e1',
  },
  modalHeader: {
    flexDirection: 'row', marginBottom: 16, alignItems: 'flex-start',
    borderBottomWidth: 1, borderBottomColor: '#e2e8f0', paddingBottom: 14,
  },
  modalTitle: { fontSize: 14, fontWeight: '800', color: '#0f172a', letterSpacing: 1, lineHeight: 20 },
  modalSubtitle: { fontSize: 10, color: '#64748b', marginTop: 6, fontWeight: '800', fontFamily: 'monospace', letterSpacing: 1 },
  closeX: {
    width: 32, height: 32, borderRadius: 4,
    backgroundColor: '#f8fafc', justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: '#cbd5e1',
  },
  detailCard: { 
    backgroundColor: '#ffffff', borderRadius: 4, padding: 16, marginBottom: 14,
    borderWidth: 1, borderColor: '#cbd5e1',
  },
  detailCardTitle: { fontSize: 13, fontWeight: '800', color: '#0f172a', marginBottom: 10, letterSpacing: 0.5 },
  fieldLabel: { fontSize: 11, fontWeight: '700', color: '#64748b', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  sectionDetailText: { fontSize: 12, color: '#475569', lineHeight: 20, paddingLeft: 4, fontWeight: '500' },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag: { backgroundColor: '#e2e8f0', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 4, borderWidth: 1, borderColor: '#cbd5e1' },
  tagText: { fontSize: 10, color: '#475569', fontWeight: '700', letterSpacing: 0.5 },
  ocrFullText: {
    fontSize: 11, color: '#475569', lineHeight: 20, padding: 12,
    backgroundColor: '#ffffff', borderRadius: 4, borderWidth: 1, borderColor: '#e2e8f0', fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  docFullImage: {
    width: '100%', height: 350, borderRadius: 4, marginTop: 8,
    backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#e2e8f0',
  },
  docPreviewImage: {
    width: '100%', height: 120, borderRadius: 4,
    backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#e2e8f0',
  },
  viewImageBtn: { position: 'relative', borderRadius: 4, overflow: 'hidden', marginTop: 8 },
  viewImageOverlay: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: 'rgba(15,23,42,0.85)', paddingVertical: 8, alignItems: 'center',
  },
  viewImageText: { color: '#f8fafc', fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  techRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  techLabel: { fontSize: 10, color: '#64748b', fontWeight: '600' },
  techValue: { fontSize: 10, color: '#475569', fontWeight: '800', fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  modalActions: {
    flexDirection: 'row', gap: 12, marginTop: 14,
    paddingTop: 14, borderTopWidth: 2, borderTopColor: '#f1f5f9',
  },
  btn: { flex: 1, paddingVertical: 14, borderRadius: 4, alignItems: 'center', borderWidth: 1 },
  btnSecondary: { backgroundColor: '#f1f5f9', borderColor: '#cbd5e1' },
  btnSecondaryText: { color: '#475569', fontSize: 12, fontWeight: '800', letterSpacing: 0.5 },
  btnDanger: { backgroundColor: '#fef2f2', borderColor: '#fca5a5' },
  btnDangerText: { color: '#b91c1c', fontSize: 12, fontWeight: '800', letterSpacing: 0.5 },
  verifyButton: {
    marginTop: 10,
    backgroundColor: '#0f172a',
    borderColor: '#1e293b',
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 4,
    alignItems: 'center',
  },
  verifyButtonDisabled: {
    backgroundColor: '#94a3b8',
    borderColor: '#94a3b8',
  },
  verifyButtonText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    fontFamily: 'monospace',
  },
  verificationStatus: {
    marginTop: 10,
    padding: 10,
    borderRadius: 4,
    fontSize: 11,
    fontWeight: '700',
    borderWidth: 1,
  },
  statusValid: {
    backgroundColor: '#dcfce7',
    color: '#166534',
    borderColor: '#86efac',
  },
  statusInvalid: {
    backgroundColor: '#fef2f2',
    color: '#b91c1c',
    borderColor: '#fca5a5',
  },
  statusWarning: {
    backgroundColor: '#fef3c7',
    color: '#92400e',
    borderColor: '#fcd34d',
  },
  blockchainProof: {
    marginTop: 10,
    padding: 10,
    borderRadius: 4,
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
});
