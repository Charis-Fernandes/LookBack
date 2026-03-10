import { UPLOADTHING_CONFIG } from '../config/uploadthing.config';

export interface SnapshotMetadata {
  timestamp: number;
  deviceId: string;
  userId: string;
  streamUrl: string;
  quality: string;
  caseId?: string;
}

class UploadThingService {
  private apiUrl = 'https://api.uploadthing.com/v6';
  private apiKey: string;

  constructor() {
    // Decode the base64 token to get the API key
    try {
      const decoded = JSON.parse(atob(UPLOADTHING_CONFIG.TOKEN));
      this.apiKey = decoded.apiKey;
    } catch (error) {
      console.error('Failed to decode UploadThing token:', error);
      this.apiKey = '';
    }
  }

  /**
   * Upload a snapshot from the stream to UploadThing
   * @param imageData - Base64 image data (data:image/jpeg;base64,...)
   * @param metadata - Additional metadata
   * @returns URL of the uploaded image
   */
  async uploadSnapshot(
    imageData: string,
    metadata: Partial<SnapshotMetadata> = {}
  ): Promise<string> {
    try {
      const timestamp = Date.now();
      const fileName = `snapshot_${timestamp}.jpg`;

      console.log('🔑 Using API Key:', this.apiKey.substring(0, 20) + '...');

      // Convert base64 to binary
      const base64Data = imageData.split(',')[1];
      const binaryString = atob(base64Data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      // Use simpler upload endpoint
      const formData = new FormData();
      const file: any = {
        uri: imageData,
        type: 'image/jpeg',
        name: fileName,
      };
      formData.append('file', file);

      const response = await fetch('https://uploadthing.com/api/uploadFiles', {
        method: 'POST',
        headers: {
          'x-uploadthing-api-key': this.apiKey,
        },
        body: formData,
      });

      if (!response.ok) {
        const error = await response.text();
        console.error('Upload response:', error);
        throw new Error(`Upload failed: ${error}`);
      }

      const result = await response.json();
      console.log('Upload result:', result);
      
      const fileUrl = result.data?.url || result.url || result.data?.[0]?.url;

      if (!fileUrl) {
        throw new Error('No URL returned from UploadThing');
      }

      console.log('✅ Snapshot uploaded to UploadThing:', fileUrl);
      return fileUrl;
    } catch (error) {
      console.error('❌ UploadThing upload error:', error);
      throw error;
    }
  }

  /**
   * Capture current frame from stream URL and upload
   * @param streamUrl - URL of the ESP32-CAM stream
   * @returns URL of the uploaded image
   */
  async captureAndUpload(
    streamUrl: string,
    metadata: Partial<SnapshotMetadata> = {}
  ): Promise<string> {
    try {
      // Capture snapshot from stream
      const snapshotUrl = streamUrl.replace('/stream', '/capture');
      
      // Fetch the image as blob
      const response = await fetch(snapshotUrl);
      if (!response.ok) {
        throw new Error('Failed to capture snapshot from stream');
      }

      const blob = await response.blob();
      
      // Convert blob to base64 for React Native
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });

      const base64Data = await base64Promise;

      // Create temporary file URI for upload
      return await this.uploadSnapshot(base64Data, {
        ...metadata,
        streamUrl,
        timestamp: Date.now(),
      });
    } catch (error) {
      console.error('❌ Capture and upload error:', error);
      throw error;
    }
  }

  /**
   * Upload evidence/case-related images
   * @param imageUri - Local file URI
   * @param caseId - Case identifier
   * @param metadata - Additional metadata
   */
  async uploadEvidence(
    imageUri: string,
    caseId: string,
    metadata: Partial<SnapshotMetadata> = {}
  ): Promise<string> {
    return this.uploadSnapshot(imageUri, {
      ...metadata,
      caseId,
      userId: metadata.userId || 'admin',
    });
  }

  /**
   * List uploaded files (requires UploadThing API)
   * Note: UploadThing doesn't provide a direct list API in free tier
   * You'll need to store URLs in AsyncStorage or a database
   */
  async listSnapshots(): Promise<string[]> {
    console.warn('UploadThing free tier does not support file listing');
    console.warn('Use AsyncStorage or a database to track uploaded URLs');
    return [];
  }

  /**
   * Delete a file from UploadThing
   * @param fileKey - The file key from UploadThing
   */
  async deleteFile(fileKey: string): Promise<void> {
    try {
      const response = await fetch(`${this.apiUrl}/deleteFiles`, {
        method: 'POST',
        headers: {
          'X-Uploadthing-Api-Key': this.apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fileKeys: [fileKey],
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to delete file');
      }

      console.log('✅ File deleted from UploadThing');
    } catch (error) {
      console.error('❌ Delete file error:', error);
      throw error;
    }
  }
}

export default new UploadThingService();
