import * as path from 'path';
import sqlite3 from 'sqlite3';

export interface OverrideRow {
  id: number;
  method: string;
  endpoint: string;
  status: number;
  body: string | null;
}

const DEFAULT_DB_PATH = path.resolve(process.cwd(), 'mock_responses.sqlite');

let dbPath: string = DEFAULT_DB_PATH;
let db: sqlite3.Database | null = null;

export function setOverridesDbPath(newPath: string): void {
  if (db) {
    db.close();
    db = null;
  }
  dbPath = newPath;
}

function getDb(): sqlite3.Database {
  if (!db) {
    db = new sqlite3.Database(dbPath);
    db.serialize(() => {
      db!.run(`CREATE TABLE IF NOT EXISTS overrides (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        method TEXT NOT NULL,
        endpoint TEXT NOT NULL,
        status INTEGER NOT NULL,
        body TEXT,
        UNIQUE(method, endpoint, status)
      )`);
    });
  }
  return db;
}

export function upsertOverride(
  method: string,
  endpoint: string,
  status: number,
  body: unknown,
): Promise<void> {
  return new Promise((resolve, reject) => {
    getDb().run(
      `INSERT INTO overrides (method, endpoint, status, body) VALUES (?, ?, ?, ?)
       ON CONFLICT(method, endpoint, status) DO UPDATE SET body=excluded.body`,
      [method, endpoint, status, JSON.stringify(body)],
      err => (err ? reject(err) : resolve()),
    );
  });
}

export function getOverride(
  method: string,
  endpoint: string,
  status: number,
): Promise<OverrideRow | null> {
  return new Promise((resolve, reject) => {
    getDb().get(
      `SELECT * FROM overrides WHERE method = ? AND endpoint = ? AND status = ?`,
      [method, endpoint, status],
      (err, row: OverrideRow | undefined) => (err ? reject(err) : resolve(row ?? null)),
    );
  });
}

export function getAllOverrides(): Promise<OverrideRow[]> {
  return new Promise((resolve, reject) => {
    getDb().all(`SELECT * FROM overrides`, [], (err, rows: OverrideRow[]) =>
      err ? reject(err) : resolve(rows),
    );
  });
}

export function deleteOverride(
  method: string,
  endpoint: string,
  status: number,
): Promise<void> {
  return new Promise((resolve, reject) => {
    getDb().run(
      `DELETE FROM overrides WHERE method = ? AND endpoint = ? AND status = ?`,
      [method, endpoint, status],
      err => (err ? reject(err) : resolve()),
    );
  });
}
