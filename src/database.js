// IndexedDB Database Module for PokerNow Reporter
const DB_NAME = 'PokerNowDB';
const DB_VERSION = 1;

class PokerDatabase {
  constructor() {
    this.db = null;
  }

  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains('games')) {
          const store = db.createObjectStore('games', { keyPath: 'id', autoIncrement: true });
          store.createIndex('gameId', 'gameId', { unique: true });
        }
      };
    });
  }

  async saveGame(gameData) {
    return new Promise((resolve, reject) => {
      const checkTransaction = this.db.transaction(['games'], 'readonly');
      const checkStore = checkTransaction.objectStore('games');
      const checkIndex = checkStore.index('gameId');
      const checkRequest = checkIndex.get(gameData.gameId);

      checkRequest.onsuccess = () => {
        if (checkRequest.result) {
          console.log('Game already exists:', gameData.gameId);
          resolve(checkRequest.result.id);
          return;
        }

        const addTransaction = this.db.transaction(['games'], 'readwrite');
        const addStore = addTransaction.objectStore('games');

        addTransaction.onerror = (event) => {
          console.error('Add transaction error:', event.target.error);
          reject(event.target.error);
        };

        const addRequest = addStore.add(gameData);

        addRequest.onsuccess = () => {
          console.log('✓ Game saved successfully with ID:', addRequest.result);
          resolve(addRequest.result);
        };

        addRequest.onerror = (event) => {
          console.error('✗ Add request error:', event.target.error);
          reject(event.target.error);
        };
      };

      checkRequest.onerror = () => {
        console.error('Check request error, attempting to add anyway');
        const addTransaction = this.db.transaction(['games'], 'readwrite');
        const addStore = addTransaction.objectStore('games');
        const addRequest = addStore.add(gameData);

        addRequest.onsuccess = () => {
          console.log('✓ Game saved successfully with ID:', addRequest.result);
          resolve(addRequest.result);
        };

        addRequest.onerror = (event) => {
          console.error('✗ Add request error:', event.target.error);
          reject(event.target.error);
        };
      };
    });
  }

  async getAllGames() {
    const transaction = this.db.transaction(['games'], 'readonly');
    const store = transaction.objectStore('games');
    const request = store.getAll();
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getGameByGameId(gameId) {
    return new Promise((resolve, reject) => {
      try {
        const transaction = this.db.transaction(['games'], 'readonly');
        const store = transaction.objectStore('games');
        const index = store.index('gameId');
        const request = index.get(gameId);

        request.onsuccess = () => {
          resolve(request.result || null);
        };

        request.onerror = () => {
          resolve(null);
        };
      } catch (error) {
        console.error('getGameByGameId error:', error);
        resolve(null);
      }
    });
  }

  async deleteGame(id) {
    const transaction = this.db.transaction(['games'], 'readwrite');
    const store = transaction.objectStore('games');
    const request = store.delete(id);
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async clearAllData() {
    const transaction = this.db.transaction(['games'], 'readwrite');
    const store = transaction.objectStore('games');
    const request = store.clear();
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async exportToJSON() {
    const games = await this.getAllGames();
    return {
      version: DB_VERSION,
      exportDate: new Date().toISOString(),
      games: games,
      gameCount: games.length,
      appName: 'PokerNow Reporter'
    };
  }

  async importFromJSON(jsonData) {
    if (!jsonData.games || !Array.isArray(jsonData.games)) {
      throw new Error('Invalid backup file format');
    }

    await this.clearAllData();

    for (const game of jsonData.games) {
      const gameToImport = { ...game };
      delete gameToImport.id;
      await this.saveGame(gameToImport);
    }

    return jsonData.games.length;
  }
}

const db = new PokerDatabase();
export default db;
