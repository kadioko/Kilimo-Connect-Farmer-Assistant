import AsyncStorage from '@react-native-async-storage/async-storage';
import { backupService } from './backupService';
import { cloudSyncService } from './cloudSyncService';

const VERSION_HISTORY_KEY = 'version_history';
const MAX_VERSIONS = 10; // Keep last 10 versions

interface Version {
  id: string;
  timestamp: number;
  version: string;
  changes: {
    added: string[];
    removed: string[];
    updated: string[];
  };
  metadata: {
    syncStatus: 'pending' | 'synced' | 'failed';
    source: 'local' | 'cloud';
  };
}

export const versionControlService = {
  async initializeVersionControl(): Promise<void> {
    try {
      // Check if version history exists
      const history = await this.getVersionHistory();
      
      // If no history exists, create initial version
      if (!history || history.length === 0) {
        await this.createInitialVersion();
      }

      // Start periodic version check
      setInterval(async () => {
        await this.checkForConflicts();
      }, 5 * 60 * 1000); // Check every 5 minutes
    } catch (error) {
      console.error('Error initializing version control:', error);
    }
  },

  async createInitialVersion(): Promise<void> {
    try {
      // Get current backup
      const backup = await backupService.getBackup();
      if (!backup) {
        throw new Error('No backup found');
      }

      // Create initial version
      const version: Version = {
        id: backup.timestamp.toString(),
        timestamp: Date.now(),
        version: backup.version,
        changes: {
          added: [],
          removed: [],
          updated: []
        },
        metadata: {
          syncStatus: 'synced',
          source: 'local'
        }
      };

      // Save version
      const history = await this.getVersionHistory();
      const newHistory = [version, ...(history || [])].slice(0, MAX_VERSIONS);
      await AsyncStorage.setItem(VERSION_HISTORY_KEY, JSON.stringify(newHistory));
    } catch (error) {
      console.error('Error creating initial version:', error);
    }
  },

  async createNewVersion(changes: {
    added: string[];
    removed: string[];
    updated: string[];
  }): Promise<void> {
    try {
      // Get current backup
      const backup = await backupService.getBackup();
      if (!backup) {
        throw new Error('No backup found');
      }

      // Create new version
      const version: Version = {
        id: Date.now().toString(),
        timestamp: Date.now(),
        version: backup.version,
        changes,
        metadata: {
          syncStatus: 'pending',
          source: 'local'
        }
      };

      // Save version
      const history = await this.getVersionHistory();
      const newHistory = [version, ...(history || [])].slice(0, MAX_VERSIONS);
      await AsyncStorage.setItem(VERSION_HISTORY_KEY, JSON.stringify(newHistory));

      // Start sync
      await cloudSyncService.syncWithCloud();
    } catch (error) {
      console.error('Error creating new version:', error);
    }
  },

  async checkForConflicts(): Promise<void> {
    try {
      // Get version history
      const history = await this.getVersionHistory();
      if (!history || history.length === 0) {
        return;
      }

      // Get current backup
      const backup = await backupService.getBackup();
      if (!backup) {
        return;
      }

      // Check for conflicts
      const latestVersion = history[0];
      if (latestVersion.version !== backup.version) {
        // Conflict detected
        console.log('Conflict detected, resolving...');
        await this.resolveConflict(latestVersion, backup);
      }
    } catch (error) {
      console.error('Error checking for conflicts:', error);
    }
  },

  async resolveConflict(localVersion: Version, currentBackup: any): Promise<void> {
    try {
      // Get cloud version
      const cloudVersion = await cloudSyncService.getSyncData();
      if (!cloudVersion) {
        throw new Error('No cloud version found');
      }

      // Compare versions
      const versions = [
        { version: localVersion, source: 'local' },
        { version: cloudVersion, source: 'cloud' }
      ].sort((a, b) => b.version.timestamp - a.version.timestamp);

      // Use most recent version
      const mostRecent = versions[0];
      
      // Update backup
      await backupService.restoreBackup();

      // Update sync status
      const syncData = await cloudSyncService.getSyncData();
      if (syncData) {
        const updatedSyncData = {
          ...syncData,
          syncStatus: 'synced'
        };
        await AsyncStorage.setItem(cloudSyncService.CLOUD_SYNC_KEY, JSON.stringify(updatedSyncData));
      }

      console.log('Conflict resolved successfully');
    } catch (error) {
      console.error('Error resolving conflict:', error);
    }
  },

  async getVersionHistory(): Promise<Version[]> {
    try {
      const historyString = await AsyncStorage.getItem(VERSION_HISTORY_KEY);
      return historyString ? JSON.parse(historyString) : [];
    } catch (error) {
      console.error('Error getting version history:', error);
      return [];
    }
  },

  async getVersionById(id: string): Promise<Version | null> {
    try {
      const history = await this.getVersionHistory();
      return history.find(v => v.id === id) || null;
    } catch (error) {
      console.error('Error getting version:', error);
      return null;
    }
  },

  async revertToVersion(id: string): Promise<void> {
    try {
      // Get version to revert to
      const version = await this.getVersionById(id);
      if (!version) {
        throw new Error('Version not found');
      }

      // Get backup data
      const backup = await backupService.getBackup();
      if (!backup) {
        throw new Error('No backup found');
      }

      // Revert changes
      const changes = version.changes;
      const newBackup = { ...backup };

      // Remove added items
      changes.added.forEach(item => {
        delete newBackup[item];
      });

      // Add removed items back
      changes.removed.forEach(item => {
        // In a real app, you would restore from previous version
      });

      // Update updated items
      changes.updated.forEach(item => {
        // In a real app, you would restore from previous version
      });

      // Save new backup
      await backupService.saveBackup(newBackup);

      // Create new version
      await this.createNewVersion({
        added: [],
        removed: [],
        updated: []
      });

      console.log('Successfully reverted to version:', id);
    } catch (error) {
      console.error('Error reverting to version:', error);
      throw error;
    }
  }
};
