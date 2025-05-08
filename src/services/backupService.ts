import AsyncStorage from '@react-native-async-storage/async-storage';
import { favoritesService } from './favoritesService';
import { pestCacheService } from './pestCacheService';

const BACKUP_KEY = 'app_backup';
const BACKUP_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

interface BackupData {
  timestamp: number;
  favorites: string[];
  pestCache: Record<string, any>;
  version: string;
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

      // Save backup
      await AsyncStorage.setItem(BACKUP_KEY, JSON.stringify(backupData));
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
        await pestCacheService.savePest(pestData);
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
      return backupString ? JSON.parse(backupString) : null;
    } catch (error) {
      console.error('Error getting backup:', error);
      return null;
    }
  },

  async deleteBackup(): Promise<void> {
    try {
      await AsyncStorage.removeItem(BACKUP_KEY);
      console.log('Backup deleted successfully');
    } catch (error) {
      console.error('Error deleting backup:', error);
    }
  }
};
