import {
  collection,
  doc,
  addDoc,
  getDocs,
  deleteDoc,
  query,
  orderBy,
  limit,
  Timestamp,
  updateDoc,
  where,
  getDoc,
} from 'firebase/firestore';
import { db } from '../config/firebase.config';

// ─── Interfaces ────────────────────────────────────────────

export interface EvidenceItem {
  id?: string;
  imageUrl: string;        // UploadThing URL or base64 data URI
  thumbnailUrl?: string;
  timestamp: number;
  deviceId: string;
  quality: string;
  streamUrl: string;
  caseId?: string;
  description?: string;
  tags?: string[];
  uploadedBy?: string;
  location?: string;
  // AI pipeline fields
  aiProcessed?: boolean;
  docType?: string;           // FIR, ID_CARD, CHARGE_SHEET, POLICE_REPORT, UNKNOWN
  ocrText?: string;
  ocrConfidence?: number;
  classificationConfidence?: number;
  extractedFields?: Record<string, any>;
  detectedObjects?: string[];
  processedDocId?: string;    // Reference to the typed collection doc (firs, id_cards, etc.)
}

// ─── AI-Processed Document Interfaces ──────────────────────

export interface FIRDocument {
  id?: string;
  evidenceId: string;        // Link back to evidence collection
  firNo: string;
  date: string;
  sections: string[];
  sectionDescriptions?: Record<string, string>;
  policeStation: string;
  complainant: string;
  accused: string;
  actsReferenced: string[];
  ocrText: string;
  ocrConfidence: number;
  classificationConfidence: number;
  detectedObjects: string[];
  imageUrl: string;
  timestamp: number;
  caseId?: string;
  deviceId?: string;
}

export interface IDCardDocument {
  id?: string;
  evidenceId: string;
  cardType: string;           // Aadhaar, PAN, Voter ID, etc.
  name?: string;
  idNumber?: string;
  dateOfBirth?: string;
  address?: string;
  ocrText: string;
  ocrConfidence: number;
  classificationConfidence: number;
  detectedObjects: string[];
  imageUrl: string;
  timestamp: number;
  deviceId?: string;
}

export interface PoliceReportDocument {
  id?: string;
  evidenceId: string;
  reportType: string;         // POLICE_REPORT or CHARGE_SHEET
  reportNumber?: string;
  date?: string;
  officer?: string;
  sections: string[];
  summary?: string;
  ocrText: string;
  ocrConfidence: number;
  classificationConfidence: number;
  detectedObjects: string[];
  imageUrl: string;
  timestamp: number;
  caseId?: string;
  deviceId?: string;
}

export interface ProcessedDocument {
  id?: string;
  evidenceId: string;
  docType: string;
  typedDocId?: string;        // ID in the typed collection (firs/id_cards/police_reports)
  ocrText: string;
  ocrConfidence: number;
  classificationConfidence: number;
  extractionConfidence: number;
  fieldsExtracted: number;
  detectedObjects: string[];
  textPreview: string;
  imageUrl: string;
  timestamp: number;
  processedAt: number;
  deviceId?: string;
  caseId?: string;
  // ─── Dedup & Indexing ────────────────────
  imageHash?: string;          // Simple hash for dedup
  searchKeywords?: string[];   // Tokenized keywords for fast search
  // ─── Content-first fields (for EvidenceSearch display) ───
  title?: string;              // e.g. "FIR No. 0140/2022" or "Aadhaar Card - John Doe"
  subtitle?: string;           // e.g. "PS Kotwali, 12 Jan 2024"
  keyFields?: Record<string, string>;  // Top extracted fields for quick display
  processedYear?: number;
  processedMonth?: number;     // 1-12
  processedDay?: number;       // 1-31
}

export interface CaseItem {
  id?: string;
  caseId: string;          // e.g. "#2024-1045"
  title: string;
  description?: string;
  assignee: string;
  status: 'active' | 'closed' | 'pending';
  date: string;
  evidenceCount?: number;
  createdAt: number;
  updatedAt: number;
}

export interface UserItem {
  id?: string;
  name: string;
  role: string;
  email?: string;
  status: 'active' | 'inactive';
  caseCount: number;
  createdAt: number;
}

