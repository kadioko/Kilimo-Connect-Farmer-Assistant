import AsyncStorage from '@react-native-async-storage/async-storage';
import { backupService } from './backupService';
import { cloudSyncService } from './cloudSyncService';
import { versionControlService } from './versionControlService';

interface AsyncStorageType {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
  clear(): Promise<void>;
  getAllKeys(): Promise<readonly string[]>;
  multiGet(keys: string[]): Promise<readonly [string, string | null][]>;
  multiSet(keyValuePairs: [string, string][]): Promise<void>;
  multiRemove(keys: string[]): Promise<void>;
  mergeItem(key: string, value: string): Promise<void>;
}

const asyncStorage: AsyncStorageType = AsyncStorage as AsyncStorageType;

const SCHEDULE_KEY = 'backup_schedule';
const DEFAULT_SCHEDULE = {
  daily: true,
  weekly: true,
  monthly: true,
  dailyInterval: 24 * 60 * 60 * 1000, // 24 hours
  weeklyInterval: 7 * 24 * 60 * 60 * 1000, // 7 days
  monthlyInterval: 30 * 24 * 60 * 60 * 1000, // 30 days
  syncInterval: 4 * 60 * 60 * 1000, // 4 hours
  lastBackup: null,
  lastSync: null,
  validationStatus: 'pending',
  lastValidation: null
} as const;

export interface BackupSchedule {
  daily: boolean;
  weekly: boolean;
  monthly: boolean;
  dailyInterval: number;
  weeklyInterval: number;
  monthlyInterval: number;
  syncInterval: number;
  lastBackup: number | null;
  lastSync: number | null;
  validationStatus: 'pending' | 'valid' | 'invalid';
  lastValidation: number | null;
}

interface BackupData {
  id: string;
  timestamp: number;
  data: any;
  type: 'pests' | 'favorites' | 'history';
  status: 'pending' | 'completed' | 'failed';
  error?: string;
}

interface BackupHistory {
  id: string;
  timestamp: number;
  type: 'full' | 'incremental';
  size: number;
  status: 'completed' | 'failed';
  error?: string;
}

interface BackupStats {
  totalBackups: number;
  successfulBackups: number;
  failedBackups: number;
  lastBackup: number | null;
  nextBackup: number | null;
  storageUsage: number;
}

interface BackupConfig {
  enabled: boolean;
  frequency: 'daily' | 'weekly' | 'monthly';
  retentionPeriod: number;
  maxBackups: number;
  compressionEnabled: boolean;
  encryptionEnabled: boolean;
  storageLocation: 'local' | 'cloud';
  lastBackup: number | null;
  nextBackup: number | null;
}

interface BackupScheduleStats {
  totalSchedules: number;
  activeSchedules: number;
  completedSchedules: number;
  failedSchedules: number;
  pendingSchedules: number;
  lastSchedule: number | null;
  nextSchedule: number | null;
}

interface BackupMetrics {
  backupSize: number;
  backupTime: number;
  compressionRatio: number;
  encryptionTime: number;
  storageUsage: number;
  networkUsage: number;
}

interface BackupPerformance {
  backupSpeed: number;
  restoreSpeed: number;
  compressionSpeed: number;
  encryptionSpeed: number;
  networkSpeed: number;
}

interface BackupHealth {
  status: 'healthy' | 'warning' | 'critical';
  issues: string[];
  recommendations: string[];
  lastCheck: number;
  nextCheck: number;
}

interface BackupAudit {
  id: string;
  timestamp: number;
  type: 'backup' | 'restore' | 'schedule';
  action: 'create' | 'update' | 'delete';
  user: string;
  ip: string;
  device: string;
  location: string;
  success: boolean;
  duration: number;
  size: number;
}

export class BackupSchedulerService {
  private static instance: BackupSchedulerService;
  private constructor() {}

  public static getInstance(): BackupSchedulerService {
    if (!BackupSchedulerService.instance) {
      BackupSchedulerService.instance = new BackupSchedulerService();
    }
    return BackupSchedulerService.instance;
  }

  private async logBackupFailure(type: 'daily' | 'weekly' | 'monthly' | 'schedule', error: any): Promise<void> {
    try {
      const timestamp = Date.now();
      const logEntry = {
        type: 'backup_failure',
        timestamp,
        backupType: type,
        errorMessage: error.message || 'Unknown error',
        stackTrace: error.stack || 'No stack trace available',
        errorType: error.constructor.name || 'UnknownError',
        context: {
          device: 'mobile',
          platform: 'react-native',
          timestamp: new Date(timestamp).toISOString()
        }
      };
      
      await asyncStorage.setItem(`backup_failure_${timestamp}`, JSON.stringify(logEntry));
      console.error(`Backup failure logged: ${error.message || 'Unknown error'}`);
    } catch (logError) {
      console.error('Error logging backup failure:', logError);
    }
  }

