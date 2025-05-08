import { BackupSchedulerService } from './backupSchedulerService';
import { BackupValidationService } from './backupValidationService';

export const backupSchedulerService = BackupSchedulerService.getInstance();
export const backupValidationService = BackupValidationService.getInstance();
