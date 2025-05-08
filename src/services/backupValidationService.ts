import { backupService } from './backupService';
import { BackupData } from './backupService';

export interface BackupValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  dataIntegrity: {
    favorites: boolean;
    pests: boolean;
    version: boolean;
  };
  performance: {
    loadTime: number;
    size: number;
  };
}

export class BackupValidationService {
  private static instance: BackupValidationService;
  private constructor() {}

  static getInstance(): BackupValidationService {
    if (!BackupValidationService.instance) {
      BackupValidationService.instance = new BackupValidationService();
    }
    return BackupValidationService.instance;
  }

  async validateBackup(): Promise<BackupValidationResult> {
    const result: BackupValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
      dataIntegrity: {
        favorites: true,
        pests: true,
        version: true,
      },
      performance: {
        loadTime: 0,
        size: 0,
      },
    };

    try {
      const startTime = Date.now();
      const backup = await backupService.getBackup();
      const loadTime = Date.now() - startTime;
      result.performance.loadTime = loadTime;

      if (!backup) {
        result.isValid = false;
        result.errors.push('No backup data found');
        return result;
      }

      // Validate backup data
      this.validateTimestamp(backup, result);
      this.validateFavorites(backup, result);
      this.validatePests(backup, result);
      this.validateVersion(backup, result);

      // Check backup size
      const backupString = JSON.stringify(backup);
      result.performance.size = backupString.length;
      if (result.performance.size > 1000000) { // 1MB
        result.warnings.push('Backup size is large (>1MB)');
      }

    } catch (error) {
      result.isValid = false;
      result.errors.push(`Error validating backup: ${error.message}`);
    }

    return result;
  }

  private validateTimestamp(backup: BackupData, result: BackupValidationResult) {
    if (!backup.timestamp) {
      result.isValid = false;
      result.errors.push('Missing timestamp in backup');
      return;
    }

    const timestamp = new Date(backup.timestamp);
    if (isNaN(timestamp.getTime())) {
      result.isValid = false;
      result.errors.push('Invalid timestamp in backup');
    }
  }

  private validateFavorites(backup: BackupData, result: BackupValidationResult) {
    if (!backup.favorites || !Array.isArray(backup.favorites)) {
      result.isValid = false;
      result.errors.push('Invalid favorites format');
      return;
    }

    if (backup.favorites.length > 100) {
      result.warnings.push('Large number of favorites (>100)');
    }

    result.dataIntegrity.favorites = backup.favorites.length > 0;
  }

  private validatePests(backup: BackupData, result: BackupValidationResult) {
    if (!backup.pestCache || typeof backup.pestCache !== 'object') {
      result.isValid = false;
      result.errors.push('Invalid pest cache format');
      return;
    }

    const pestCount = Object.keys(backup.pestCache).length;
    if (pestCount === 0) {
      result.warnings.push('No pests in backup');
    } else if (pestCount > 100) {
      result.warnings.push('Large number of pests (>100)');
    }

    result.dataIntegrity.pests = pestCount > 0;
  }

  private validateVersion(backup: BackupData, result: BackupValidationResult) {
    if (!backup.version) {
      result.isValid = false;
      result.errors.push('Missing version in backup');
      return;
    }

    const versionParts = backup.version.split('.');
    if (versionParts.length !== 3) {
      result.warnings.push('Invalid version format');
    }

    result.dataIntegrity.version = true;
  }
}
