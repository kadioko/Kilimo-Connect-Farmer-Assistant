import SQLite from 'react-native-sqlite-storage';
import { localDatabaseService } from './localDatabaseService';
import { backupService } from './backupService';
import { versionControlService } from './versionControlService';

const MIGRATION_KEY = 'database_migration';
const CURRENT_VERSION = '2.0';

interface Migration {
  version: string;
  timestamp: number;
  changes: {
    added: string[];
    modified: string[];
    removed: string[];
  };
  status: 'pending' | 'completed' | 'failed';
}

export const databaseMigrationService = {
  async initializeMigration(): Promise<void> {
    try {
      // Check migration status
      const migration = await this.getMigration();
      
      // If no migration exists or version is outdated
      if (!migration || migration.version !== CURRENT_VERSION) {
        await this.performMigration();
      }

      // Start migration monitor
      this.startMigrationMonitor();
    } catch (error) {
      console.error('Error initializing database migration:', error);
    }
  },

  async performMigration(): Promise<void> {
    try {
      // Create backup before migration
      await backupService.createBackup();

      // Get current migration status
      const migration = await this.getMigration();
      
      // If no migration exists, create initial migration
      if (!migration) {
        await this.createInitialMigration();
      }

      // Get database version
      const db = SQLite.openDatabase(localDatabaseService.DATABASE_NAME);
      const [result] = await db.executeSql('PRAGMA user_version');
      const currentVersion = result.rows._array[0].user_version;

      // Perform migrations from current version to target version
      while (currentVersion < CURRENT_VERSION) {
        await this.executeMigration(currentVersion, currentVersion + 1);
        currentVersion++;
      }

      // Update migration status
      await this.updateMigrationStatus({
        version: CURRENT_VERSION,
        timestamp: Date.now(),
        changes: {
          added: [],
          modified: [],
          removed: []
        },
        status: 'completed'
      });

      console.log('Database migration completed successfully');
    } catch (error) {
      console.error('Error performing database migration:', error);
      throw error;
    }
  },

  async createInitialMigration(): Promise<void> {
    try {
      const migration: Migration = {
        version: '1.0',
        timestamp: Date.now(),
        changes: {
          added: ['pests', 'favorites', 'history'],
          modified: [],
          removed: []
        },
        status: 'completed'
      };

      await this.updateMigrationStatus(migration);
    } catch (error) {
      console.error('Error creating initial migration:', error);
      throw error;
    }
  },

  async executeMigration(fromVersion: number, toVersion: number): Promise<void> {
    try {
      const db = SQLite.openDatabase(localDatabaseService.DATABASE_NAME);

      // Create migration transaction
      await db.transaction(async (tx) => {
        // Add new columns to pests table
        if (fromVersion < 1.1) {
          await tx.executeSql(
            'ALTER TABLE pests ADD COLUMN last_detected_at TIMESTAMP'
          );
          await tx.executeSql(
            'ALTER TABLE pests ADD COLUMN detection_count INTEGER DEFAULT 0'
          );
        }

        // Add new table for pest images
        if (fromVersion < 1.2) {
          await tx.executeSql(
            `CREATE TABLE IF NOT EXISTS pest_images (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              pest_id INTEGER NOT NULL,
              image_url TEXT NOT NULL,
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              FOREIGN KEY (pest_id) REFERENCES pests (id)
            )`
          );
        }

        // Add new table for pest treatments
        if (fromVersion < 1.3) {
          await tx.executeSql(
            `CREATE TABLE IF NOT EXISTS pest_treatments (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              pest_id INTEGER NOT NULL,
              treatment TEXT NOT NULL,
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              FOREIGN KEY (pest_id) REFERENCES pests (id)
            )`
          );
        }

        // Add new table for pest symptoms
        if (fromVersion < 1.4) {
          await tx.executeSql(
            `CREATE TABLE IF NOT EXISTS pest_symptoms (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              pest_id INTEGER NOT NULL,
              symptom TEXT NOT NULL,
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              FOREIGN KEY (pest_id) REFERENCES pests (id)
            )`
          );
        }

        // Add new table for pest history details
        if (fromVersion < 1.5) {
          await tx.executeSql(
            `CREATE TABLE IF NOT EXISTS pest_history_details (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              history_id INTEGER NOT NULL,
              detail TEXT NOT NULL,
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              FOREIGN KEY (history_id) REFERENCES history (id)
            )`
          );
        }

        // Update database version
        await tx.executeSql(`PRAGMA user_version = ${toVersion}`);
      });

      // Update migration status
      await this.updateMigrationStatus({
        version: toVersion.toString(),
        timestamp: Date.now(),
        changes: {
          added: [
            'pest_images',
            'pest_treatments',
            'pest_symptoms',
            'pest_history_details'
          ],
          modified: ['pests'],
          removed: []
        },
        status: 'completed'
      });

      console.log(`Migration from ${fromVersion} to ${toVersion} completed`);
    } catch (error) {
      console.error(`Error executing migration from ${fromVersion} to ${toVersion}:`, error);
      throw error;
    }
  },

  async updateMigrationStatus(migration: Migration): Promise<void> {
    try {
      await AsyncStorage.setItem(MIGRATION_KEY, JSON.stringify(migration));
    } catch (error) {
      console.error('Error updating migration status:', error);
      throw error;
    }
  },

  async getMigration(): Promise<Migration | null> {
    try {
      const migrationString = await AsyncStorage.getItem(MIGRATION_KEY);
      return migrationString ? JSON.parse(migrationString) : null;
    } catch (error) {
      console.error('Error getting migration status:', error);
      return null;
    }
  },

  startMigrationMonitor(): void {
    // Check for pending migrations every hour
    setInterval(async () => {
      try {
        const migration = await this.getMigration();
        if (migration && migration.status === 'pending') {
          await this.performMigration();
        }
      } catch (error) {
        console.error('Error checking pending migrations:', error);
      }
    }, 60 * 60 * 1000); // Check every hour
  },

  async rollbackMigration(version: number): Promise<void> {
    try {
      const db = SQLite.openDatabase(localDatabaseService.DATABASE_NAME);

      // Create rollback transaction
      await db.transaction(async (tx) => {
        // Drop tables added in newer versions
        if (version < 1.2) {
          await tx.executeSql('DROP TABLE IF EXISTS pest_images');
        }
        if (version < 1.3) {
          await tx.executeSql('DROP TABLE IF EXISTS pest_treatments');
        }
        if (version < 1.4) {
          await tx.executeSql('DROP TABLE IF EXISTS pest_symptoms');
        }
        if (version < 1.5) {
          await tx.executeSql('DROP TABLE IF EXISTS pest_history_details');
        }

        // Remove columns added in newer versions
        if (version < 1.1) {
          await tx.executeSql(
            'ALTER TABLE pests DROP COLUMN last_detected_at'
          );
          await tx.executeSql(
            'ALTER TABLE pests DROP COLUMN detection_count'
          );
        }

        // Update database version
        await tx.executeSql(`PRAGMA user_version = ${version}`);
      });

      // Update migration status
      await this.updateMigrationStatus({
        version: version.toString(),
        timestamp: Date.now(),
        changes: {
          added: [],
          modified: ['pests'],
          removed: [
            'pest_images',
            'pest_treatments',
            'pest_symptoms',
            'pest_history_details'
          ]
        },
        status: 'completed'
      });

      console.log(`Rolled back to version ${version}`);
    } catch (error) {
      console.error(`Error rolling back to version ${version}:`, error);
      throw error;
    }
  }
};
