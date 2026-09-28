/**
 * IndexedDB Storage Layer with Automatic Migrations, 7-day Rolling Backups,
 * and Inter-tab Broadcast Synchronization for FocoSemanal.
 */

import { DatabaseSchema } from '../types';
import { 
  IDB_NAME, 
  STORAGE_KEY_V4, 
  STORAGE_KEY_V5, 
  SYNC_CHANNEL_NAME 
} from '../constants/app';

export interface BackupSnapshot {
  id: string;
  timestamp: string; // ISO
  dateStr: string;   // YYYY-MM-DD
  reason: string;
  data: DatabaseSchema;
}

export interface UndoEntry {
  id: string;
  description: string;
  timestamp: number;
  undo: () => Promise<void>;
}

class IndexedDBManager {
  private dbPromise: Promise<IDBDatabase> | null = null;
  private channel: BroadcastChannel | null = null;
  private syncListeners: Array<(db: DatabaseSchema) => void> = [];
  private undoStack: UndoEntry[] = [];
  private readonly MAX_UNDO = 20;

  constructor() {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        this.channel = new BroadcastChannel(SYNC_CHANNEL_NAME);
        this.channel.onmessage = (event) => {
          if (event.data?.type === 'SYNC_DATA' && event.data?.payload) {
            this.syncListeners.forEach(listener => listener(event.data.payload));
          }
        };
      } catch (e) {
        console.warn('BroadcastChannel not supported or blocked:', e);
      }
    }
  }

  public onSync(callback: (db: DatabaseSchema) => void): () => void {
    this.syncListeners.push(callback);
    return () => {
      this.syncListeners = this.syncListeners.filter(l => l !== callback);
    };
  }

  private broadcast(data: DatabaseSchema): void {
    if (this.channel) {
      try {
        this.channel.postMessage({ type: 'SYNC_DATA', payload: data });
      } catch (e) {
        console.warn('Broadcast error:', e);
      }
    }
  }

  private openDB(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve, reject) => {
      if (typeof window === 'undefined' || !('indexedDB' in window)) {
        reject(new Error('IndexedDB not supported'));
        return;
      }

      const request = indexedDB.open(IDB_NAME, 1);

      request.onupgradeneeded = (e) => {
        const db = request.result;
        if (!db.objectStoreNames.contains('app_state')) {
          db.createObjectStore('app_state');
        }
        if (!db.objectStoreNames.contains('backups')) {
          const backupStore = db.createObjectStore('backups', { keyPath: 'id' });
          backupStore.createIndex('timestamp', 'timestamp', { unique: false });
        }
      };

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });

    return this.dbPromise;
  }

  /**
   * Load current database state from IndexedDB with fallback to localStorage
   */
  public async loadState(): Promise<DatabaseSchema | null> {
    try {
      const db = await this.openDB();
      const tx = db.transaction('app_state', 'readonly');
      const store = tx.objectStore('app_state');

      const data = await new Promise<DatabaseSchema | null>((resolve, reject) => {
        const req = store.get('current');
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
      });

      if (data) return data;
    } catch (e) {
      console.warn('IndexedDB read failed, falling back to localStorage:', e);
    }

    // Fallback: check localStorage (v5 then v4)
    if (typeof localStorage !== 'undefined') {
      try {
        const rawV5 = localStorage.getItem(STORAGE_KEY_V5);
        if (rawV5) return JSON.parse(rawV5);

        const rawV4 = localStorage.getItem(STORAGE_KEY_V4);
        if (rawV4) return JSON.parse(rawV4);
      } catch (err) {
        console.error('LocalStorage parse error:', err);
      }
    }

    return null;
  }

  /**
   * Save database state to IndexedDB and mirror to localStorage
   */
  public async saveState(data: DatabaseSchema): Promise<void> {
    // 1. Mirror in localStorage for instant synchronous fallback
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY_V5, JSON.stringify(data));
      } catch (e) {
        console.warn('LocalStorage save error (likely quota exceeded):', e);
      }
    }

    // 2. Persist in IndexedDB
    try {
      const db = await this.openDB();
      const tx = db.transaction('app_state', 'readwrite');
      const store = tx.objectStore('app_state');
      store.put(data, 'current');

      await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch (e) {
      console.warn('IndexedDB write error:', e);
    }

    // 3. Broadcast to other open tabs
    this.broadcast(data);

    // 4. Trigger rolling backup check in background
    this.checkDailyRollingBackup(data).catch(() => {});
  }

  /**
   * Automatic rolling backup: retains up to 7 snapshots
   */
  public async checkDailyRollingBackup(currentData: DatabaseSchema): Promise<void> {
    try {
      const today = new Date().toISOString().split('T')[0];
      const backups = await this.getBackups();

      // Check if we already have a backup for today
      const hasToday = backups.some(b => b.dateStr === today);
      if (!hasToday) {
        await this.createBackup(currentData, `Backup diário automático (${today})`);
      }
    } catch (e) {
      console.warn('Rolling backup error:', e);
    }
  }

  public async createBackup(data: DatabaseSchema, reason: string): Promise<string> {
    const id = `backup-${Date.now()}`;
    const snapshot: BackupSnapshot = {
      id,
      timestamp: new Date().toISOString(),
      dateStr: new Date().toISOString().split('T')[0],
      reason,
      data: JSON.parse(JSON.stringify(data)),
    };

    try {
      const db = await this.openDB();
      const tx = db.transaction('backups', 'readwrite');
      const store = tx.objectStore('backups');
      store.put(snapshot);

      await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });

      // Prune backups beyond the 7 most recent
      await this.pruneBackups();
    } catch (e) {
      console.warn('Failed to store backup snapshot:', e);
    }

    return id;
  }

  public async getBackups(): Promise<BackupSnapshot[]> {
    try {
      const db = await this.openDB();
      const tx = db.transaction('backups', 'readonly');
      const store = tx.objectStore('backups');

      return await new Promise<BackupSnapshot[]>((resolve, reject) => {
        const req = store.getAll();
        req.onsuccess = () => {
          const list = (req.result || []) as BackupSnapshot[];
          list.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
          resolve(list);
        };
        req.onerror = () => reject(req.error);
      });
    } catch (e) {
      console.warn('Failed to get backups:', e);
      return [];
    }
  }

  private async pruneBackups(): Promise<void> {
    try {
      const backups = await this.getBackups();
      if (backups.length > 7) {
        const toDelete = backups.slice(7);
        const db = await this.openDB();
        const tx = db.transaction('backups', 'readwrite');
        const store = tx.objectStore('backups');
        toDelete.forEach(b => store.delete(b.id));
      }
    } catch (e) {
      console.warn('Failed to prune backups:', e);
    }
  }

  // ==== UNDO STACK ====
  public registerUndo(description: string, undoFn: () => Promise<void>): void {
    const entry: UndoEntry = {
      id: `undo-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      description,
      timestamp: Date.now(),
      undo: undoFn,
    };
    this.undoStack.push(entry);
    if (this.undoStack.length > this.MAX_UNDO) {
      this.undoStack.shift();
    }
  }

  public canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  public peekUndo(): UndoEntry | null {
    return this.undoStack.length > 0 ? this.undoStack[this.undoStack.length - 1] : null;
  }

  public async executeUndo(): Promise<{ description: string } | null> {
    const entry = this.undoStack.pop();
    if (!entry) return null;
    try {
      await entry.undo();
      return { description: entry.description };
    } catch (err) {
      console.error('Failed to execute undo:', err);
      return null;
    }
  }
}

export const idbManager = new IndexedDBManager();