  private async logBackupSuccess(type: 'daily' | 'weekly' | 'monthly', result: any): Promise<void> {
    try {
      const timestamp = Date.now();
      const logEntry = {
        type: 'backup_success',
        timestamp,
        backupType: type,
        backupSize: result.size,
        backupDuration: result.duration,
        backupLocation: result.location,
        backupVersion: result.version,
        context: {
          device: 'mobile',
          platform: 'react-native',
          timestamp: new Date(timestamp).toISOString()
        }
      };
      
      await asyncStorage.setItem(`backup_success_${timestamp}`, JSON.stringify(logEntry));
      console.log(`Backup success logged: ${type} backup completed`);
    } catch (logError) {
      console.error('Error logging backup success:', logError);
    }
  }

  private async logValidationFailure(error: Error): Promise<void> {
    try {
      const timestamp = Date.now();
      const logEntry = {
        type: 'validation_failure',
        timestamp,
        errorMessage: error.message,
        stackTrace: error.stack,
        context: {
          device: 'mobile',
          platform: 'react-native',
          timestamp: new Date(timestamp).toISOString()
        }
      };
      
      await asyncStorage.setItem(`validation_failure_${timestamp}`, JSON.stringify(logEntry));
      console.error(`Validation failure logged: ${error.message}`);
    } catch (logError) {
      console.error('Error logging validation failure:', logError);
    }
  }

  private async logSyncSuccess(result: any): Promise<void> {
    try {
      const timestamp = Date.now();
      const logEntry = {
        type: 'sync_success',
        timestamp,
        syncType: 'cloud',
        syncSize: result.size,
        syncDuration: result.duration,
        syncLocation: result.location,
        syncVersion: result.version,
        context: {
          device: 'mobile',
          platform: 'react-native',
          timestamp: new Date(timestamp).toISOString()
        }
      };
      
      await asyncStorage.setItem(`sync_success_${timestamp}`, JSON.stringify(logEntry));
      console.log('Sync success logged: Cloud sync completed');
    } catch (logError) {
      console.error('Error logging sync success:', logError);
    }
  }

  private async logSyncFailure(error: any): Promise<void> {
    try {
      const timestamp = Date.now();
      const logEntry = {
        type: 'sync_failure',
        timestamp,
        syncType: 'cloud',
        errorMessage: error.message || 'Unknown error',
        stackTrace: error.stack || 'No stack trace available',
        errorType: error.constructor.name || 'UnknownError',
        context: {
          device: 'mobile',
          platform: 'react-native',
          timestamp: new Date(timestamp).toISOString()
        }
      };
      
      await asyncStorage.setItem(`sync_failure_${timestamp}`, JSON.stringify(logEntry));
      console.error(`Sync failure logged: ${error.message || 'Unknown error'}`);
    } catch (logError) {
      console.error('Error logging sync failure:', logError);
    }
  }

  async initializeScheduler(): Promise<void> {
    try {
      // Load schedule settings
      const schedule = await this.getSchedule();
      if (!schedule) {
        await this.setSchedule(DEFAULT_SCHEDULE);
      }

      // Start backup scheduler
      this.startBackupScheduler();

      // Start sync scheduler
      this.startSyncScheduler();

      // Start validation checker
      this.startValidationChecker();
    } catch (error) {
      console.error('Error initializing backup scheduler:', error);
    }
  }

  async setSchedule(schedule: Partial<BackupSchedule>): Promise<void> {
    try {
      const currentSchedule = await this.getSchedule();
      const newSchedule = {
        ...DEFAULT_SCHEDULE,
        ...currentSchedule,
        ...schedule
      };
      
      // Validate schedule configuration
      if (!newSchedule.daily && !newSchedule.weekly && !newSchedule.monthly) {
        throw new Error('At least one backup frequency must be enabled');
      }

      await asyncStorage.setItem(SCHEDULE_KEY, JSON.stringify(newSchedule));
      console.log('Backup schedule updated successfully');
    } catch (error) {
      console.error('Error setting backup schedule:', error);
      await this.logBackupFailure('schedule', error);
      throw error;
    }
  }

  async getSchedule(): Promise<BackupSchedule | null> {
    try {
      const scheduleString = await asyncStorage.getItem(SCHEDULE_KEY);
      return scheduleString ? JSON.parse(scheduleString) : null;
    } catch (error) {
      console.error('Error getting backup schedule:', error);
      return null;
    }
  }

