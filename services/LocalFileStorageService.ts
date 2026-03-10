import AsyncStorage from '@react-native-async-storage/async-storage';

export interface SnapshotMetadata {
  timestamp: number;
  deviceId: string;
  userId: string;
  streamUrl: string;
  quality: string;
  caseId?: string;
}

export interface StoredSnapshot {
  id: string;
  uri: string; // Base64 data URI
  timestamp: number;
  deviceId: string;
  quality: string;
  streamUrl: string;
  caseId?: string;
}

const STORAGE_KEY = '@lookback_snapshots';

class LocalFileStorageService {
  /**
   * Save a snapshot to local storage
   * @param imageData - Base64 image data (data:image/jpeg;base64,...)
   * @param metadata - Additional metadata
   * @returns Snapshot ID
   */
  async saveSnapshot(
    imageData: string,
    metadata: Partial<SnapshotMetadata> = {}
  ): Promise<string> {
    try {
      const timestamp = Date.now();
      const id = `snapshot_${timestamp}`;

      const snapshot: StoredSnapshot = {
        id,
        uri: imageData, // Store base64 data directly
        timestamp,
        deviceId: metadata.deviceId || 'esp32-cam',
        quality: metadata.quality || 'HD',
        streamUrl: metadata.streamUrl || '',
        caseId: metadata.caseId,
      };

      // Get existing snapshots
      const existing = await this.listSnapshots();
      
      // Add new snapshot at the beginning
      const updated = [snapshot, ...existing];
      
      // Keep only last 50 snapshots to avoid storage issues
      const limited = updated.slice(0, 50);
      
      // Save to AsyncStorage
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(limited));

      console.log('✅ Snapshot saved locally:', id);
      return imageData; // Return the data URI for display
    } catch (error) {
      console.error('❌ Local save error:', error);
      throw error;
    }
  }

  /**
   * Get all snapshots from local storage
   * @returns Array of StoredSnapshot objects
   */
  async listSnapshots(): Promise<StoredSnapshot[]> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEY);
      if (!data) return [];
      
      const snapshots: StoredSnapshot[] = JSON.parse(data);
      console.log(`📁 Found ${snapshots.length} snapshots`);
      return snapshots;
    } catch (error) {
      console.error('❌ List snapshots error:', error);
      return [];
    }
  }

  /**
   * Delete a snapshot
   * @param id - Snapshot ID
   */
  async deleteSnapshot(id: string): Promise<void> {
    try {
      const existing = await this.listSnapshots();
      const updated = existing.filter(s => s.id !== id);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      console.log('✅ Snapshot deleted:', id);
    } catch (error) {
      console.error('❌ Delete error:', error);
      throw error;
    }
  }

  /**
   * Delete all snapshots
   */
  async clearAllSnapshots(): Promise<void> {
    try {
      await AsyncStorage.removeItem(STORAGE_KEY);
      console.log('✅ All snapshots cleared');
    } catch (error) {
      console.error('❌ Clear all error:', error);
      throw error;
    }
  }

  /**
   * Get snapshot count
   */
  async getSnapshotCount(): Promise<number> {
    try {
      const snapshots = await this.listSnapshots();
      return snapshots.length;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Get storage size estimate (in bytes)
   */
  async getStorageSize(): Promise<number> {
    try {
      const snapshots = await this.listSnapshots();
      const dataString = JSON.stringify(snapshots);
      return new Blob([dataString]).size;
    } catch (error) {
      return 0;
    }
  }
}

export default new LocalFileStorageService();
