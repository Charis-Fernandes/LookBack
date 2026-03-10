import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEYS = {
  SNAPSHOTS: '@lookback_snapshots',
  EVIDENCE: '@lookback_evidence',
};

export interface StoredSnapshot {
  id: string;
  url: string;
  timestamp: number;
  deviceId: string;
  quality: string;
  streamUrl: string;
  caseId?: string;
}

class LocalStorageService {
  /**
   * Save snapshot URL to local storage
   */
  async saveSnapshot(snapshot: StoredSnapshot): Promise<void> {
    try {
      const existing = await this.getAllSnapshots();
      const updated = [snapshot, ...existing];
      await AsyncStorage.setItem(STORAGE_KEYS.SNAPSHOTS, JSON.stringify(updated));
      console.log('✅ Snapshot saved to local storage');
    } catch (error) {
      console.error('❌ Save snapshot error:', error);
      throw error;
    }
  }

  /**
   * Get all snapshots from local storage
   */
  async getAllSnapshots(): Promise<StoredSnapshot[]> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.SNAPSHOTS);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('❌ Get snapshots error:', error);
      return [];
    }
  }

  /**
   * Delete a snapshot from local storage
   */
  async deleteSnapshot(id: string): Promise<void> {
    try {
      const existing = await this.getAllSnapshots();
      const updated = existing.filter(s => s.id !== id);
      await AsyncStorage.setItem(STORAGE_KEYS.SNAPSHOTS, JSON.stringify(updated));
      console.log('✅ Snapshot deleted from local storage');
    } catch (error) {
      console.error('❌ Delete snapshot error:', error);
      throw error;
    }
  }

  /**
   * Clear all snapshots
   */
  async clearAllSnapshots(): Promise<void> {
    try {
      await AsyncStorage.removeItem(STORAGE_KEYS.SNAPSHOTS);
      console.log('✅ All snapshots cleared');
    } catch (error) {
      console.error('❌ Clear snapshots error:', error);
      throw error;
    }
  }

  /**
   * Get snapshots for a specific case
   */
  async getSnapshotsByCase(caseId: string): Promise<StoredSnapshot[]> {
    try {
      const all = await this.getAllSnapshots();
      return all.filter(s => s.caseId === caseId);
    } catch (error) {
      console.error('❌ Get snapshots by case error:', error);
      return [];
    }
  }
}

export default new LocalStorageService();
