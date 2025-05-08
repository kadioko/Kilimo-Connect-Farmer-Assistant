import AsyncStorage from '@react-native-async-storage/async-storage';
import { backupService } from './backupService';
import { cloudSyncService } from './cloudSyncService';
import { versionControlService } from './versionControlService';

const SCHEDULE_KEY = 'backup_schedule';
const DEFAULT_SCHEDULE = {
  daily: true,
  weekly: true,
  monthly: true,
  lastBackup: null,
  lastSync: null,
  validationStatus: 'pending'
};

interface BackupSchedule {
  daily: boolean;
  weekly: boolean;
  monthly: boolean;
  lastBackup: number | null;
  lastSync: number | null;
  validationStatus: 'pending' | 'valid' | 'invalid';
}

export const backupSchedulerService = {
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
  },

  async setSchedule(schedule: Partial<BackupSchedule>): Promise<void> {
    try {
      const currentSchedule = await this.getSchedule();
      const newSchedule = {
        ...DEFAULT_SCHEDULE,
        ...currentSchedule,
        ...schedule
      };
      await AsyncStorage.setItem(SCHEDULE_KEY, JSON.stringify(newSchedule));
    } catch (error) {
      console.error('Error setting backup schedule:', error);
      throw error;
    }
  },

  async getSchedule(): Promise<BackupSchedule | null> {
    try {
      const scheduleString = await AsyncStorage.getItem(SCHEDULE_KEY);
      return scheduleString ? JSON.parse(scheduleString) : null;
    } catch (error) {
      console.error('Error getting backup schedule:', error);
      return null;
    }
  },

  private startBackupScheduler(): void {
    // Run initial backup check
    this.checkBackupSchedule();

    // Schedule periodic checks
    setInterval(() => {
      this.checkBackupSchedule();
    }, 60 * 60 * 1000); // Check every hour
  },

  private async checkBackupSchedule(): Promise<void> {
    try {
      const schedule = await this.getSchedule();
      if (!schedule) return;

      const now = Date.now();
      const lastBackup = schedule.lastBackup || 0;

      // Check daily backup
      if (schedule.daily && now - lastBackup >= 24 * 60 * 60 * 1000) {
        await this.createScheduledBackup('daily');
      }

      // Check weekly backup
      if (schedule.weekly && now - lastBackup >= 7 * 24 * 60 * 60 * 1000) {
        await this.createScheduledBackup('weekly');
      }

      // Check monthly backup
      if (schedule.monthly && now - lastBackup >= 30 * 24 * 60 * 60 * 1000) {
        await this.createScheduledBackup('monthly');
      }
    } catch (error) {
      console.error('Error checking backup schedule:', error);
    }
  },

  private async createScheduledBackup(type: 'daily' | 'weekly' | 'monthly'): Promise<void> {
    try {
      // Create backup
      await backupService.createBackup();

      // Create version
      await versionControlService.createNewVersion({
        added: [],
        removed: [],
        updated: []
      });

      // Update schedule
      const schedule = await this.getSchedule();
      if (schedule) {
        await this.setSchedule({
          ...schedule,
          lastBackup: Date.now(),
          validationStatus: 'pending'
        });
      }

      console.log(`Scheduled ${type} backup completed`);
    } catch (error) {
      console.error(`Error creating scheduled ${type} backup:`, error);
    }
  },

  private startSyncScheduler(): void {
    // Run initial sync check
    this.checkSyncSchedule();

    // Schedule periodic checks
    setInterval(() => {
      this.checkSyncSchedule();
    }, 4 * 60 * 60 * 1000); // Check every 4 hours
  },

  private async checkSyncSchedule(): Promise<void> {
    try {
      const schedule = await this.getSchedule();
      if (!schedule) return;

      const now = Date.now();
      const lastSync = schedule.lastSync || 0;

      // Check if sync is needed
      if (now - lastSync >= 4 * 60 * 60 * 1000) { // Every 4 hours
        await cloudSyncService.syncWithCloud();
        
        // Update schedule
        if (schedule) {
          await this.setSchedule({
            ...schedule,
            lastSync: Date.now()
          });
        }
      }
    } catch (error) {
      console.error('Error checking sync schedule:', error);
    }
  },

  private startValidationChecker(): void {
    // Run initial validation
    this.validateBackup();

    // Schedule periodic validation
    setInterval(() => {
      this.validateBackup();
    }, 24 * 60 * 60 * 1000); // Check every 24 hours
  },

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
        await this.createScheduledBackup('validation');
      }
    } catch (error) {
      console.error('Error validating backup:', error);
    }
  },

  private async validateBackupIntegrity(backup: any): Promise<boolean> {
    try {
      // Validate backup data structure
      if (!backup.timestamp || !backup.version) {
        return false;
      }

      // Validate data integrity
      const versionHistory = await versionControlService.getVersionHistory();
      if (!versionHistory || versionHistory.length === 0) {
        return false;
      }

      // Validate sync status
      const syncData = await cloudSyncService.getSyncData();
      if (!syncData || syncData.syncStatus !== 'synced') {
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error validating backup integrity:', error);
      return false;
    }
  }
};
