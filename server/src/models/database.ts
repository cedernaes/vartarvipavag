import sqlite3 from 'sqlite3';
import { join } from 'path';

const DB_PATH = process.env.DATA_DIR ? join(process.env.DATA_DIR, 'interrail.db') : join(__dirname, '../../data/interrail.db');

export class DatabaseManager {
  private static instance: DatabaseManager;
  private db: sqlite3.Database;

  private constructor() {
    this.db = new sqlite3.Database(DB_PATH);
    this.initializeTables();
  }

  public static getInstance(): DatabaseManager {
    if (!DatabaseManager.instance) {
      DatabaseManager.instance = new DatabaseManager();
    }
    return DatabaseManager.instance;
  }

  private initializeTables(): void {
    // Create positions table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS positions (
        id TEXT PRIMARY KEY,
        timestamp TEXT NOT NULL,
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        source TEXT DEFAULT 'manual'
      )
    `);

    // Create notes table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS notes (
        id TEXT PRIMARY KEY,
        position_id TEXT NOT NULL,
        text TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        source TEXT NOT NULL,
        telegram_user TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (position_id) REFERENCES positions (id) ON DELETE CASCADE
      )
    `);

    // Create posts table for Telegram feed
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS posts (
        id TEXT PRIMARY KEY,
        timestamp TEXT NOT NULL,
        type TEXT NOT NULL,
        caption TEXT,
        media_path TEXT,
        latitude REAL,
        longitude REAL,
        telegram_user TEXT
      )
    `);

    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_posts_timestamp
      ON posts(timestamp)
    `);

    // Create indexes for faster queries
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_positions_timestamp
      ON positions(timestamp)
    `);

    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_notes_position_id
      ON notes(position_id)
    `);

    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_notes_timestamp
      ON notes(timestamp)
    `);

    console.log('Database initialized successfully');
  }

  public getDatabase(): sqlite3.Database {
    return this.db;
  }

  public close(): void {
    this.db.close();
  }

  // Helper methods for promisified operations
  public run(sql: string, params?: any[]): Promise<sqlite3.RunResult> {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function (err) {
        if (err) reject(err);
        else resolve(this);
      });
    });
  }

  public get(sql: string, params?: any[]): Promise<any> {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  public all(sql: string, params?: any[]): Promise<any[]> {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }
}