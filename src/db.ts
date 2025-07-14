import * as fs from 'fs';
import * as path from 'path';
import sqlite3 from 'sqlite3';


// --- SQLite DB for response overrides ---
const DB_PATH = path.resolve(process.cwd(), 'mock_responses.sqlite');
let db: sqlite3.Database | null = null;

function getDb(): sqlite3.Database {
  if (!db) {
    db = new sqlite3.Database(DB_PATH);
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

export function upsertOverride(method: string, endpoint: string, status: number, body: any, cb?: (err?: Error) => void) {
  const db = getDb();
  db.run(
    `INSERT INTO overrides (method, endpoint, status, body) VALUES (?, ?, ?, ?)
     ON CONFLICT(method, endpoint, status) DO UPDATE SET body=excluded.body`,
    [method, endpoint, status, JSON.stringify(body)],
    function (err) { if (cb) cb(err || undefined); }
  );
}

export function getOverride(method: string, endpoint: string, status: number, cb: (err: Error | null, row: any) => void) {
  const db = getDb();
  db.get(
    `SELECT * FROM overrides WHERE method = ? AND endpoint = ? AND status = ?`,
    [method, endpoint, status],
    cb
  );
}

export function getAllOverrides(cb: (err: Error | null, rows: any[]) => void) {
  const db = getDb();
  db.all(`SELECT * FROM overrides`, [], cb);
}

export function deleteOverride(method: string, endpoint: string, status: number, cb?: (err?: Error) => void) {
  const db = getDb();
  db.run(
    `DELETE FROM overrides WHERE method = ? AND endpoint = ? AND status = ?`,
    [method, endpoint, status],
    function (err) { if (cb) cb(err || undefined); }
  );
}