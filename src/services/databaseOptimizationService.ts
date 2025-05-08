import SQLite from 'react-native-sqlite-storage';
import { localDatabaseService } from './localDatabaseService';
import { backupService } from './backupService';
import { versionControlService } from './versionControlService';

const OPTIMIZATION_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours
const QUERY_CACHE_SIZE = 100;
const COMPRESS_THRESHOLD = 1000; // Compress when data size exceeds 1000 records

interface QueryCache {
  query: string;
  params: any[];
  result: any;
  timestamp: number;
}

export const databaseOptimizationService = {
  async initializeOptimization(): Promise<void> {
    try {
      // Start periodic optimization
      setInterval(async () => {
        await this.optimizeDatabase();
      }, OPTIMIZATION_INTERVAL);

      // Initialize query cache
      this.initializeQueryCache();

      // Start compression monitor
      this.startCompressionMonitor();

      // Start encryption monitor
      this.startEncryptionMonitor();
    } catch (error) {
      console.error('Error initializing database optimization:', error);
    }
  },

  private async optimizeDatabase(): Promise<void> {
    try {
      const db = SQLite.openDatabase(localDatabaseService.DATABASE_NAME);

      // 1. Vacuum database
      await db.executeSql('VACUUM');

      // 2. Rebuild indexes
      await db.executeSql('REINDEX');

      // 3. Analyze database
      await db.executeSql('ANALYZE');

      // 4. Optimize tables
      await this.optimizeTables(db);

      // 5. Update statistics
      await db.executeSql('UPDATE SQLITE_STAT1');

      console.log('Database optimization completed successfully');
    } catch (error) {
      console.error('Error optimizing database:', error);
      throw error;
    }
  },

  private async optimizeTables(db: SQLite.SQLiteDatabase): Promise<void> {
    try {
      // Get all tables
      const [result] = await db.executeSql(
        'SELECT name FROM sqlite_master WHERE type = "table"'
      );

      const tables = result.rows._array.map(row => row.name);

      // Optimize each table
      for (const table of tables) {
        // 1. Create temporary table
        await db.executeSql(
          `CREATE TEMPORARY TABLE temp_${table} AS SELECT * FROM ${table}`
        );

        // 2. Drop original table
        await db.executeSql(`DROP TABLE ${table}`);

        // 3. Recreate table with optimized schema
        await this.createOptimizedTable(db, table);

        // 4. Copy data back
        await db.executeSql(
          `INSERT INTO ${table} SELECT * FROM temp_${table}`
        );

        // 5. Drop temporary table
        await db.executeSql(`DROP TABLE temp_${table}`);

        console.log(`Optimized table: ${table}`);
      }
    } catch (error) {
      console.error('Error optimizing tables:', error);
      throw error;
    }
  },

  private async createOptimizedTable(db: SQLite.SQLiteDatabase, tableName: string): Promise<void> {
    try {
      // Get table schema
      const [result] = await db.executeSql(
        `PRAGMA table_info(${tableName})`
      );

      const columns = result.rows._array;

      // Create optimized table
      const createTableSql = `CREATE TABLE ${tableName} (
        ${columns.map(col => `
          ${col.name} ${col.type} ${col.notnull ? 'NOT NULL' : ''} ${col.pk ? 'PRIMARY KEY' : ''}
        `).join(',\n')},
        ${this.createIndexes(tableName)}
      )`;

      await db.executeSql(createTableSql);

      console.log(`Created optimized table: ${tableName}`);
    } catch (error) {
      console.error('Error creating optimized table:', error);
      throw error;
    }
  },

  private createIndexes(tableName: string): string {
    const indexes = [];

    // Add common indexes
    indexes.push(`CREATE INDEX IF NOT EXISTS idx_${tableName}_created_at ON ${tableName} (created_at)`);
    indexes.push(`CREATE INDEX IF NOT EXISTS idx_${tableName}_updated_at ON ${tableName} (updated_at)`);

    // Add specific indexes based on table
    switch (tableName) {
      case 'pests':
        indexes.push(`CREATE INDEX IF NOT EXISTS idx_pests_name ON pests (name)`);
        break;
      case 'favorites':
        indexes.push(`CREATE INDEX IF NOT EXISTS idx_favorites_pest_id ON favorites (pest_id)`);
        break;
      case 'history':
        indexes.push(`CREATE INDEX IF NOT EXISTS idx_history_pest_id ON history (pest_id)`);
        indexes.push(`CREATE INDEX IF NOT EXISTS idx_history_detection_date ON history (detection_date)`);
        break;
    }

    return indexes.join(',\n');
  },

  private initializeQueryCache(): void {
    const queryCache: QueryCache[] = [];

    // Cache query results
    const cacheQuery = async (query: string, params: any[]): Promise<any> => {
      try {
        // Check cache first
        const cachedResult = queryCache.find(
          cache => cache.query === query && 
                  JSON.stringify(cache.params) === JSON.stringify(params)
        );

        if (cachedResult && Date.now() - cachedResult.timestamp < 30 * 60 * 1000) { // Cache valid for 30 minutes
          return cachedResult.result;
        }

        // Execute query
        const db = SQLite.openDatabase(localDatabaseService.DATABASE_NAME);
        const [result] = await db.executeSql(query, params);

        // Cache result
        if (queryCache.length >= QUERY_CACHE_SIZE) {
          queryCache.shift();
        }
        queryCache.push({
          query,
          params,
          result: result.rows._array,
          timestamp: Date.now()
        });

        return result.rows._array;
      } catch (error) {
        console.error('Error caching query:', error);
        throw error;
      }
    };

    // Export cache function
    localDatabaseService.cacheQuery = cacheQuery;
  },

  private startCompressionMonitor(): void {
    setInterval(async () => {
      try {
        const db = SQLite.openDatabase(localDatabaseService.DATABASE_NAME);

        // Check data size
        const [result] = await db.executeSql(
          'SELECT COUNT(*) as count FROM pests UNION ALL SELECT COUNT(*) as count FROM favorites UNION ALL SELECT COUNT(*) as count FROM history'
        );

        const totalCount = result.rows._array.reduce((sum, row) => sum + row.count, 0);

        if (totalCount >= COMPRESS_THRESHOLD) {
          await this.compressDatabase();
        }
      } catch (error) {
        console.error('Error monitoring compression:', error);
      }
    }, 60 * 60 * 1000); // Check every hour
  },

  private async compressDatabase(): Promise<void> {
    try {
      const db = SQLite.openDatabase(localDatabaseService.DATABASE_NAME);

      // 1. Create compressed backup
      await backupService.createBackup();

      // 2. Clear old data
      await this.clearOldData(db);

      // 3. Optimize database
      await this.optimizeDatabase();

      console.log('Database compression completed successfully');
    } catch (error) {
      console.error('Error compressing database:', error);
      throw error;
    }
  },

  private async clearOldData(db: SQLite.SQLiteDatabase): Promise<void> {
    try {
      // Clear old history (keep last 100 entries)
      await db.executeSql(
        `DELETE FROM history WHERE id NOT IN (
          SELECT id FROM history ORDER BY detection_date DESC LIMIT 100
        )`
      );

      // Clear old favorites (keep last 50 entries)
      await db.executeSql(
        `DELETE FROM favorites WHERE id NOT IN (
          SELECT id FROM favorites ORDER BY created_at DESC LIMIT 50
        )`
      );

      console.log('Old data cleared successfully');
    } catch (error) {
      console.error('Error clearing old data:', error);
      throw error;
    }
  },

  private startEncryptionMonitor(): void {
    setInterval(async () => {
      try {
        const db = SQLite.openDatabase(localDatabaseService.DATABASE_NAME);

        // Check encryption status
        const [result] = await db.executeSql(
          'PRAGMA cipher_version'
        );

        if (!result.rows._array[0].cipher_version) {
          await this.encryptDatabase();
        }
      } catch (error) {
        console.error('Error monitoring encryption:', error);
      }
    }, 24 * 60 * 60 * 1000); // Check every 24 hours
  },

  private async encryptDatabase(): Promise<void> {
    try {
      const db = SQLite.openDatabase(localDatabaseService.DATABASE_NAME);

      // 1. Create encrypted backup
      await backupService.createBackup();

      // 2. Encrypt database
      await db.executeSql(
        'PRAGMA key = "your-encryption-key"'
      );

      // 3. Verify encryption
      const [result] = await db.executeSql(
        'PRAGMA cipher_version'
      );

      if (!result.rows._array[0].cipher_version) {
        throw new Error('Encryption failed');
      }

      console.log('Database encryption completed successfully');
    } catch (error) {
      console.error('Error encrypting database:', error);
      throw error;
    }
  }
};