export interface AccessLogItem {
  id?: string;
  userId: string;
  userName: string;
  action: string;          // e.g. "Viewed evidence", "Created case"
  resource: string;        // e.g. "Evidence #123", "Case #2024-1045"
  timestamp: number;
  ipAddress?: string;
}

// ─── Collection References ─────────────────────────────────

const COLLECTIONS = {
  EVIDENCE: 'evidence',
  CASES: 'cases',
  USERS: 'users',
  ACCESS_LOGS: 'access_logs',
  ANALYTICS: 'analytics',
  // AI-organized collections
  FIRS: 'firs',
  ID_CARDS: 'id_cards',
  POLICE_REPORTS: 'police_reports',
  PROCESSED_DOCS: 'processed_documents',
};

// ─── Evidence (Snapshots) ──────────────────────────────────

class FirebaseService {

  // ═══ IMAGE DEDUP ═══

  /**
   * Generate a simple hash from base64 image data for dedup.
   * Uses a fast djb2-style hash on a sampled subset of the data.
   */
  generateImageHash(dataUrl: string): string {
    // Strip data URL prefix
    const raw = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
    // Sample every 100th char for speed on large base64 strings
    let hash = 5381;
    const step = Math.max(1, Math.floor(raw.length / 2000));
    for (let i = 0; i < raw.length; i += step) {
      hash = ((hash << 5) + hash + raw.charCodeAt(i)) & 0xffffffff;
    }
    return hash.toString(16);
  }