  private startBackupScheduler(): void {
    // Run initial backup check
    this.checkBackupSchedule();

    // Schedule periodic checks
    setInterval(() => {
      this.checkBackupSchedule();
    }, 60 * 60 * 1000); // Check every hour
  }

  private async checkBackupSchedule(): Promise<void> {
    try {
      const schedule = await this.getSchedule();
      if (!schedule) return;

      const now = Date.now();
      const lastBackup = schedule.lastBackup || 0;

      // Check daily backup
      if (schedule.daily && now - lastBackup >= schedule.dailyInterval) {
        await this.createScheduledBackup('daily');
      }

      // Check weekly backup
      if (schedule.weekly && now - lastBackup >= schedule.weeklyInterval) {
        await this.createScheduledBackup('weekly');
      }

      // Check monthly backup
      if (schedule.monthly && now - lastBackup >= schedule.monthlyInterval) {
        await this.createScheduledBackup('monthly');
      }

      // Check validation status
      if (schedule.validationStatus === 'pending' && 
          (schedule.lastValidation === null || now - schedule.lastValidation >= schedule.dailyInterval)) {
        await this.validateBackup();
      }
    } catch (error) {
      console.error('Error checking backup schedule:', error);
      await this.logBackupFailure('schedule', error);
    }
  }

  private async createScheduledBackup(type: 'daily' | 'weekly' | 'monthly'): Promise<void> {
    try {
      // Create backup
      const backupResult = await backupService.createBackup();
      
      // Create version
      await versionControlService.createNewVersion({
        added: [],
        removed: [],
        updated: []
      });

      // Update schedule
      const schedule = await this.getSchedule();
      if (!schedule) {
        throw new Error('Failed to get backup schedule');
      }

      await this.setSchedule({
        ...schedule,
        lastBackup: Date.now(),
        validationStatus: 'pending',
        lastValidation: null
      });

      // Log backup success
      await this.logBackupSuccess(type, backupResult);
      console.log(`Scheduled ${type} backup completed successfully`);
    } catch (error) {
      console.error(`Error creating scheduled ${type} backup:`, error);
      // Log backup failure
      await this.logBackupFailure(type, error);
    }
  }

  private startSyncScheduler(): void {
    // Run initial sync check
    this.checkSyncSchedule();

    // Schedule periodic checks
    setInterval(() => {
      this.checkSyncSchedule();
    }, 4 * 60 * 60 * 1000); // Check every 4 hours
  }

  private async checkSyncSchedule(): Promise<void> {
    try {
      const schedule = await this.getSchedule();
      if (!schedule) return;

      const now = Date.now();
      const lastSync = schedule.lastSync || 0;

      // Check if sync is needed
      if (now - lastSync >= schedule.syncInterval) {
        const syncResult = await cloudSyncService.syncWithCloud();
        
        // Update schedule
        await this.setSchedule({
          ...schedule,
          lastSync: Date.now()
        });

        // Log sync success
        await this.logSyncSuccess(syncResult);
      }
    } catch (error) {
      console.error('Error checking sync schedule:', error);
      await this.logSyncFailure(error);
    }
  }

  private startValidationChecker(): void {
    // Run initial validation
    this.validateBackup();

    // Schedule periodic validation
    setInterval(() => {
      this.validateBackup();
    }, 24 * 60 * 60 * 1000); // Check every 24 hours
  }

  private async validateBackup(): Promise<void> {
    try {
      // Get backup
      const backup = await backupService.getBackup();
      if (!backup) {
        throw new Error('No backup found');
      }

      // Validate backup integrity
      const isValid = await this.validateBackupIntegrity(backup);
      
      // Update validation status
      const schedule = await this.getSchedule();
      if (schedule) {
        await this.setSchedule({
          ...schedule,
          validationStatus: isValid ? 'valid' : 'invalid'
        });
      }

      if (!isValid) {
        // Create new backup if validation fails
        await this.createScheduledBackup('daily');
      }
    } catch (error) {
      console.error('Error validating backup:', error);
    }
  }

  private async validateBackupIntegrity(backup: any): Promise<boolean> {
    try {
      // Validate backup data structure
      if (!backup.timestamp || !backup.version) {
        throw new Error('Invalid backup structure: missing required fields');
      }

      // Validate data integrity
      const versionHistory = await versionControlService.getVersionHistory();
      if (!versionHistory || versionHistory.length === 0) {
        throw new Error('No version history found');
      }

      // Validate sync status
      const syncData = await cloudSyncService.getSyncData();
      if (!syncData || syncData.syncStatus !== 'synced') {
        throw new Error('Backup not synced with cloud');
      }

      return true;
    } catch (error) {
      console.error('Error validating backup integrity:', error);
      // Log validation failure
      await this.logValidationFailure(error as Error);
      return false;
    }
  }
};
