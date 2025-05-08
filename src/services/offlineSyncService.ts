import SQLite from 'react-native-sqlite-storage';
import { localDatabaseService } from './localDatabaseService';
import { backupService } from './backupService';
import { versionControlService } from './versionControlService';
import { databaseMigrationService } from './databaseMigrationService';

const SYNC_INTERVAL = 5 * 60 * 1000; // 5 minutes
const MAX_RETRIES = 3;
const RETRY_DELAY = 10000; // 10 seconds

interface SyncOperation {
  id: string;
  type: 'create' | 'update' | 'delete';
  table: string;
  data: any;
  status: 'pending' | 'completed' | 'failed';
  retries: number;
  lastAttempt: number;
  error?: string;
}

interface SyncState {
  lastSync: number;
  pendingOperations: SyncOperation[];
  syncInProgress: boolean;
  syncError?: string;
}

export const offlineSyncService = {
  syncState: {
    lastSync: 0,
    pendingOperations: [],
    syncInProgress: false,
    syncError: undefined
  } as SyncState,

  async initializeSync(): Promise<void> {
    try {
      // Initialize sync state
      await this.loadSyncState();

      // Start sync monitor
      this.startSyncMonitor();

      // Initialize sync operations table
      await this.initializeSyncOperations();

      console.log('Offline sync initialized successfully');
    } catch (error) {
      console.error('Error initializing offline sync:', error);
      throw error;
    }
  },

  async loadSyncState(): Promise<void> {
    try {
      const syncStateString = await AsyncStorage.getItem('sync_state');
      if (syncStateString) {
        this.syncState = JSON.parse(syncStateString);
      } else {
        this.syncState = {
          lastSync: 0,
          pendingOperations: [],
          syncInProgress: false,
          syncError: undefined
        };
      }
    } catch (error) {
      console.error('Error loading sync state:', error);
      throw error;
    }
  },

  async saveSyncState(): Promise<void> {
    try {
      await AsyncStorage.setItem('sync_state', JSON.stringify(this.syncState));
    } catch (error) {
      console.error('Error saving sync state:', error);
      throw error;
    }
  },

  async initializeSyncOperations(): Promise<void> {
    try {
      const db = SQLite.openDatabase(localDatabaseService.DATABASE_NAME);

      await db.executeSql(
        `CREATE TABLE IF NOT EXISTS sync_operations (
          id TEXT PRIMARY KEY,
          type TEXT NOT NULL,
          table TEXT NOT NULL,
          data TEXT NOT NULL,
          status TEXT NOT NULL,
          retries INTEGER DEFAULT 0,
          last_attempt TIMESTAMP,
          error TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`
      );

      console.log('Sync operations table initialized successfully');
    } catch (error) {
      console.error('Error initializing sync operations:', error);
      throw error;
    }
  },

  async addSyncOperation(operation: Omit<SyncOperation, 'id' | 'status' | 'retries' | 'lastAttempt'>): Promise<void> {
    try {
      const db = SQLite.openDatabase(localDatabaseService.DATABASE_NAME);

      const id = crypto.randomUUID();
      const timestamp = Date.now();

      await db.executeSql(
        `INSERT INTO sync_operations (id, type, table, data, status, retries, last_attempt, error) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          operation.type,
          operation.table,
          JSON.stringify(operation.data),
          'pending',
          0,
          timestamp,
          null
        ]
      );

      // Add to sync state
      this.syncState.pendingOperations.push({
        ...operation,
        id,
        status: 'pending',
        retries: 0,
        lastAttempt: timestamp
      });

      await this.saveSyncState();

      console.log(`Sync operation added: ${id}`);
    } catch (error) {
      console.error('Error adding sync operation:', error);
      throw error;
    }
  },

  async processSyncOperation(operation: SyncOperation): Promise<void> {
    try {
      // Mark operation as in progress
      operation.status = 'in_progress';
      await this.updateSyncOperation(operation);

      // Process operation based on type
      switch (operation.type) {
        case 'create':
          await this.processCreateOperation(operation);
          break;
        case 'update':
          await this.processUpdateOperation(operation);
          break;
        case 'delete':
          await this.processDeleteOperation(operation);
          break;
      }

      // Mark operation as completed
      operation.status = 'completed';
      operation.retries = 0;
      operation.lastAttempt = Date.now();
      operation.error = undefined;
      await this.updateSyncOperation(operation);

      // Remove from pending operations
      this.syncState.pendingOperations = this.syncState.pendingOperations.filter(
        op => op.id !== operation.id
      );
      await this.saveSyncState();

      console.log(`Sync operation completed: ${operation.id}`);
    } catch (error) {
      console.error(`Error processing sync operation ${operation.id}:`, error);

      // Handle retry logic
      operation.retries++;
      operation.lastAttempt = Date.now();
      operation.error = error.message;

      if (operation.retries >= MAX_RETRIES) {
        operation.status = 'failed';
      } else {
        operation.status = 'pending';
      }

      await this.updateSyncOperation(operation);
      await this.saveSyncState();

      throw error;
    }
  },

  async processCreateOperation(operation: SyncOperation): Promise<void> {
    try {
      const db = SQLite.openDatabase(localDatabaseService.DATABASE_NAME);

      // Get the data
      const data = JSON.parse(operation.data);

      // Process based on table
      switch (operation.table) {
        case 'pests':
          await localDatabaseService.addPest(data);
          break;
        case 'favorites':
          await localDatabaseService.addFavorite(data);
          break;
        case 'history':
          await localDatabaseService.addHistory(data);
          break;
      }

      // Create version
      await versionControlService.createNewVersion({
        added: [operation.table],
        removed: [],
        updated: []
      });

      // Create backup
      await backupService.createBackup();
    } catch (error) {
      console.error('Error processing create operation:', error);
      throw error;
    }
  },

  async processUpdateOperation(operation: SyncOperation): Promise<void> {
    try {
      const db = SQLite.openDatabase(localDatabaseService.DATABASE_NAME);

      // Get the data
      const data = JSON.parse(operation.data);

      // Process based on table
      switch (operation.table) {
        case 'pests':
          await localDatabaseService.updatePest(data);
          break;
        case 'favorites':
          await localDatabaseService.updateFavorite(data);
          break;
        case 'history':
          await localDatabaseService.updateHistory(data);
          break;
      }

      // Create version
      await versionControlService.createNewVersion({
        added: [],
        removed: [],
        updated: [operation.table]
      });

      // Create backup
      await backupService.createBackup();
    } catch (error) {
      console.error('Error processing update operation:', error);
      throw error;
    }
  },

  async processDeleteOperation(operation: SyncOperation): Promise<void> {
    try {
      const db = SQLite.openDatabase(localDatabaseService.DATABASE_NAME);

      // Get the data
      const data = JSON.parse(operation.data);

      // Process based on table
      switch (operation.table) {
        case 'pests':
          await localDatabaseService.deletePest(data.id);
          break;
        case 'favorites':
          await localDatabaseService.deleteFavorite(data.id);
          break;
        case 'history':
          await localDatabaseService.deleteHistory(data.id);
          break;
      }

      // Create version
      await versionControlService.createNewVersion({
        added: [],
        removed: [operation.table],
        updated: []
      });

      // Create backup
      await backupService.createBackup();
    } catch (error) {
      console.error('Error processing delete operation:', error);
      throw error;
    }
  },

  async updateSyncOperation(operation: SyncOperation): Promise<void> {
    try {
      const db = SQLite.openDatabase(localDatabaseService.DATABASE_NAME);

      await db.executeSql(
        `UPDATE sync_operations 
         SET status = ?, 
             retries = ?, 
             last_attempt = ?, 
             error = ?
         WHERE id = ?`,
        [
          operation.status,
          operation.retries,
          operation.lastAttempt,
          operation.error,
          operation.id
        ]
      );

      // Update sync state
      const index = this.syncState.pendingOperations.findIndex(
        op => op.id === operation.id
      );
      if (index !== -1) {
        this.syncState.pendingOperations[index] = operation;
        await this.saveSyncState();
      }
    } catch (error) {
      console.error('Error updating sync operation:', error);
      throw error;
    }
  },

  async startSyncMonitor(): Promise<void> {
    try {
      // Start periodic sync
      setInterval(async () => {
        if (!this.syncState.syncInProgress && this.syncState.pendingOperations.length > 0) {
          await this.performSync();
        }
      }, SYNC_INTERVAL);

      // Start network status monitor
      this.startNetworkMonitor();
    } catch (error) {
      console.error('Error starting sync monitor:', error);
      throw error;
    }
  },

  async performSync(): Promise<void> {
    try {
      // Mark sync as in progress
      this.syncState.syncInProgress = true;
      await this.saveSyncState();

      // Process pending operations
      for (const operation of this.syncState.pendingOperations) {
        try {
          await this.processSyncOperation(operation);
        } catch (error) {
          console.error('Error processing sync operation:', error);
          continue;
        }
      }

      // Update last sync time
      this.syncState.lastSync = Date.now();
      this.syncState.syncInProgress = false;
      this.syncState.syncError = undefined;
      await this.saveSyncState();

      console.log('Sync completed successfully');
    } catch (error) {
      console.error('Error performing sync:', error);
      this.syncState.syncInProgress = false;
      this.syncState.syncError = error.message;
      await this.saveSyncState();
      throw error;
    }
  },

  startNetworkMonitor(): void {
    // Check network status every minute
    setInterval(async () => {
      try {
        const isConnected = await this.checkNetworkConnection();
        
        if (isConnected && this.syncState.pendingOperations.length > 0) {
          await this.performSync();
        }
      } catch (error) {
        console.error('Error checking network status:', error);
      }
    }, 60 * 1000); // Check every minute
  },

  async checkNetworkConnection(): Promise<boolean> {
    try {
      // Check internet connection
      const isConnected = await NetworkInfo.isConnected();
      return isConnected;
    } catch (error) {
      console.error('Error checking network connection:', error);
      return false;
    }
  }
};
