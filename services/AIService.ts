/**
 * LookBack AI Pipeline Service
 * Connects the React Native app to the Python Flask AI server.
 *
 * The Flask server runs the full pipeline:
 *   Image → OCR → Classification → Field Extraction → YOLO Detection
 */

// Default: Flask server running on the development machine
// Change this to your server's IP when deploying
const AI_SERVER_URL = 'http://192.168.0.119:5000';

// ═══ Types ═══════════════════════════════════════════════════════

export interface OCRResult {
  raw_text: string;
  confidence: number;
  ocr_confidence?: number;
  language?: string;
  preprocessing?: string;
}

export interface ClassificationResult {
  doc_type: 'FIR' | 'ID_CARD' | 'CHARGE_SHEET' | 'POLICE_REPORT' | 'UNKNOWN';
  confidence: number;
  method: string;
}

export interface ExtractedFields {
  fir_no?: string;
  date?: string;
  sections?: string[];
  police_station?: string;
  complainant?: string;
  accused?: string;
  acts_referenced?: string[];
  section_descriptions?: Record<string, string>;
}

export interface FieldExtractionResult {
  status: string;
  fields_extracted: number;
  confidence: number;
  extracted_data: ExtractedFields;
}

export interface DetectionResult {
  tags: string[];
  confidence: number;
}

export interface PipelineSummary {
  detected_document_type: string;
  ocr_confidence: number;
  classification_confidence: number;
  extraction_confidence: number;
  fields_extracted: number;
  fir_no: string;
  date: string;
  sections: string[];
  detected_objects: string[];
  text_preview: string;
}

export interface PipelineResult {
  processing_status: 'success' | 'failed';
  processed_at: number;
  ocr: OCRResult;
  classification: ClassificationResult;
  field_extraction: FieldExtractionResult;
  detection: DetectionResult;
  summary: PipelineSummary;
}

// ═══ Service ═════════════════════════════════════════════════════

class AIService {
  private serverUrl: string;

  constructor(serverUrl: string = AI_SERVER_URL) {
    this.serverUrl = serverUrl;
  }

  /**
   * Update the server URL (e.g., when user changes it in Settings)
   */
  setServerUrl(url: string) {
    this.serverUrl = url;
  }

  getServerUrl(): string {
    return this.serverUrl;
  }

  /**
   * Check if the AI server is reachable
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.serverUrl}/health`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
      });
      if (response.ok) {
        const data = await response.json();
        return data.status === 'ok';
      }
      return false;
    } catch (error) {
      console.warn('🤖 AI Server unreachable:', error);
      return false;
    }
  }

  /**
   * Run the FULL pipeline on an image (OCR → Classification → Extraction → Detection)
   *
   * @param imageBase64 - Base64 encoded image (with or without data URL prefix)
   * @param aggressive - Use aggressive OCR preprocessing (default: true)
   * @returns Full pipeline result or null on failure
   */
  async processDocument(imageBase64: string, aggressive: boolean = true): Promise<PipelineResult | null> {
    try {
      console.log('🤖 Sending image to AI pipeline...');
      const startTime = Date.now();

      const response = await fetch(`${this.serverUrl}/process`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: imageBase64,
          aggressive,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('🤖 Pipeline error:', errorData);
        return null;
      }

      const result: PipelineResult = await response.json();
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`🤖 Pipeline complete in ${elapsed}s — Type: ${result.summary?.detected_document_type}`);

      return result;
    } catch (error) {
      console.error('🤖 AI Pipeline request failed:', error);
      return null;
    }
  }

  /**
   * Run OCR only on an image
   */
  async runOCR(imageBase64: string, aggressive: boolean = true): Promise<OCRResult | null> {
    try {
      const response = await fetch(`${this.serverUrl}/ocr`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: imageBase64, aggressive }),
      });

      if (!response.ok) return null;
      const data = await response.json();
      return data.ocr;
    } catch (error) {
      console.error('🤖 OCR request failed:', error);
      return null;
    }
  }

  /**
   * Run classification on OCR text
   */
  async classifyText(ocrText: string): Promise<ClassificationResult | null> {
    try {
      const response = await fetch(`${this.serverUrl}/classify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ocr_text: ocrText }),
      });

      if (!response.ok) return null;
      const data = await response.json();
      return data.classification;
    } catch (error) {
      console.error('🤖 Classification request failed:', error);
      return null;
    }
  }

  /**
   * Run field extraction on OCR text
   */
  async extractFields(ocrText: string): Promise<FieldExtractionResult | null> {
    try {
      const response = await fetch(`${this.serverUrl}/extract`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ocr_text: ocrText }),
      });

      if (!response.ok) return null;
      const data = await response.json();
      return data.field_extraction;
    } catch (error) {
      console.error('🤖 Extraction request failed:', error);
      return null;
    }
  }

  /**
   * Run YOLO detection on an image
   */
  async detectObjects(imageBase64: string): Promise<DetectionResult | null> {
    try {
      const response = await fetch(`${this.serverUrl}/detect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: imageBase64 }),
      });

      if (!response.ok) return null;
      const data = await response.json();
      return data.detection;
    } catch (error) {
      console.error('🤖 Detection request failed:', error);
      return null;
    }
  }
}

export default new AIService();
