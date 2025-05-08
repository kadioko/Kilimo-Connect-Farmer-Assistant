import AsyncStorage from '@react-native-async-storage/async-storage';
import { pestCacheService } from './pestCacheService';
import { pestDatabase } from '../data/pestDatabase';

interface Pest {
  name: string;
  confidence: number;
  treatment: string;
  prevention: string;
  symptoms: string;
  crop: string;
}

interface SyncData {
  lastSync: number;
  pendingUpdates: Array<{
    pest: string;
    action: 'add' | 'update' | 'delete';
    timestamp: number;
  }>;
}

const PEST_SYNC_KEY = 'pest_sync';
const SYNC_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

export const pestSyncService = {
  async initializeSync(): Promise<void> {
    try {
      const syncData = await this.getSyncData();
      
      // Check if we need to sync
      if (!syncData.lastSync || Date.now() - syncData.lastSync > SYNC_INTERVAL) {
        await this.syncWithServer();
      }

      // Start periodic sync
      setInterval(async () => {
        await this.syncWithServer();
      }, SYNC_INTERVAL);
    } catch (error) {
      console.error('Error initializing pest sync:', error);
    }
  },

  async addPest(pest: string): Promise<void> {
    try {
      const syncData = await this.getSyncData();
      syncData.pendingUpdates.push({
        pest,
        action: 'add',
        timestamp: Date.now()
      });
      await AsyncStorage.setItem(PEST_SYNC_KEY, JSON.stringify(syncData));
      
      // Save to local cache
      await pestCacheService.savePest(pestDatabase[pest]);
    } catch (error) {
      console.error('Error adding pest:', error);
    }
  },

  async updatePest(pest: string): Promise<void> {
    try {
      const syncData = await this.getSyncData();
      syncData.pendingUpdates.push({
        pest,
        action: 'update',
        timestamp: Date.now()
      });
      await AsyncStorage.setItem(PEST_SYNC_KEY, JSON.stringify(syncData));
      
      // Update local cache
      await pestCacheService.savePest(pestDatabase[pest]);
    } catch (error) {
      console.error('Error updating pest:', error);
    }
  },

  async deletePest(pest: string): Promise<void> {
    try {
      const syncData = await this.getSyncData();
      syncData.pendingUpdates.push({
        pest,
        action: 'delete',
        timestamp: Date.now()
      });
      await AsyncStorage.setItem(PEST_SYNC_KEY, JSON.stringify(syncData));
      
      // Remove from local cache
      await pestCacheService.clearCache();
    } catch (error) {
      console.error('Error deleting pest:', error);
    }
  },

  async syncWithServer(): Promise<void> {
    try {
      const syncData = await this.getSyncData();
      
      // Process pending updates
      for (const update of syncData.pendingUpdates) {
        switch (update.action) {
          case 'add':
            // In a real app, you would send this to the server
            console.log(`Adding pest: ${update.pest}`);
            break;
          case 'update':
            // In a real app, you would send this to the server
            console.log(`Updating pest: ${update.pest}`);
            break;
          case 'delete':
            // In a real app, you would send this to the server
            console.log(`Deleting pest: ${update.pest}`);
            break;
        }
      }

      // Clear pending updates
      syncData.pendingUpdates = [];
      syncData.lastSync = Date.now();
      await AsyncStorage.setItem(PEST_SYNC_KEY, JSON.stringify(syncData));

      // Update local cache with latest data
      await this.updateLocalCache();
    } catch (error) {
      console.error('Error syncing with server:', error);
    }
  },

  async updateLocalCache(): Promise<void> {
    try {
      // In a real app, you would fetch the latest data from the server
      // For now, we'll use the pest database
      for (const pestName in pestDatabase) {
        await pestCacheService.savePest(pestDatabase[pestName]);
      }
    } catch (error) {
      console.error('Error updating local cache:', error);
    }
  },

  async getSyncData(): Promise<SyncData> {
    try {
      const syncString = await AsyncStorage.getItem(PEST_SYNC_KEY);
      const syncData = syncString ? JSON.parse(syncString) : {
        lastSync: 0,
        pendingUpdates: []
      };
      return syncData;
    } catch (error) {
      return {
        lastSync: 0,
        pendingUpdates: []
      };
    }
  },
};
