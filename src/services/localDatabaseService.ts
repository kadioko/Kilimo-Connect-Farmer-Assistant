import SQLite from 'react-native-sqlite-storage';
import { backupService } from './backupService';
import { versionControlService } from './versionControlService';
import { databaseOptimizationService } from './databaseOptimizationService';
import { databaseMigrationService } from './databaseMigrationService';
import { offlineSyncService } from './offlineSyncService';

const DATABASE_NAME = 'kilimo_connect.db';
const DATABASE_VERSION = '1.0';

interface DatabaseConfig {
  name: string;
  version: string;
  size: number;
  location: string;
  createFromLocation?: string;
}

interface DatabaseSchema {
  tables: {
    name: string;
    columns: {
      name: string;
      type: string;
      primaryKey?: boolean;
      notNull?: boolean;
    }[];
  }[];
  indexes?: {
    name: string;
    table: string;
    columns: string[];
  }[];
}

export const localDatabaseService = {
  async initializeDatabase(): Promise<void> {
    try {
      // Open database
      const db = SQLite.openDatabase(
        DATABASE_NAME,
        DATABASE_VERSION,
        'Kilimo Connect Database',
        200000
      );

      // Create tables
      await this.createTables(db);

      // Initialize backup
      await backupService.initializeBackup();

      // Initialize version control
      await versionControlService.initializeVersionControl();

      // Initialize database optimization
      await databaseOptimizationService.initializeOptimization();

      // Initialize database migration
      await databaseMigrationService.initializeMigration();

      // Initialize offline sync
      await offlineSyncService.initializeSync();

      console.log('Database initialized successfully');
    } catch (error) {
      console.error('Error initializing database:', error);
      throw error;
    }
  },

  async createTables(db: SQLite.SQLiteDatabase): Promise<void> {
    try {
      // Create pests table
      await db.executeSql(
        `CREATE TABLE IF NOT EXISTS pests (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          description TEXT,
          symptoms TEXT,
          treatment TEXT,
          image_url TEXT,
          last_detected_at TIMESTAMP,
          detection_count INTEGER DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`
      );

      // Create favorites table
      await db.executeSql(
        `CREATE TABLE IF NOT EXISTS favorites (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          pest_id INTEGER NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (pest_id) REFERENCES pests (id)
        )`
      );

      // Create history table
      await db.executeSql(
        `CREATE TABLE IF NOT EXISTS history (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          pest_id INTEGER NOT NULL,
          detection_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          image_url TEXT,
          confidence_score REAL,
          FOREIGN KEY (pest_id) REFERENCES pests (id)
        )`
      );

      // Create pest images table
      await db.executeSql(
        `CREATE TABLE IF NOT EXISTS pest_images (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          pest_id INTEGER NOT NULL,
          image_url TEXT NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (pest_id) REFERENCES pests (id)
        )`
      );

      // Create pest treatments table
      await db.executeSql(
        `CREATE TABLE IF NOT EXISTS pest_treatments (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          pest_id INTEGER NOT NULL,
          treatment TEXT NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (pest_id) REFERENCES pests (id)
        )`
      );

      // Create pest symptoms table
      await db.executeSql(
        `CREATE TABLE IF NOT EXISTS pest_symptoms (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          pest_id INTEGER NOT NULL,
          symptom TEXT NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (pest_id) REFERENCES pests (id)
        )`
      );

      // Create pest history details table
      await db.executeSql(
        `CREATE TABLE IF NOT EXISTS pest_history_details (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          history_id INTEGER NOT NULL,
          detail TEXT NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (history_id) REFERENCES history (id)
        )`
      );

      // Create indexes
      await db.executeSql(
        `CREATE INDEX IF NOT EXISTS idx_pests_name ON pests (name)`
      );
      await db.executeSql(
        `CREATE INDEX IF NOT EXISTS idx_favorites_pest_id ON favorites (pest_id)`
      );
      await db.executeSql(
        `CREATE INDEX IF NOT EXISTS idx_history_pest_id ON history (pest_id)`
      );

      console.log('Database tables created successfully');
    } catch (error) {
      console.error('Error creating database tables:', error);
      throw error;
    }
  },

  async addPest(pest: {
    name: string;
    description: string;
    symptoms: string[];
    treatments: string[];
    image_urls: string[];
    last_detected_at?: string;
    detection_count?: number;
  }): Promise<void> {
    try {
      // Check cache first
      const cachedPest = await this.cacheQuery(
        'SELECT * FROM pests WHERE name = ?',
        [pest.name]
      );

      if (cachedPest.length > 0) {
        throw new Error('Pest already exists');
      }

      const db = SQLite.openDatabase(DATABASE_NAME);
      
      // Insert main pest record
      const [result] = await db.executeSql(
        `INSERT INTO pests (name, description, last_detected_at, detection_count) 
         VALUES (?, ?, ?, ?)`,
        [pest.name, pest.description, pest.last_detected_at || null, pest.detection_count || 0]
      );

      const pestId = result.insertId;

      // Insert symptoms
      for (const symptom of pest.symptoms) {
        await db.executeSql(
          `INSERT INTO pest_symptoms (pest_id, symptom) 
           VALUES (?, ?)`,
          [pestId, symptom]
        );
      }

      // Insert treatments
      for (const treatment of pest.treatments) {
        await db.executeSql(
          `INSERT INTO pest_treatments (pest_id, treatment) 
           VALUES (?, ?)`,
          [pestId, treatment]
        );
      }

      // Insert images
      for (const imageUrl of pest.image_urls) {
        await db.executeSql(
          `INSERT INTO pest_images (pest_id, image_url) 
           VALUES (?, ?)`,
          [pestId, imageUrl]
        );
      }

      // Create version
      await versionControlService.createNewVersion({
        added: ['pests', 'pest_symptoms', 'pest_treatments', 'pest_images'],
        removed: [],
        updated: []
      });

      // Create sync operation
      await offlineSyncService.addSyncOperation({
        type: 'create',
        table: 'pests',
        data: {
          id: pestId,
          name: pest.name,
          description: pest.description,
          symptoms: pest.symptoms,
          treatments: pest.treatments,
          image_urls: pest.image_urls,
          last_detected_at: pest.last_detected_at,
          detection_count: pest.detection_count
        }
      });

      console.log('Pest added and sync operation created successfully');
    } catch (error) {
      console.error('Error adding pest:', error);
      throw error;
    }
  },

  async updatePest(pest: {
    id: number;
    name: string;
    description: string;
    symptoms: string[];
    treatments: string[];
    image_urls: string[];
    last_detected_at?: string;
    detection_count?: number;
  }): Promise<void> {
    try {
      const db = SQLite.openDatabase(DATABASE_NAME);
      
      // Update main pest record
      await db.executeSql(
        `UPDATE pests 
         SET name = ?, 
             description = ?,
             last_detected_at = ?,
             detection_count = ?
         WHERE id = ?`,
        [
          pest.name,
          pest.description,
          pest.last_detected_at || null,
          pest.detection_count || 0,
          pest.id
        ]
      );

      // Delete existing symptoms and treatments
      await db.executeSql(
        `DELETE FROM pest_symptoms WHERE pest_id = ?`,
        [pest.id]
      );
      await db.executeSql(
        `DELETE FROM pest_treatments WHERE pest_id = ?`,
        [pest.id]
      );
      await db.executeSql(
        `DELETE FROM pest_images WHERE pest_id = ?`,
        [pest.id]
      );

      // Insert new symptoms and treatments
      for (const symptom of pest.symptoms) {
        await db.executeSql(
          `INSERT INTO pest_symptoms (pest_id, symptom) 
           VALUES (?, ?)`,
          [pest.id, symptom]
        );
      }

      for (const treatment of pest.treatments) {
        await db.executeSql(
          `INSERT INTO pest_treatments (pest_id, treatment) 
           VALUES (?, ?)`,
          [pest.id, treatment]
        );
      }

      for (const imageUrl of pest.image_urls) {
        await db.executeSql(
          `INSERT INTO pest_images (pest_id, image_url) 
           VALUES (?, ?)`,
          [pest.id, imageUrl]
        );
      }

      // Create version
      await versionControlService.createNewVersion({
        added: [],
        removed: [],
        updated: ['pests', 'pest_symptoms', 'pest_treatments', 'pest_images']
      });

      // Create sync operation
      await offlineSyncService.addSyncOperation({
        type: 'update',
        table: 'pests',
        data: {
          id: pest.id,
          name: pest.name,
          description: pest.description,
          symptoms: pest.symptoms,
          treatments: pest.treatments,
          image_urls: pest.image_urls,
          last_detected_at: pest.last_detected_at,
          detection_count: pest.detection_count
        }
      });

      console.log('Pest updated and sync operation created successfully');
    } catch (error) {
      console.error('Error updating pest:', error);
      throw error;
    }
  },

  async getPest(id: number): Promise<any | null> {
    try {
      // Check cache first
      const cachedPest = await this.cacheQuery(
        'SELECT p.*, COUNT(h.id) as detection_count 
         FROM pests p 
         LEFT JOIN history h ON p.id = h.pest_id 
         WHERE p.id = ? 
         GROUP BY p.id',
        [id]
      );

      if (cachedPest.length > 0) {
        const pest = cachedPest[0];
        
        // Get symptoms
        const [symptomsResult] = await db.executeSql(
          'SELECT symptom FROM pest_symptoms WHERE pest_id = ?',
          [id]
        );
        pest.symptoms = symptomsResult.rows._array.map(row => row.symptom);

        // Get treatments
        const [treatmentsResult] = await db.executeSql(
          'SELECT treatment FROM pest_treatments WHERE pest_id = ?',
          [id]
        );
        pest.treatments = treatmentsResult.rows._array.map(row => row.treatment);

        // Get images
        const [imagesResult] = await db.executeSql(
          'SELECT image_url FROM pest_images WHERE pest_id = ?',
          [id]
        );
        pest.image_urls = imagesResult.rows._array.map(row => row.image_url);

        return pest;
      }

      const db = SQLite.openDatabase(DATABASE_NAME);
      
      const [result] = await db.executeSql(
        `SELECT p.*, COUNT(h.id) as detection_count 
         FROM pests p 
         LEFT JOIN history h ON p.id = h.pest_id 
         WHERE p.id = ? 
         GROUP BY p.id`,
        [id]
      );

      if (result.rows.length === 0) return null;

      const pest = result.rows.item(0);
      
      // Get symptoms
      const [symptomsResult] = await db.executeSql(
        'SELECT symptom FROM pest_symptoms WHERE pest_id = ?',
        [id]
      );
      pest.symptoms = symptomsResult.rows._array.map(row => row.symptom);

      // Get treatments
      const [treatmentsResult] = await db.executeSql(
        'SELECT treatment FROM pest_treatments WHERE pest_id = ?',
        [id]
      );
      pest.treatments = treatmentsResult.rows._array.map(row => row.treatment);

      // Get images
      const [imagesResult] = await db.executeSql(
        'SELECT image_url FROM pest_images WHERE pest_id = ?',
        [id]
      );
      pest.image_urls = imagesResult.rows._array.map(row => row.image_url);

      return pest;
    } catch (error) {
      console.error('Error getting pest:', error);
      return null;
    }
  },

  async getFavorites(): Promise<any[]> {
    try {
      // Check cache first
      const cachedFavorites = await this.cacheQuery(
        'SELECT p.* FROM pests p JOIN favorites f ON p.id = f.pest_id ORDER BY f.created_at DESC',
        []
      );

      if (cachedFavorites.length > 0) {
        return cachedFavorites;
      }

      const db = SQLite.openDatabase(DATABASE_NAME);
      
      const [result] = await db.executeSql(
        `SELECT p.* FROM pests p 
         JOIN favorites f ON p.id = f.pest_id 
         ORDER BY f.created_at DESC`
      );

      return result.rows._array;
    } catch (error) {
      console.error('Error getting favorites:', error);
      return [];
    }
  },

  async addFavorite(pestId: number): Promise<void> {
    try {
      const db = SQLite.openDatabase(DATABASE_NAME);
      
      await db.executeSql(
        `INSERT INTO favorites (pest_id) VALUES (?)`,
        [pestId]
      );

      // Create version
      await versionControlService.createNewVersion({
        added: ['favorites'],
        removed: [],
        updated: []
      });

      console.log('Favorite added successfully');
    } catch (error) {
      console.error('Error adding favorite:', error);
      throw error;
    }
  },

  async removeFavorite(pestId: number): Promise<void> {
    try {
      const db = SQLite.openDatabase(DATABASE_NAME);
      
      await db.executeSql(
        `DELETE FROM favorites WHERE pest_id = ?`,
        [pestId]
      );

      // Create version
      await versionControlService.createNewVersion({
        added: [],
        removed: ['favorites'],
        updated: []
      });

      console.log('Favorite removed successfully');
    } catch (error) {
      console.error('Error removing favorite:', error);
      throw error;
    }
  },

  async addHistory(pestId: number, confidence: number): Promise<void> {
    try {
      const db = SQLite.openDatabase(DATABASE_NAME);
      
      await db.executeSql(
        `INSERT INTO history (pest_id, confidence) VALUES (?, ?)`,
        [pestId, confidence]
      );

      // Create version
      await versionControlService.createNewVersion({
        added: ['history'],
        removed: [],
        updated: []
      });

      console.log('History added successfully');
    } catch (error) {
      console.error('Error adding history:', error);
      throw error;
    }
  },

  async getHistory(limit: number = 10): Promise<any[]> {
    try {
      // Check cache first
      const cachedHistory = await this.cacheQuery(
        `SELECT h.*, p.name as pest_name, COUNT(d.id) as detail_count 
         FROM history h 
         JOIN pests p ON h.pest_id = p.id 
         LEFT JOIN pest_history_details d ON h.id = d.history_id 
         ORDER BY h.detection_date DESC 
         LIMIT ?`,
        [limit]
      );

      if (cachedHistory.length > 0) {
        return cachedHistory;
      }

      const db = SQLite.openDatabase(DATABASE_NAME);
      
      const [result] = await db.executeSql(
        `SELECT h.*, p.name as pest_name, COUNT(d.id) as detail_count 
         FROM history h 
         JOIN pests p ON h.pest_id = p.id 
         LEFT JOIN pest_history_details d ON h.id = d.history_id 
         ORDER BY h.detection_date DESC 
         LIMIT ?`,
        [limit]
      );

      const history = result.rows._array;

      // Get details for each history entry
      for (const entry of history) {
        const [detailsResult] = await db.executeSql(
          'SELECT detail FROM pest_history_details WHERE history_id = ?',
          [entry.id]
        );
        entry.details = detailsResult.rows._array.map(row => row.detail);
      }

      return history;
    } catch (error) {
      console.error('Error getting history:', error);
      return [];
    }
  },

  async clearDatabase(): Promise<void> {
    try {
      const db = SQLite.openDatabase(DATABASE_NAME);
      
      // Delete all tables
      await db.executeSql('DROP TABLE IF EXISTS pests');
      await db.executeSql('DROP TABLE IF EXISTS favorites');
      await db.executeSql('DROP TABLE IF EXISTS history');

      // Recreate tables
      await this.createTables(db);

      // Create version
      await versionControlService.createNewVersion({
        added: [],
        removed: ['pests', 'favorites', 'history'],
        updated: []
      });

      console.log('Database cleared successfully');
    } catch (error) {
      console.error('Error clearing database:', error);
      throw error;
    }
  },

  async backupDatabase(): Promise<void> {
    try {
      const db = SQLite.openDatabase(DATABASE_NAME);
      
      // Get all data
      const [pestsResult] = await db.executeSql('SELECT * FROM pests');
      const [favoritesResult] = await db.executeSql('SELECT * FROM favorites');
      const [historyResult] = await db.executeSql('SELECT * FROM history');

      const backupData = {
        pests: pestsResult.rows._array,
        favorites: favoritesResult.rows._array,
        history: historyResult.rows._array,
        timestamp: Date.now()
      };

      // Save backup
      await backupService.saveBackup(backupData);

      console.log('Database backup created successfully');
    } catch (error) {
      console.error('Error creating database backup:', error);
      throw error;
    }
  },

  async restoreDatabase(): Promise<void> {
    try {
      const backup = await backupService.getBackup();
      if (!backup) {
        throw new Error('No backup found');
      }

      const db = SQLite.openDatabase(DATABASE_NAME);
      
      // Clear existing data
      await this.clearDatabase();

      // Insert backup data
      if (backup.pests) {
        for (const pest of backup.pests) {
          await db.executeSql(
            `INSERT INTO pests (id, name, description, symptoms, treatment, image_url, created_at, updated_at) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              pest.id,
              pest.name,
              pest.description,
              pest.symptoms,
              pest.treatment,
              pest.image_url,
              pest.created_at,
              pest.updated_at
            ]
          );
        }
      }

      if (backup.favorites) {
        for (const favorite of backup.favorites) {
          await db.executeSql(
            `INSERT INTO favorites (id, pest_id, created_at) 
             VALUES (?, ?, ?)`,
            [favorite.id, favorite.pest_id, favorite.created_at]
          );
        }
      }

      if (backup.history) {
        for (const history of backup.history) {
          await db.executeSql(
            `INSERT INTO history (id, pest_id, detection_date, confidence) 
             VALUES (?, ?, ?, ?)`,
            [history.id, history.pest_id, history.detection_date, history.confidence]
          );
        }
      }

      // Create version
      await versionControlService.createNewVersion({
        added: [],
        removed: [],
        updated: ['pests', 'favorites', 'history']
      });

      console.log('Database restored successfully');
    } catch (error) {
      console.error('Error restoring database:', error);
      throw error;
    }
  }
};
