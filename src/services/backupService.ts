import AsyncStorage from '@react-native-async-storage/async-storage';
import { favoritesService } from './favoritesService';
import { pestCacheService } from './pestCacheService';

const BACKUP_KEY = 'app_backup';
const BACKUP_HISTORY_KEY = 'backup_history';
const BACKUP_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
const MAX_BACKUPS = 7; // Keep last 7 backups

export interface BackupData {
  timestamp: number;
  favorites: string[];
  pestCache: Record<string, any>;
  version: string;
}

export interface BackupHistoryItem {
  id: string;
  timestamp: number;
  size: number;
  version: string;
  status: 'success' | 'failed';
  error?: string;
}

export interface BackupMetrics {
  totalBackups: number;
  successfulBackups: number;
  failedBackups: number;
  lastBackup: number | null;
  lastSuccessfulBackup: number | null;
  backupSize: number;
  backupTime: number;
}

export const backupService = {
  async initializeBackup(): Promise<void> {
    try {
      // Check if backup exists
      const backupData = await this.getBackup();
      
      // If no backup exists, create one
      if (!backupData) {
        await this.createBackup();
      }

      // Start periodic backup
      setInterval(async () => {
        await this.createBackup();
      }, BACKUP_INTERVAL);
    } catch (error) {
      console.error('Error initializing backup:', error);
    }
  },

  async createBackup(): Promise<void> {
    try {
      // Get current data
      const favorites = await favoritesService.getFavorites();
      const pestCache = await pestCacheService.getAllPests();

      // Create backup data
      const backupData: BackupData = {
        timestamp: Date.now(),
        favorites: favorites.map(f => f.name),
        pestCache,
        version: '1.0.0'
      };

      // Convert to string and get size
      const backupString = JSON.stringify(backupData);
      const backupSize = backupString.length;

      // Save backup
      await AsyncStorage.setItem(BACKUP_KEY, backupString);

      // Update backup history
      const history = await this.getBackupHistory();
      const newHistoryItem: BackupHistoryItem = {
        id: Date.now().toString(),
        timestamp: Date.now(),
        size: backupSize,
        version: '1.0.0',
        status: 'success'
      };

      // Add new item and keep only last MAX_BACKUPS items
      const updatedHistory = [newHistoryItem, ...(history || [])].slice(0, MAX_BACKUPS);
      await AsyncStorage.setItem(BACKUP_HISTORY_KEY, JSON.stringify(updatedHistory));

      console.log('Backup created successfully');
    } catch (error) {
      console.error('Error creating backup:', error);
    }
  },

  async restoreBackup(): Promise<void> {
    try {
      // Get backup data
      const backupData = await this.getBackup();
      if (!backupData) {
        throw new Error('No backup found');
      }

      // Restore favorites
      await favoritesService.clearFavorites();
      for (const pestName of backupData.favorites) {
        await favoritesService.addFavorite(pestName);
      }

      // Restore pest cache
      await pestCacheService.clearCache();
      for (const [pestName, pestData] of Object.entries(backupData.pestCache)) {
        try {
          await pestCacheService.savePest(pestData as any);
        } catch (error) {
          console.error(`Error restoring pest ${pestName}:`, error);
        }
      }

      console.log('Backup restored successfully');
    } catch (error) {
      console.error('Error restoring backup:', error);
      throw error;
    }
  },

  async getBackup(): Promise<BackupData | null> {
    try {
      const backupString = await AsyncStorage.getItem(BACKUP_KEY);
      if (!backupString) return null;
      
      // Validate backup data
      const backupData = JSON.parse(backupString) as BackupData;
      if (!backupData.timestamp || !backupData.favorites || !backupData.pestCache || !backupData.version) {
        throw new Error('Invalid backup data');
      }

      return backupData;
    } catch (error) {
      console.error('Error getting backup:', error);
      return null;
    }
  },

  async getBackupHistory(): Promise<BackupHistoryItem[]> {
    try {
      const historyString = await AsyncStorage.getItem(BACKUP_HISTORY_KEY);
      return historyString ? JSON.parse(historyString) : [];
    } catch (error) {
      console.error('Error getting backup history:', error);
      return [];
    }
  },

  async getBackupMetrics(): Promise<BackupMetrics> {
    try {
      const history = await this.getBackupHistory();
      const lastBackup = history.length > 0 ? history[0].timestamp : 0;
      const lastSuccessfulBackup = history.find(h => h.status === 'success')?.timestamp || 0;

      return {
        totalBackups: history.length,
        successfulBackups: history.filter(h => h.status === 'success').length,
        failedBackups: history.filter(h => h.status === 'failed').length,
        lastBackup,
        lastSuccessfulBackup,
        backupSize: history.reduce((sum, item) => sum + item.size, 0),
        backupTime: history[0]?.timestamp || 0
      };
    } catch (error) {
      console.error('Error getting backup metrics:', error);
      return {
        totalBackups: 0,
        successfulBackups: 0,
        failedBackups: 0,
        lastBackup: null,
        lastSuccessfulBackup: null,
        backupSize: 0,
        backupTime: null
      };
    }
  },

  async deleteBackup(): Promise<void> {
    try {
      await AsyncStorage.removeItem(BACKUP_KEY);
      await AsyncStorage.removeItem(BACKUP_HISTORY_KEY);
      console.log('Backup and history deleted successfully');
    } catch (error) {
      console.error('Error deleting backup:', error);
      throw error;
    }
  }
};
