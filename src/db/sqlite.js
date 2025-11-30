const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

let db = null;

function getDB() {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return db;
}

async function initDatabase() {
  return new Promise((resolve, reject) => {
    const dbPath = path.join(__dirname, '../../backup_system.db');
    
    db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.error('Error opening database:', err);
        reject(err);
      } else {
        console.log('Connected to SQLite database');
        createTables().then(resolve).catch(reject);
      }
    });
  });
}

async function createTables() {
  return new Promise((resolve, reject) => {
    const migrations = `
      CREATE TABLE IF NOT EXISTS jobs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        folder_path TEXT NOT NULL,
        frequency_minutes INTEGER NOT NULL,
        last_run TEXT NULL,
        status TEXT DEFAULT 'pending',
        retries INTEGER DEFAULT 0,
        active INTEGER DEFAULT 1,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        job_id INTEGER,
        message TEXT NOT NULL,
        level TEXT DEFAULT 'info',
        timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (job_id) REFERENCES jobs (id)
      );

      CREATE INDEX IF NOT EXISTS idx_jobs_active ON jobs(active);
      CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON logs(timestamp);
    `;

    db.exec(migrations, (err) => {
      if (err) {
        console.error('Error creating tables:', err);
        reject(err);
      } else {
        console.log('Database tables created successfully');
        resolve();
      }
    });
  });
}

function closeDatabase() {
  if (db) {
    db.close((err) => {
      if (err) {
        console.error('Error closing database:', err);
      } else {
        console.log('Database connection closed');
      }
    });
  }
}

module.exports = {
  initDatabase,
  getDB,
  closeDatabase
};