  /**
   * Check if an image with this hash already exists in processed_documents
   */
  async isDuplicate(imageHash: string): Promise<ProcessedDocument | null> {
    try {
      const q = query(
        collection(db, COLLECTIONS.PROCESSED_DOCS),
        where('imageHash', '==', imageHash),
        limit(1)
      );
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        const d = snapshot.docs[0];
        return { id: d.id, ...d.data() } as ProcessedDocument;
      }
      return null;
    } catch (error) {
      console.warn('Dedup check failed:', error);
      return null;
    }
  }

  // ═══ SEARCH INDEXING ═══

  /**
   * Build search keywords from OCR text and extracted fields
   * Like Google Photos — tokenize everything for instant search
   */
  buildSearchKeywords(ocrText: string, fields: Record<string, any>, docType: string): string[] {
    const keywords = new Set<string>();

    // Add doc type variations
    keywords.add(docType.toLowerCase());
    if (docType === 'FIR') { keywords.add('fir'); keywords.add('first information report'); }
    if (docType === 'ID_CARD') { keywords.add('id'); keywords.add('card'); keywords.add('identity'); keywords.add('aadhaar'); keywords.add('aadhar'); }
    if (docType === 'POLICE_REPORT') { keywords.add('police'); keywords.add('report'); }
    if (docType === 'CHARGE_SHEET') { keywords.add('charge'); keywords.add('sheet'); }

    // Tokenize extracted fields
    for (const [key, val] of Object.entries(fields)) {
      if (typeof val === 'string' && val && val !== 'N/A') {
        val.toLowerCase().split(/[\s,;:\/\-]+/).forEach(w => {
          if (w.length > 1) keywords.add(w);
        });
      }
      if (Array.isArray(val)) {
        val.forEach(v => {
          if (typeof v === 'string') {
            v.toLowerCase().split(/[\s,;:\/\-]+/).forEach(w => {
              if (w.length > 1) keywords.add(w);
            });
          }
        });
      }
    }

    // Tokenize first 500 chars of OCR text
    const textSample = (ocrText || '').substring(0, 500).toLowerCase();
    textSample.split(/[\s,;:\/\-\(\)\[\]\"\']+/).forEach(w => {
      if (w.length > 2) keywords.add(w);
    });

    return Array.from(keywords).slice(0, 200); // Firestore array limit-safe
  }

  /**
   * Build a human-readable title and subtitle for a processed document
   */
  buildDocTitle(docType: string, fields: Record<string, any>, ocrText?: string): { title: string; subtitle: string } {
    // Helper: find a value by trying multiple possible key names
    const pick = (...keys: string[]): string => {
      for (const k of keys) {
        const v = fields[k];
        if (typeof v === 'string' && v && v !== 'N/A' && v !== 'Unknown') return v;
      }
      return '';
    };

    // Build a short text snippet from OCR as last-resort subtitle
    const ocrSnippet = (ocrText || '').replace(/\s+/g, ' ').trim().substring(0, 80);

    switch (docType) {
      case 'FIR': {
        const firNo = pick('fir_no', 'firNo', 'FIR No', 'fir_number');
        const station = pick('police_station', 'policeStation', 'ps', 'station');
        const date = pick('date', 'Date', 'fir_date');
        const complainant = pick('complainant', 'Complainant');
        return {
          title: firNo ? `FIR No. ${firNo}` : 'First Information Report',
          subtitle: [station, date, complainant].filter(Boolean).join(' \u2022 ') || ocrSnippet || 'FIR Document',
        };
      }
      case 'ID_CARD': {
        const name = pick('name', 'Name', 'complainant', 'holder_name');
        const cardType = pick('cardType', 'card_type', 'type') || 'ID Card';
        const idNum = pick('idNumber', 'id_number', 'aadhaar_no', 'pan_no', 'voter_id');
        return {
          title: name ? `${cardType} \u2014 ${name}` : cardType,
          subtitle: idNum || ocrSnippet || 'Identity Document',
        };
      }
      case 'POLICE_REPORT':
      case 'CHARGE_SHEET': {
        const reportNo = pick('report_number', 'reportNumber', 'report_no');
        const date = pick('date', 'Date', 'report_date');
        const officer = pick('officer', 'Officer', 'investigating_officer');
        const label = docType === 'CHARGE_SHEET' ? 'Charge Sheet' : 'Police Report';
        return {
          title: reportNo ? `${label} ${reportNo}` : label,
          subtitle: [officer, date].filter(Boolean).join(' \u2022 ') || ocrSnippet || `${label} Document`,
        };
      }
      default:
        return { title: ocrSnippet ? ocrSnippet.substring(0, 50) : 'Document', subtitle: docType || 'Unclassified' };
    }
  }

  // ═══ EVIDENCE ═══

  /**
   * Save evidence metadata to Firestore
   * (Image itself goes to UploadThing; we store the URL here)
   */
  async saveEvidence(evidence: Omit<EvidenceItem, 'id'>): Promise<string> {
    try {
      const docRef = await addDoc(collection(db, COLLECTIONS.EVIDENCE), {
        ...evidence,
        timestamp: evidence.timestamp || Date.now(),
        createdAt: Timestamp.now(),
      });
      console.log('✅ Evidence saved to Firestore:', docRef.id);
      return docRef.id;
    } catch (error) {
      console.error('❌ Firestore save error:', error);
      throw error;
    }
  }

  /**
   * Get all evidence, newest first
   */
  async listEvidence(maxItems: number = 50): Promise<EvidenceItem[]> {
    try {
      const q = query(
        collection(db, COLLECTIONS.EVIDENCE),
        orderBy('timestamp', 'desc'),
        limit(maxItems)
      );
      const snapshot = await getDocs(q);
      const items: EvidenceItem[] = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      } as EvidenceItem));
      console.log(`📁 Found ${items.length} evidence items in Firestore`);
      return items;
    } catch (error) {
      console.error('❌ Firestore list error:', error);
      return [];
    }
  }

  /**
   * Get evidence by case ID
   */
  async getEvidenceByCase(caseId: string): Promise<EvidenceItem[]> {
    try {
      const q = query(
        collection(db, COLLECTIONS.EVIDENCE),
        where('caseId', '==', caseId),
        orderBy('timestamp', 'desc')
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      } as EvidenceItem));
    } catch (error) {
      console.error('❌ Firestore query error:', error);
      return [];
    }
  }

  /**
   * Delete evidence from Firestore
   */
  async deleteEvidence(id: string): Promise<void> {
    try {
      await deleteDoc(doc(db, COLLECTIONS.EVIDENCE, id));
      console.log('✅ Evidence deleted from Firestore:', id);
    } catch (error) {
      console.error('❌ Firestore delete error:', error);
      throw error;
    }
  }

  /**
   * Update evidence metadata (e.g., after AI processing)
   */
  async updateEvidence(id: string, updates: Partial<EvidenceItem>): Promise<void> {
    try {
      await updateDoc(doc(db, COLLECTIONS.EVIDENCE, id), {
        ...updates,
        updatedAt: Date.now(),
      });
      console.log('✅ Evidence updated:', id);
    } catch (error) {
      console.error('❌ Update evidence error:', error);
      throw error;
    }
  }

  /**
   * Get evidence count
   */
  async getEvidenceCount(): Promise<number> {
    try {
      const snapshot = await getDocs(collection(db, COLLECTIONS.EVIDENCE));
      return snapshot.size;
    } catch (error) {
      return 0;
    }
  }

  // ═══ CASES ═══

  /**
   * Create a new case
   */
  async createCase(caseData: Omit<CaseItem, 'id'>): Promise<string> {
    try {
      const docRef = await addDoc(collection(db, COLLECTIONS.CASES), {
        ...caseData,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      console.log('✅ Case created:', docRef.id);
      return docRef.id;
    } catch (error) {
      console.error('❌ Create case error:', error);
      throw error;
    }
  }

  /**
   * List all cases
   */
  async listCases(): Promise<CaseItem[]> {
    try {
      const q = query(
        collection(db, COLLECTIONS.CASES),
        orderBy('updatedAt', 'desc')
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      } as CaseItem));
    } catch (error) {
      console.error('❌ List cases error:', error);
      return [];
    }
  }

  /**
   * Update a case
   */
  async updateCase(id: string, updates: Partial<CaseItem>): Promise<void> {
    try {
      await updateDoc(doc(db, COLLECTIONS.CASES, id), {
        ...updates,
        updatedAt: Date.now(),
      });
      console.log('✅ Case updated:', id);
    } catch (error) {
      console.error('❌ Update case error:', error);
      throw error;
    }
  }

  /**
   * Delete a case
   */
  async deleteCase(id: string): Promise<void> {
    try {
      await deleteDoc(doc(db, COLLECTIONS.CASES, id));
      console.log('✅ Case deleted:', id);
    } catch (error) {
      console.error('❌ Delete case error:', error);
      throw error;
    }
  }

  // ═══ USERS ═══

  /**
   * Add a user
   */
  async addUser(user: Omit<UserItem, 'id'>): Promise<string> {
    try {
      const docRef = await addDoc(collection(db, COLLECTIONS.USERS), {
        ...user,
        createdAt: Date.now(),
      });
      console.log('✅ User added:', docRef.id);
      return docRef.id;
    } catch (error) {
      console.error('❌ Add user error:', error);
      throw error;
    }
  }

  /**
   * List all users
   */
  async listUsers(): Promise<UserItem[]> {
    try {
      const q = query(
        collection(db, COLLECTIONS.USERS),
        orderBy('createdAt', 'desc')
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      } as UserItem));
    } catch (error) {
      console.error('❌ List users error:', error);
      return [];
    }
  }

  /**
   * Update a user
   */
  async updateUser(id: string, updates: Partial<UserItem>): Promise<void> {
    try {
      await updateDoc(doc(db, COLLECTIONS.USERS, id), updates);
      console.log('✅ User updated:', id);
    } catch (error) {
      console.error('❌ Update user error:', error);
      throw error;
    }
  }

  /**
   * Delete a user
   */
  async deleteUser(id: string): Promise<void> {
    try {
      await deleteDoc(doc(db, COLLECTIONS.USERS, id));
      console.log('✅ User deleted:', id);
    } catch (error) {
      console.error('❌ Delete user error:', error);
      throw error;
    }
  }

  // ═══ ACCESS LOGS ═══

  /**
   * Log an access event
   */
  async logAccess(log: Omit<AccessLogItem, 'id'>): Promise<void> {
    try {
      await addDoc(collection(db, COLLECTIONS.ACCESS_LOGS), {
        ...log,
        timestamp: Date.now(),
      });
    } catch (error) {
      console.error('❌ Log access error:', error);
    }
  }

  /**
   * Get recent access logs
   */
  async getAccessLogs(maxItems: number = 100): Promise<AccessLogItem[]> {
    try {
      const q = query(
        collection(db, COLLECTIONS.ACCESS_LOGS),
        orderBy('timestamp', 'desc'),
        limit(maxItems)
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      } as AccessLogItem));
    } catch (error) {
      console.error('❌ Get access logs error:', error);
      return [];
    }
  }

  // ═══ ANALYTICS ═══

  /**
   * Save an analytics event
   */
  async logAnalyticsEvent(event: string, data: Record<string, any> = {}): Promise<void> {
    try {
      await addDoc(collection(db, COLLECTIONS.ANALYTICS), {
        event,
        data,
        timestamp: Date.now(),
      });
    } catch (error) {
      console.error('❌ Analytics log error:', error);
    }
  }

  /**
   * Get analytics data for a time range
   */
  async getAnalytics(startTime: number, endTime: number): Promise<any[]> {
    try {
      const q = query(
        collection(db, COLLECTIONS.ANALYTICS),
        where('timestamp', '>=', startTime),
        where('timestamp', '<=', endTime),
        orderBy('timestamp', 'desc')
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));
    } catch (error) {
      console.error('❌ Get analytics error:', error);
      return [];
    }
  }

  // ═══ AI-PROCESSED: FIR COLLECTION ═══

  /**
   * Save a processed FIR document
   */
  async saveFIR(fir: Omit<FIRDocument, 'id'>): Promise<string> {
    try {
      const docRef = await addDoc(collection(db, COLLECTIONS.FIRS), {
        ...fir,
        timestamp: fir.timestamp || Date.now(),
        createdAt: Timestamp.now(),
      });
      console.log('✅ FIR saved to Firestore:', docRef.id);
      return docRef.id;
    } catch (error) {
      console.error('❌ Save FIR error:', error);
      throw error;
    }
  }

  /**
   * List all FIRs
   */
  async listFIRs(maxItems: number = 50): Promise<FIRDocument[]> {
    try {
      const q = query(
        collection(db, COLLECTIONS.FIRS),
        orderBy('timestamp', 'desc'),
        limit(maxItems)
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FIRDocument));
    } catch (error) {
      console.error('❌ List FIRs error:', error);
      return [];
    }
  }

  /**
   * Search FIRs by FIR number
   */
  async searchFIRByNumber(firNo: string): Promise<FIRDocument[]> {
    try {
      const q = query(
        collection(db, COLLECTIONS.FIRS),
        where('firNo', '==', firNo)
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FIRDocument));
    } catch (error) {
      console.error('❌ Search FIR error:', error);
      return [];
    }
  }

  /**
   * Search FIRs by police station
   */
  async searchFIRByStation(station: string): Promise<FIRDocument[]> {
    try {
      const q = query(
        collection(db, COLLECTIONS.FIRS),
        where('policeStation', '==', station)
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FIRDocument));
    } catch (error) {
      console.error('❌ Search FIR by station error:', error);
      return [];
    }
  }

  /**
   * Delete a FIR document
   */
  async deleteFIR(id: string): Promise<void> {
    try {
      await deleteDoc(doc(db, COLLECTIONS.FIRS, id));
      console.log('✅ FIR deleted:', id);
    } catch (error) {
      console.error('❌ Delete FIR error:', error);
      throw error;
    }
  }

  // ═══ AI-PROCESSED: ID CARDS COLLECTION ═══

  /**
   * Save a processed ID card document
   */
  async saveIDCard(idCard: Omit<IDCardDocument, 'id'>): Promise<string> {
    try {
      const docRef = await addDoc(collection(db, COLLECTIONS.ID_CARDS), {
        ...idCard,
        timestamp: idCard.timestamp || Date.now(),
        createdAt: Timestamp.now(),
      });
      console.log('✅ ID Card saved to Firestore:', docRef.id);
      return docRef.id;
    } catch (error) {
      console.error('❌ Save ID Card error:', error);
      throw error;
    }
  }

  /**
   * List all ID cards
   */
  async listIDCards(maxItems: number = 50): Promise<IDCardDocument[]> {
    try {
      const q = query(
        collection(db, COLLECTIONS.ID_CARDS),
        orderBy('timestamp', 'desc'),
        limit(maxItems)
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as IDCardDocument));
    } catch (error) {
      console.error('❌ List ID Cards error:', error);
      return [];
    }
  }

  /**
   * Delete an ID card document
   */
  async deleteIDCard(id: string): Promise<void> {
    try {
      await deleteDoc(doc(db, COLLECTIONS.ID_CARDS, id));
      console.log('✅ ID Card deleted:', id);
    } catch (error) {
      console.error('❌ Delete ID Card error:', error);
      throw error;
    }
  }

  // ═══ AI-PROCESSED: POLICE REPORTS / CHARGE SHEETS ═══

  /**
   * Save a processed police report or charge sheet
   */
  async savePoliceReport(report: Omit<PoliceReportDocument, 'id'>): Promise<string> {
    try {
      const docRef = await addDoc(collection(db, COLLECTIONS.POLICE_REPORTS), {
        ...report,
        timestamp: report.timestamp || Date.now(),
        createdAt: Timestamp.now(),
      });
      console.log('✅ Police Report saved to Firestore:', docRef.id);
      return docRef.id;
    } catch (error) {
      console.error('❌ Save Police Report error:', error);
      throw error;
    }
  }

  /**
   * List all police reports
   */
  async listPoliceReports(maxItems: number = 50): Promise<PoliceReportDocument[]> {
    try {
      const q = query(
        collection(db, COLLECTIONS.POLICE_REPORTS),
        orderBy('timestamp', 'desc'),
        limit(maxItems)
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PoliceReportDocument));
    } catch (error) {
      console.error('❌ List Police Reports error:', error);
      return [];
    }
  }

  /**
   * Delete a police report
   */
  async deletePoliceReport(id: string): Promise<void> {
    try {
      await deleteDoc(doc(db, COLLECTIONS.POLICE_REPORTS, id));
      console.log('✅ Police Report deleted:', id);
    } catch (error) {
      console.error('❌ Delete Police Report error:', error);
      throw error;
    }
  }

  // ═══ PROCESSED DOCUMENTS (MASTER INDEX) ═══

  /**
   * Save to the master processed_documents index
   * Every AI-processed document gets an entry here for unified search
   */
  async saveProcessedDocument(doc_data: Omit<ProcessedDocument, 'id'>): Promise<string> {
    try {
      // Auto-add date index fields
      const d = new Date(doc_data.processedAt || Date.now());
      const enriched = {
        ...doc_data,
        processedYear: d.getFullYear(),
        processedMonth: d.getMonth() + 1,
        processedDay: d.getDate(),
        createdAt: Timestamp.now(),
      };
      const docRef = await addDoc(collection(db, COLLECTIONS.PROCESSED_DOCS), enriched);
      console.log('✅ Processed document indexed:', docRef.id);
      return docRef.id;
    } catch (error) {
      console.error('❌ Save processed doc error:', error);
      throw error;
    }
  }

  /**
   * List all processed documents
   */
  async listProcessedDocuments(maxItems: number = 50): Promise<ProcessedDocument[]> {
    try {
      const q = query(
        collection(db, COLLECTIONS.PROCESSED_DOCS),
        orderBy('processedAt', 'desc'),
        limit(maxItems)
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ProcessedDocument));
    } catch (error) {
      console.error('❌ List processed docs error:', error);
      return [];
    }
  }

  /**
   * Search processed documents by document type
   */
  async searchByDocType(docType: string): Promise<ProcessedDocument[]> {
    try {
      const q = query(
        collection(db, COLLECTIONS.PROCESSED_DOCS),
        where('docType', '==', docType),
        orderBy('processedAt', 'desc')
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ProcessedDocument));
    } catch (error) {
      console.error('❌ Search by doc type error:', error);
      return [];
    }
  }

  /**
   * Full-text search in processed documents (searches ocrText field)
   * NOTE: Firestore doesn't support native full-text search,
   * so we fetch all and filter client-side for small datasets.
   * For production, use Algolia or Elasticsearch.
   */
  async searchProcessedDocuments(searchTerm: string, maxItems: number = 100): Promise<ProcessedDocument[]> {
    try {
      const q = query(
        collection(db, COLLECTIONS.PROCESSED_DOCS),
        orderBy('processedAt', 'desc'),
        limit(maxItems)
      );
      const snapshot = await getDocs(q);
      const allDocs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ProcessedDocument));

      // Client-side search across multiple fields + keyword index
      const term = searchTerm.toLowerCase();
      return allDocs.filter(d =>
        d.ocrText?.toLowerCase().includes(term) ||
        d.docType?.toLowerCase().includes(term) ||
        d.textPreview?.toLowerCase().includes(term) ||
        d.title?.toLowerCase().includes(term) ||
        d.subtitle?.toLowerCase().includes(term) ||
        d.searchKeywords?.some(k => k.includes(term))
      );
    } catch (error) {
      console.error('❌ Search processed docs error:', error);
      return [];
    }
  }

  /**
   * Search by date range (year/month/day filters)
   */
  async searchByDateRange(
    filters: { year?: number; month?: number; day?: number; docType?: string },
    maxItems: number = 100
  ): Promise<ProcessedDocument[]> {
    try {
      // Fetch all docs sorted by processedAt, then filter client-side
      // This is more reliable than compound Firestore queries which need composite indexes
      const q = query(
        collection(db, COLLECTIONS.PROCESSED_DOCS),
        orderBy('processedAt', 'desc'),
        limit(maxItems)
      );
      const snapshot = await getDocs(q);
      let docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as ProcessedDocument));

      // Client-side filtering using the timestamp (epoch ms)
      return docs.filter(d => {
        if (filters.docType && filters.docType !== 'ALL' && d.docType !== filters.docType) return false;
        if (filters.year || filters.month || filters.day) {
          const date = new Date(d.processedAt || d.timestamp || 0);
          if (filters.year && date.getFullYear() !== filters.year) return false;
          if (filters.month && (date.getMonth() + 1) !== filters.month) return false;
          if (filters.day && date.getDate() !== filters.day) return false;
        }
        return true;
      });
    } catch (error) {
      console.error('\u274C Date range search error:', error);
      return [];
    }
  }

  /**
   * Delete a processed document and its typed collection entry
   */
  async deleteProcessedDocument(id: string): Promise<void> {
    try {
      // Get the doc first to find the typed collection entry and evidence link
      const docSnap = await getDoc(doc(db, COLLECTIONS.PROCESSED_DOCS, id));
      if (docSnap.exists()) {
        const data = docSnap.data() as ProcessedDocument;
        // Delete from typed collection (firs / id_cards / police_reports)
        if (data.typedDocId) {
          const typedCollection = this._getTypedCollection(data.docType);
          if (typedCollection) {
            await deleteDoc(doc(db, typedCollection, data.typedDocId)).catch(() => {});
          }
        }
        // Delete from evidence collection
        if (data.evidenceId) {
          await deleteDoc(doc(db, COLLECTIONS.EVIDENCE, data.evidenceId)).catch(() => {});
        }
      }
      // Delete from processed_documents
      await deleteDoc(doc(db, COLLECTIONS.PROCESSED_DOCS, id));
      console.log('✅ Processed document + evidence deleted:', id);
    } catch (error) {
      console.error('❌ Delete processed doc error:', error);
      throw error;
    }
  }

  /**
   * Get collection stats (count of docs in each AI collection)
   */
  async getCollectionStats(): Promise<Record<string, number>> {
    try {
      const [firs, idCards, reports, processed, evidence] = await Promise.all([
        getDocs(collection(db, COLLECTIONS.FIRS)),
        getDocs(collection(db, COLLECTIONS.ID_CARDS)),
        getDocs(collection(db, COLLECTIONS.POLICE_REPORTS)),
        getDocs(collection(db, COLLECTIONS.PROCESSED_DOCS)),
        getDocs(collection(db, COLLECTIONS.EVIDENCE)),
      ]);
      return {
        firs: firs.size,
        id_cards: idCards.size,
        police_reports: reports.size,
        processed_documents: processed.size,
        evidence: evidence.size,
      };
    } catch (error) {
      console.error('❌ Get stats error:', error);
      return { firs: 0, id_cards: 0, police_reports: 0, processed_documents: 0, evidence: 0 };
    }
  }

  // ═══ HELPERS ═══

  /**
   * Map doc_type to its Firestore collection name
   */
  private _getTypedCollection(docType: string): string | null {
    switch (docType) {
      case 'FIR': return COLLECTIONS.FIRS;
      case 'ID_CARD': return COLLECTIONS.ID_CARDS;
      case 'POLICE_REPORT':
      case 'CHARGE_SHEET': return COLLECTIONS.POLICE_REPORTS;
      default: return null;
    }
  }
}

export default new FirebaseService();
