import SQLite, { SQLiteDatabase, Transaction, ResultSet, ResultSetRowList } from 'react-native-sqlite-storage';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { backupService } from './backupService';
import { versionControlService } from './versionControlService';
import { databaseOptimizationService } from './databaseOptimizationService';
import { CacheService } from './cacheService';
import { databaseMigrationService } from './databaseMigrationService';
import { offlineSyncService } from './offlineSyncService';

interface Pest {
  id?: number;
  name: string;
  description: string;
  symptoms: string[];
  treatments: string[];
  image_urls: string[];
  last_detected_at?: string;
  detection_count?: number;
  created_at?: string;
  updated_at?: string;
}

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

const DATABASE_CONFIG: DatabaseConfig = {
  name: 'kilimo_connect.db',
  version: '1.0',
  size: 200000,
  location: 'default'
};

const DATABASE_SCHEMA: DatabaseSchema = {
  tables: [
    {
      name: 'pests',
      columns: [
        { name: 'id', type: 'INTEGER', primaryKey: true },
        { name: 'name', type: 'TEXT', notNull: true },
        { name: 'description', type: 'TEXT' },
        { name: 'symptoms', type: 'TEXT' },
        { name: 'treatments', type: 'TEXT' },
        { name: 'image_urls', type: 'TEXT' },
        { name: 'last_detected_at', type: 'TEXT' },
        { name: 'detection_count', type: 'INTEGER' }
      ]
    },
    {
      name: 'favorites',
      columns: [
        { name: 'id', type: 'INTEGER', primaryKey: true },
        { name: 'pest_id', type: 'INTEGER', notNull: true },
        { name: 'created_at', type: 'TEXT', notNull: true }
      ]
    },
    {
      name: 'history',
      columns: [
        { name: 'id', type: 'INTEGER', primaryKey: true },
        { name: 'pest_id', type: 'INTEGER', notNull: true },
        { name: 'created_at', type: 'TEXT', notNull: true },
        { name: 'confidence', type: 'REAL', notNull: true }
      ]
    },
    {
      name: 'pest_images',
      columns: [
        { name: 'id', type: 'INTEGER', primaryKey: true },
        { name: 'pest_id', type: 'INTEGER', notNull: true },
        { name: 'image_url', type: 'TEXT', notNull: true },
        { name: 'created_at', type: 'TEXT' }
      ]
    },
    {
      name: 'pest_symptoms',
      columns: [
        { name: 'id', type: 'INTEGER', primaryKey: true },
        { name: 'pest_id', type: 'INTEGER', notNull: true },
        { name: 'symptom', type: 'TEXT', notNull: true },
        { name: 'created_at', type: 'TEXT' }
      ]
    },
    {
      name: 'pest_treatments',
      columns: [
        { name: 'id', type: 'INTEGER', primaryKey: true },
        { name: 'pest_id', type: 'INTEGER', notNull: true },
        { name: 'treatment', type: 'TEXT', notNull: true },
        { name: 'created_at', type: 'TEXT' }
      ]
    },
    {
      name: 'pest_history_details',
      columns: [
        { name: 'id', type: 'INTEGER', primaryKey: true },
        { name: 'history_id', type: 'INTEGER', notNull: true },
        { name: 'detail', type: 'TEXT', notNull: true },
        { name: 'created_at', type: 'TEXT' }
      ]
    }
  ],
  indexes: [
    { name: 'idx_pests_name', table: 'pests', columns: ['name'] },
    { name: 'idx_favorites_pest_id', table: 'favorites', columns: ['pest_id'] },
    { name: 'idx_history_pest_id', table: 'history', columns: ['pest_id'] }
  ]
};

export class LocalDatabaseService {
  private db: SQLiteDatabase | null = null;
  private cacheService: CacheService;

  constructor() {
    this.cacheService = new CacheService();
  }

  private async getDatabase(): Promise<SQLiteDatabase> {
    if (!this.db) {
      try {
        this.db = await SQLite.openDatabase(
          DATABASE_CONFIG.name,
          DATABASE_CONFIG.version,
          DATABASE_CONFIG.size,
          DATABASE_CONFIG.location,
          DATABASE_CONFIG.createFromLocation
        );
      } catch (error) {
        console.error('Error opening database:', error);
        throw new Error(`Failed to open database: ${error}`);
      }
    }
    return this.db!;
  }

  async initializeDatabase(): Promise<void> {
    try {
      console.log('Initializing database...');
      
      const db = await this.getDatabase();
      
      // Create tables
      await this.createTables(db);
      
      // Initialize version control
      await versionControlService.initializeVersionControl();
      
      // Create initial version
      await versionControlService.createInitialVersion();
      
      console.log('Database initialized successfully');
    } catch (error: any) {
      console.error('Error initializing database:', error);
      throw error;
    }
  },

