/**
 * IndexedDB: aviso de mudanca para as outras abas e a leitura da copia antiga.
 *
 * O banco em si NAO mora aqui — ele vive no Supabase (fonte unica). Este modulo
 * nao guarda mais nenhum snapshot do banco: os backups-automaticos locais
 * foram removidos porque eram uma copia completa dos dados no navegador, que e
 * exatamente o que o usuario pediu para nao ter. O que sobrou e o que nao
 * duplica dado:
 *
 *  - `app_state`: lido UMA vez, na importacao dos dados de antes da nuvem. Logo
 *    depois de a nuvem confirmar, e apagado. Nada e escrito aqui de novo.
 *  - undo: pilha em memoria (morre ao fechar a aba), nao persistida.
 *  - `backups`: store removida. Quem quiser historico automatico precisa de uma
 *    tabela no Supabase, que exige uma migration rodada no dashboard.
 */

import { DatabaseSchema } from '../types';
import { 
  IDB_NAME, 
  SYNC_CHANNEL_NAME 
} from '../constants/app';

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

      // v2 descarta a store `backups`: as copiasautomaticas locais foram
      // removidas e o que nelas estava e redundante com o que ja esta na nuvem.
      // A store `app_state` e preservada de proposito — e dela que sai a
      // importacao, e destrui-la aqui apagaria os dados de quem ainda nao
      // digitou a chave.
      const request = indexedDB.open(IDB_NAME, 2);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('app_state')) {
          db.createObjectStore('app_state');
        }
        if (db.objectStoreNames.contains('backups')) {
          db.deleteObjectStore('backups');
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
   * Le a copia local antiga do banco, que sobrou de antes de o Supabase virar
   * a fonte unica. So e chamada uma vez, na importacao. Depois disso o app
   * nunca mais persiste o banco aqui.
   */
  public async loadLegacyState(): Promise<DatabaseSchema | null> {
    try {
      const db = await this.openDB();
      const tx = db.transaction('app_state', 'readonly');
      const store = tx.objectStore('app_state');
      return await new Promise<DatabaseSchema | null>((resolve, reject) => {
        const req = store.get('current');
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
      });
    } catch (e) {
      console.warn('IndexedDB read failed:', e);
      return null;
    }
  }

  /**
   * Apaga a copia local antiga do banco. Chamada uma unica vez, depois que a
   * nuvem ja confirmou a importacao: enquanto ela nao confirmar, esta copia e
   * a unica rede de seguranca que existe.
   */
  public async deleteLegacyState(): Promise<void> {
    try {
      const db = await this.openDB();
      if (!db.objectStoreNames.contains('app_state')) return;
      const tx = db.transaction('app_state', 'readwrite');
      tx.objectStore('app_state').delete('current');
      await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      });
    } catch (e) {
      console.warn('Nao foi possivel apagar a copia local antiga:', e);
    }
  }

  /**
   * Confirma que o estado foi salvo — na nuvem, que e onde ele mora.
   *
   * Aqui nao se grava nada: o espelho em localStorage foi removido, o
   * IndexedDB nao recebe mais o snapshot do dia, e o que sobra e avisar as
   * outras abas abertas que o estado delas ficou velho.
   */
  public notifySaved(data: DatabaseSchema): void {
    this.broadcast(data);
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