  async createTables(): Promise<void> {
    const db = await this.getDatabase();

    try {
      // Drop existing tables if they exist
      const tables = [
        'pests',
        'favorites',
        'history',
        'pest_images',
        'pest_symptoms',
        'pest_treatments',
        'pest_history_details'
      ];

      for (const table of tables) {
        await db.executeSql(`DROP TABLE IF EXISTS ${table}`);
      }

      // Create pests table
      await db.executeSql(`
        CREATE TABLE IF NOT EXISTS pests (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          description TEXT NOT NULL,
          symptoms TEXT NOT NULL,
          treatments TEXT NOT NULL,
          image_urls TEXT NOT NULL,
          last_detected_at TEXT NOT NULL,
          detection_count INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Create favorites table
      await db.executeSql(`
        CREATE TABLE IF NOT EXISTS favorites (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          pest_id INTEGER NOT NULL,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (pest_id) REFERENCES pests (id) ON DELETE CASCADE
        )
      `);

      // Create history table
      await db.executeSql(`
        CREATE TABLE IF NOT EXISTS history (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          pest_id INTEGER NOT NULL,
          detection_date TEXT NOT NULL,
          location TEXT,
          notes TEXT,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (pest_id) REFERENCES pests (id) ON DELETE CASCADE
        )
      `);

      // Create pest_images table
      await db.executeSql(`
        CREATE TABLE IF NOT EXISTS pest_images (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          pest_id INTEGER NOT NULL,
          image_url TEXT NOT NULL,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (pest_id) REFERENCES pests (id) ON DELETE CASCADE
        )
      `);

      // Create pest_symptoms table
      await db.executeSql(`
        CREATE TABLE IF NOT EXISTS pest_symptoms (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          pest_id INTEGER NOT NULL,
          symptom TEXT NOT NULL,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (pest_id) REFERENCES pests (id) ON DELETE CASCADE
        )
      `);

      // Create pest_treatments table
      await db.executeSql(`
        CREATE TABLE IF NOT EXISTS pest_treatments (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          pest_id INTEGER NOT NULL,
          treatment TEXT NOT NULL,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (pest_id) REFERENCES pests (id) ON DELETE CASCADE
        )
      `);

      // Create pest_history_details table
      await db.executeSql(`
        CREATE TABLE IF NOT EXISTS pest_history_details (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          history_id INTEGER NOT NULL,
          detail TEXT NOT NULL,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (history_id) REFERENCES history (id) ON DELETE CASCADE
        )
      `);

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
  }

  async getFavorites(): Promise<Pest[]> {
    try {
      const db = await this.getDatabase();
      
      // Check cache first
      const cachedFavorites = await this.cacheService.get<Pest[]>('favorites');
      if (cachedFavorites) {
        return cachedFavorites;
      }

      // Get favorites from database
      const favorites = await new Promise<Pest[]>((resolve, reject) => {
        db.executeSql(
          `SELECT p.* 
           FROM pests p 
           JOIN favorites f ON p.id = f.pest_id 
           ORDER BY f.created_at DESC`,
          [],
          (tx: SQLite.SQLTransaction, results: SQLite.ResultSet) => {
            const favorites: Pest[] = [];
            for (let i = 0; i < results.rows.length; i++) {
              const row = results.rows.item(i);
              favorites.push({
                id: row.id,
                name: row.name,
                description: row.description,
                symptoms: JSON.parse(row.symptoms),
                treatments: JSON.parse(row.treatments),
                image_urls: JSON.parse(row.image_urls),
                last_detected_at: row.last_detected_at,
                detection_count: row.detection_count
              } as Pest);
            }
            resolve(favorites);
          },
          (tx: SQLite.SQLTransaction, error: SQLite.SQLError) => reject(error)
        );
      });

      // Cache the results
      await this.cacheService.set<Pest[]>('favorites', favorites);

      return favorites;
    } catch (error) {
      console.error('Error getting favorites:', error);
      throw error;
    }
  }

  async clearDatabase(): Promise<void> {
    try {
      const db = await this.getDatabase();
      
      // Drop all tables
      await new Promise<void>((resolve, reject) => {
        db.executeSql(`DROP TABLE IF EXISTS pests`, [], resolve, reject);
      });
      await new Promise<void>((resolve, reject) => {
        db.executeSql(`DROP TABLE IF EXISTS favorites`, [], resolve, reject);
      });
      await new Promise<void>((resolve, reject) => {
        db.executeSql(`DROP TABLE IF EXISTS history`, [], resolve, reject);
      });
      await new Promise<void>((resolve, reject) => {
        db.executeSql(`DROP TABLE IF EXISTS pest_images`, [], resolve, reject);
      });
      await new Promise<void>((resolve, reject) => {
        db.executeSql(`DROP TABLE IF EXISTS pest_symptoms`, [], resolve, reject);
      });
      await new Promise<void>((resolve, reject) => {
        db.executeSql(`DROP TABLE IF EXISTS pest_treatments`, [], resolve, reject);
      });
      await new Promise<void>((resolve, reject) => {
        db.executeSql(`DROP TABLE IF EXISTS pest_history_details`, [], resolve, reject);
      });

      // Clear cache
      await AsyncStorage.clear();

      // Create new tables
      await this.createTables();

      console.log('Database cleared and recreated successfully');
    } catch (error) {
      console.error('Error clearing database:', error);
      throw error;
    }
  }

  async backupDatabase(): Promise<void> {
    try {
      const db = await this.getDatabase();
      
      // Get all data
      const pestsResult = await new Promise<SQLite.ResultSet>((resolve, reject) => {
        db.executeSql(
          'SELECT * FROM pests',
          [],
          (tx: Transaction, results: ResultSet) => resolve(results),
          (tx: Transaction, error: SQLite.SQLError) => reject(error)
        );
      });

      const favoritesResult = await new Promise<SQLite.ResultSet>((resolve, reject) => {
        db.executeSql(
          'SELECT * FROM favorites',
          [],
          (tx: Transaction, results: ResultSet) => resolve(results),
          (tx: Transaction, error: SQLite.SQLError) => reject(error)
        );
      });

      const historyResult = await new Promise<SQLite.ResultSet>((resolve, reject) => {
        db.executeSql(
          'SELECT * FROM history',
          [],
          (tx: Transaction, results: ResultSet) => resolve(results),
          (tx: Transaction, error: SQLite.SQLError) => reject(error)
        );
      });

      // Create backup data
      const backupData = {
        pests: Array.from(pestsResult.rows._array),
        favorites: Array.from(favoritesResult.rows._array),
        history: Array.from(historyResult.rows._array),
        timestamp: Date.now()
      };

      // Store backup
      await AsyncStorage.setItem('database_backup', JSON.stringify(backupData));

      console.log('Database backup created successfully');
    } catch (error) {
      console.error('Error creating database backup:', error);
      throw error;
    }
  }

  async restoreDatabase(): Promise<void> {
    try {
      const db = await this.getDatabase();
      
      // Get backup data
      const backupData = await AsyncStorage.getItem('database_backup');
      if (!backupData) {
        throw new Error('No backup data found');
      }

      const { pests, favorites, history } = JSON.parse(backupData);

      // Clear existing data
      await this.clearDatabase();

      // Restore pests
      for (const pest of pests) {
        await new Promise<void>((resolve, reject) => {
          db.executeSql(
            `INSERT INTO pests (id, name, description, symptoms, treatments, image_urls, last_detected_at, detection_count, created_at, updated_at) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              pest.id,
              pest.name,
              pest.description,
              JSON.stringify(pest.symptoms),
              JSON.stringify(pest.treatments),
              JSON.stringify(pest.image_urls),
              pest.last_detected_at,
              pest.detection_count,
              pest.created_at,
              pest.updated_at
            ],
            (tx: Transaction, results: ResultSet) => resolve(),
            (tx: Transaction, error: SQLite.SQLError) => reject(error)
          );
        });
      }

      // Restore favorites
      for (const favorite of favorites) {
        await new Promise<void>((resolve, reject) => {
          db.executeSql(
            `INSERT INTO favorites (id, pest_id, created_at) 
             VALUES (?, ?, ?)`,
            [
              favorite.id,
              favorite.pest_id,
              favorite.created_at
            ],
            (tx: Transaction, results: ResultSet) => resolve(),
            (tx: Transaction, error: SQLite.SQLError) => reject(error)
          );
        });
      }

      // Restore history
      for (const historyItem of history) {
        await new Promise<void>((resolve, reject) => {
          db.executeSql(
            `INSERT INTO history (id, pest_id, created_at) 
             VALUES (?, ?, ?)`,
            [
              historyItem.id,
              historyItem.pest_id,
              historyItem.detection_date,
              historyItem.location,
              historyItem.notes,
              historyItem.created_at
            ],
            (tx: Transaction, results: ResultSet) => resolve(),
            (tx: Transaction, error: SQLite.SQLError) => reject(error)
          );
        });
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
}
