import React, { useState, useEffect } from 'react';
import { Download, Trash2, AlertCircle, CheckCircle, TrendingUp, TrendingDown, Upload, ArrowRight, Database, Save } from 'lucide-react';

// IndexedDB Database
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
      // First check if game already exists
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

        // Game doesn't exist, add it
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
        // Try to add anyway
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

    // Clear existing data first
    await this.clearAllData();

    // Import each game
    for (const game of jsonData.games) {
      // Remove the database ID to let it auto-generate
      const gameToImport = { ...game };
      delete gameToImport.id;
      await this.saveGame(gameToImport);
    }

    return jsonData.games.length;
  }
}

const db = new PokerDatabase();

export default function PokerNowReporter() {
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [isInitialized, setIsInitialized] = useState(false);
  const [showBackupModal, setShowBackupModal] = useState(false);
  const [backupData, setBackupData] = useState('');

  const playerAliases = {
    'cs': 'Chintan Shah',
    'sas': 'Simal Shah',
    'mani27': 'Manigandan Manjunathan',
    'gp': 'Gaurav Jain',
    'pratik': 'Pratik Shah',
    'kd': 'Keval Desai',
    'harshit': 'Harshit Metha',
    'shivang': 'Shivang',
    'n23': 'Nisarg'
  };

  const getPlayerFullName = (username) => {
    const key = username.toLowerCase().trim();
    return playerAliases[key] || username;
  };

  useEffect(() => {
    initializeApp();
  }, []);

  const initializeApp = async () => {
    try {
      console.log('🔄 Initializing database...');
      await db.init();
      console.log('✓ Database initialized');

      const dbGames = await db.getAllGames();
      console.log('✓ Loaded games from DB:', dbGames.length);
      console.log('Games data:', dbGames);

      setGames(dbGames);
      setIsInitialized(true);

      if (dbGames.length > 0) {
        showMessage('success', `Database loaded: ${dbGames.length} games`);
      }
    } catch (error) {
      console.error('❌ Init error:', error);
      showMessage('error', 'Database initialization failed');
      setIsInitialized(true);
    }
  };

  const showMessage = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage({ type: '', text: '' }), 5000);
  };

  const parseCSV = (csvText) => {
    const lines = csvText.trim().split('\n');
    const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim());
    const data = [];

    for (let i = 1; i < lines.length; i++) {
      const values = [];
      let current = '';
      let inQuotes = false;

      for (let char of lines[i]) {
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          values.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      values.push(current.trim());

      const row = {};
      headers.forEach((header, index) => {
        row[header] = values[index] || '';
      });
      data.push(row);
    }

    return data;
  };

  const analyzeGameData = (csvData) => {
    const playerStats = {};
    let totalBuyIn = 0;
    let gameDate = null;

    csvData.forEach(row => {
      const player = row.player_nickname.trim(); // Keep original case
      const fullName = getPlayerFullName(player);
      const buyIn = parseFloat(row.buy_in) || 0;
      const buyOut = parseFloat(row.buy_out) || 0;
      const net = parseFloat(row.net) || 0;
      const sessionStart = row.session_start_at;

      if (sessionStart && !gameDate) {
        gameDate = new Date(sessionStart).toISOString().split('T')[0];
      }

      const playerKey = player.toLowerCase(); // Use lowercase for grouping

      if (!playerStats[playerKey]) {
        playerStats[playerKey] = {
          name: player,
          fullName: fullName,
          buyIn: 0,
          buyOut: 0,
          net: 0
        };
      }

      playerStats[playerKey].buyIn += buyIn;
      playerStats[playerKey].buyOut += buyOut;
      playerStats[playerKey].net += net;
      totalBuyIn += buyIn;
    });

    const players = Object.values(playerStats).sort((a, b) => b.net - a.net);
    const winner = players[0];

    return {
      gameDate,
      players,
      winner: winner.name,
      winnerFullName: winner.fullName,
      winnerProfit: winner.net,
      totalPot: totalBuyIn,
      playerCount: players.length
    };
  };

  const handleFileUpload = async (event) => {
    console.log('File upload triggered');
    const files = Array.from(event.target.files);
    console.log('Files selected:', files.length, files);

    if (files.length === 0) {
      console.log('No files selected');
      return;
    }

    const nonCsvFiles = files.filter(file => !file.name.endsWith('.csv'));
    if (nonCsvFiles.length > 0) {
      showMessage('error', 'Please upload only CSV files');
      console.log('Non-CSV files:', nonCsvFiles);
      return;
    }

    setLoading({ current: 0, total: files.length });
    const errors = [];
    let successCount = 0;

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        console.log(`Processing file ${i + 1}/${files.length}:`, file.name);
        setLoading({ current: i + 1, total: files.length });

        try {
          const text = await file.text();
          console.log('File text length:', text.length);
          console.log('First 200 chars:', text.substring(0, 200));

          const csvData = parseCSV(text);
          console.log('Parsed CSV rows:', csvData.length);
          console.log('First row:', csvData[0]);

          const analysis = analyzeGameData(csvData);
          console.log('Analysis:', analysis);

          const gameId = file.name.replace('.csv', '').replace('ledger_', '');

          const gameData = {
            gameId,
            date: analysis.gameDate,
            players: analysis.players,
            playerCount: analysis.playerCount,
            winner: analysis.winner,
            winnerProfit: analysis.winnerProfit,
            totalPot: analysis.totalPot,
            addedAt: new Date().toISOString()
          };

          console.log('Saving game:', gameData);
          await db.saveGame(gameData);
          successCount++;
          console.log('Game saved successfully');
        } catch (error) {
          console.error('Error processing file:', file.name, error);
          errors.push(`${file.name}: ${error.message}`);
        }
      }

      // Reload games from database
      console.log('Reloading games from database...');
      const dbGames = await db.getAllGames();
      console.log('Loaded games:', dbGames.length, dbGames);
      setGames(dbGames);

      if (errors.length > 0) {
        showMessage('error', `${successCount} added, ${errors.length} failed: ${errors.join(', ')}`);
      } else {
        showMessage('success', `Successfully added ${successCount} game${successCount > 1 ? 's' : ''}!`);
      }

      event.target.value = '';
    } catch (error) {
      console.error('Upload error:', error);
      showMessage('error', `Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const deleteGame = async (id) => {
    try {
      await db.deleteGame(id);
      const dbGames = await db.getAllGames();
      setGames(dbGames);
      showMessage('success', 'Game deleted');
    } catch (error) {
      showMessage('error', 'Delete failed: ' + error.message);
    }
  };

  const clearAllGames = async () => {
    if (window.confirm('Delete all games? This cannot be undone.')) {
      try {
        await db.clearAllData();
        setGames([]);
        showMessage('success', 'All games cleared!');
      } catch (error) {
        showMessage('error', 'Clear failed: ' + error.message);
      }
    }
  };

  const exportDatabase = async () => {
    try {
      const data = await db.exportToJSON();
      const jsonString = JSON.stringify(data, null, 2);

      // Always show in modal (downloads are blocked in Claude.ai)
      console.log('Opening backup modal with data length:', jsonString.length);
      setBackupData(jsonString);
      setShowBackupModal(true);
    } catch (error) {
      console.error('Backup error:', error);
      showMessage('error', 'Backup failed: ' + error.message);
    }
  };

  const copyBackupToClipboard = () => {
    navigator.clipboard.writeText(backupData).then(() => {
      showMessage('success', 'Backup copied to clipboard!');
    }).catch(() => {
      showMessage('error', 'Failed to copy. Please select and copy manually.');
    });
  };

  const downloadBackupFromModal = () => {
    try {
      // Create a data URI instead of blob
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(backupData);
      const link = document.createElement('a');
      link.setAttribute('href', dataStr);
      link.setAttribute('download', `pokernow_backup_${new Date().toISOString().split('T')[0]}.json`);
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setShowBackupModal(false);
      showMessage('success', 'Backup file created! Check your downloads.');
    } catch (error) {
      console.error('Download error:', error);
      showMessage('info', 'Download blocked. Please use "Copy to Clipboard" instead.');
    }
  };

  const importDatabase = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (!file.name.endsWith('.json')) {
      showMessage('error', 'Please upload a JSON backup file');
      return;
    }

    if (!window.confirm('This will replace all current data with the backup. Continue?')) {
      event.target.value = '';
      return;
    }

    try {
      const text = await file.text();
      const jsonData = JSON.parse(text);

      const importedCount = await db.importFromJSON(jsonData);
      const dbGames = await db.getAllGames();
      setGames(dbGames);

      showMessage('success', `Restored ${importedCount} games from backup!`);
      event.target.value = '';
    } catch (error) {
      showMessage('error', 'Import failed: ' + error.message);
      event.target.value = '';
    }
  };

  const calculateSettlements = () => {
    const playerTotals = {};

    games.forEach(game => {
      if (game.players) {
        game.players.forEach(player => {
          const key = player.name.toLowerCase().trim();
          const fullName = player.fullName || getPlayerFullName(player.name);
          if (!playerTotals[key]) {
            playerTotals[key] = {
              name: player.name,
              fullName: fullName,
              totalNet: 0
            };
          }
          playerTotals[key].totalNet += player.net || 0;
        });
      }
    });

    const players = Object.values(playerTotals);
    const creditors = players.filter(p => p.totalNet > 0).sort((a, b) => b.totalNet - a.totalNet);
    const debtors = players.filter(p => p.totalNet < 0).sort((a, b) => a.totalNet - b.totalNet);

    const settlements = [];
    let ci = 0, di = 0;

    while (ci < creditors.length && di < debtors.length) {
      const creditor = creditors[ci];
      const debtor = debtors[di];
      const amount = Math.min(creditor.totalNet, Math.abs(debtor.totalNet));

      settlements.push({
        from: debtor.fullName,
        to: creditor.fullName,
        amount: amount,
        actualValue: (amount / 100).toFixed(2)
      });

      creditor.totalNet -= amount;
      debtor.totalNet += amount;

      if (creditor.totalNet === 0) ci++;
      if (debtor.totalNet === 0) di++;
    }

    return settlements;
  };

  const exportToCSV = () => {
    if (games.length === 0) {
      showMessage('error', 'No games to export');
      return;
    }

    const rows = [['PokerNow Games Report'], ['Generated', new Date().toLocaleString()], []];

    const playerStats = {};
    games.forEach(game => {
      if (game.players) {
        game.players.forEach(player => {
          const key = player.name.toLowerCase().trim();
          const fullName = player.fullName || getPlayerFullName(player.name);
          if (!playerStats[key]) {
            playerStats[key] = {
              name: player.name,
              fullName: fullName,
              totalBuyIn: 0,
              totalBuyOut: 0,
              totalNet: 0,
              gamesPlayed: 0,
              wins: 0
            };
          }
          playerStats[key].totalBuyIn += player.buyIn || 0;
          playerStats[key].totalBuyOut += player.buyOut || 0;
          playerStats[key].totalNet += player.net || 0;
          playerStats[key].gamesPlayed += 1;
          if (game.winner.toLowerCase().trim() === key) {
            playerStats[key].wins += 1;
          }
        });
      }
    });

    const players = Object.values(playerStats).sort((a, b) => b.totalNet - a.totalNet);

    rows.push(['Player', 'Games', 'Wins', 'Total Net', 'Actual Value']);
    players.forEach(p => {
      rows.push([p.fullName, p.gamesPlayed, p.wins, p.totalNet, (p.totalNet / 100).toFixed(2)]);
    });

    const csvContent = '\uFEFF' + rows.map(row => row.join(',')).join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `pokernow_report_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    window.URL.revokeObjectURL(url);

    showMessage('success', 'Report exported!');
  };

  if (!isInitialized) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-900 to-green-700 flex items-center justify-center">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-900 to-green-700 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-lg shadow-2xl overflow-hidden">
          <div className="bg-gradient-to-r from-green-600 to-green-500 p-6 text-white">
            <h1 className="text-3xl font-bold">PokerNow Game Reporter</h1>
            <p className="mt-2 opacity-90">Track and analyze your poker game performance</p>
          </div>

          <div className="p-6">
            {showBackupModal && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
                  <div className="p-6 border-b">
                    <h2 className="text-2xl font-bold text-gray-800">Database Backup</h2>
                    <p className="text-sm text-gray-600 mt-2">Copy this JSON data or download it as a file</p>
                  </div>

                  <div className="p-6 overflow-auto flex-1">
                    <textarea
                      readOnly
                      value={backupData}
                      className="w-full h-96 p-4 border rounded font-mono text-xs bg-gray-50"
                      onClick={(e) => e.target.select()}
                    />
                  </div>

                  <div className="p-6 border-t flex gap-2 justify-end bg-gray-50">
                    <button
                      onClick={copyBackupToClipboard}
                      className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 font-semibold"
                    >
                      <Save size={20} />
                      Copy to Clipboard
                    </button>
                    <button
                      onClick={() => {
                        // Create download link
                        const element = document.createElement('a');
                        const file = new Blob([backupData], { type: 'application/json' });
                        element.href = URL.createObjectURL(file);
                        element.download = `pokernow_backup_${new Date().toISOString().split('T')[0]}.json`;
                        document.body.appendChild(element);
                        element.click();
                        document.body.removeChild(element);
                        setShowBackupModal(false);
                        showMessage('success', 'Backup downloaded!');
                      }}
                      className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2 font-semibold"
                    >
                      <Download size={20} />
                      Download File
                    </button>
                    <button
                      onClick={() => setShowBackupModal(false)}
                      className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 font-semibold"
                    >
                      Close
                    </button>
                  </div>
                  <div className="px-6 pb-4 bg-gray-50 border-t">
                    <p className="text-sm text-gray-600">
                      💡 <strong>Note:</strong> If download is blocked, use "Copy to Clipboard" and paste into a text editor to save as <code className="bg-gray-200 px-2 py-1 rounded">backup.json</code>
                    </p>
                  </div>
                </div>
              </div>
            )}

            {message.text && (
              <div className={`mb-4 p-4 rounded-lg flex items-center gap-2 ${message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                }`}>
                {message.type === 'success' ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
                {message.text}
              </div>
            )}

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Upload CSV Ledger Files
              </label>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-green-500 transition-colors bg-gradient-to-br from-green-50 to-blue-50">
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="file-upload"
                  disabled={loading}
                  multiple
                />
                <label htmlFor="file-upload" className="cursor-pointer flex flex-col items-center gap-3">
                  <Upload size={48} className="text-green-600" />
                  <div>
                    <span className="text-lg font-semibold text-gray-700 block">
                      Click to upload CSV files
                    </span>
                    <span className="text-sm text-gray-500 mt-1 block">
                      Select multiple files at once
                    </span>
                  </div>
                  {loading && (
                    <div className="mt-2">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto"></div>
                      <p className="text-sm text-gray-600 mt-2">Processing {loading.current} of {loading.total}...</p>
                    </div>
                  )}
                </label>
              </div>
              <p className="mt-2 text-xs text-gray-500 text-center">
                💡 Open browser console (F12) to see detailed upload logs
              </p>
            </div>

            <div className="flex justify-between items-center mb-4">
              <div>
                <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                  <Database size={24} className="text-green-600" />
                  Games in Database: {games.length}
                </h2>
                <p className="text-sm text-gray-600 mt-1">
                  {games.length === 0 ? 'No games stored yet' : `${games.reduce((sum, g) => sum + (g.players?.length || 0), 0)} total player records`}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={exportDatabase}
                  disabled={games.length === 0}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2"
                  title="Export database backup"
                >
                  <Save size={18} />
                  Backup
                </button>
                <input
                  type="file"
                  accept=".json"
                  onChange={importDatabase}
                  className="hidden"
                  id="import-backup"
                />
                <label
                  htmlFor="import-backup"
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 cursor-pointer flex items-center gap-2"
                  title="Restore from backup"
                >
                  <Upload size={18} />
                  Restore
                </label>
                <button
                  onClick={exportToCSV}
                  disabled={games.length === 0}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  <Download size={18} />
                  Export
                </button>
                <button
                  onClick={clearAllGames}
                  disabled={games.length === 0}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  <Trash2 size={18} />
                  Clear
                </button>
              </div>
            </div>

            {games.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <p className="text-lg">No games yet. Upload CSV files to start!</p>
              </div>
            ) : (
              <>
                <div className="mb-6 p-4 bg-green-50 rounded-lg border-2 border-green-200">
                  <p className="text-lg font-bold text-green-800">✓ {games.length} Games Loaded</p>
                </div>

                <div className="mb-8 bg-blue-50 p-6 rounded-lg">
                  <h2 className="text-2xl font-bold mb-4">📊 Consolidated Player Statistics</h2>

                  {/* Financial Summary Cards */}
                  {(() => {
                    const playerStats = {};
                    games.forEach(game => {
                      if (game.players) {
                        game.players.forEach(player => {
                          const key = player.name.toLowerCase().trim();
                          const fullName = player.fullName || getPlayerFullName(player.name);
                          if (!playerStats[key]) {
                            playerStats[key] = {
                              name: player.name,
                              fullName: fullName,
                              totalNet: 0
                            };
                          }
                          playerStats[key].totalNet += player.net || 0;
                        });
                      }
                    });

                    const players = Object.values(playerStats);
                    const totalReceivable = players
                      .filter(p => p.totalNet > 0)
                      .reduce((sum, p) => sum + p.totalNet, 0);
                    const totalPayable = players
                      .filter(p => p.totalNet < 0)
                      .reduce((sum, p) => sum + Math.abs(p.totalNet), 0);
                    const balance = totalReceivable - totalPayable;

                    return (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                        {/* Total Receivable */}
                        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-lg p-6 text-white shadow-lg">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-green-100 text-sm font-medium mb-1">Total Receivable</p>
                              <p className="text-3xl font-bold">₹{(totalReceivable / 100).toFixed(2)}</p>
                              <p className="text-green-100 text-xs mt-1">Amount to be received</p>
                            </div>
                            <TrendingUp size={48} className="opacity-50" />
                          </div>
                        </div>

                        {/* Total Payable */}
                        <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-lg p-6 text-white shadow-lg">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-red-100 text-sm font-medium mb-1">Total Payable</p>
                              <p className="text-3xl font-bold">₹{(totalPayable / 100).toFixed(2)}</p>
                              <p className="text-red-100 text-xs mt-1">Amount to be paid</p>
                            </div>
                            <TrendingDown size={48} className="opacity-50" />
                          </div>
                        </div>

                        {/* Balance Check */}
                        <div className={`bg-gradient-to-br ${Math.abs(balance) < 1 ? 'from-blue-500 to-blue-600' :
                          balance > 0 ? 'from-orange-500 to-orange-600' : 'from-purple-500 to-purple-600'
                          } rounded-lg p-6 text-white shadow-lg`}>
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-white text-opacity-90 text-sm font-medium mb-1">Balance Check</p>
                              <p className="text-3xl font-bold">
                                {Math.abs(balance) < 1 ? '✓ Balanced' : `₹${Math.abs(balance / 100).toFixed(2)}`}
                              </p>
                              <p className="text-white text-opacity-90 text-xs mt-1">
                                {Math.abs(balance) < 1 ? 'All settlements match' :
                                  balance > 0 ? 'Receivable > Payable' : 'Payable > Receivable'}
                              </p>
                            </div>
                            <CheckCircle size={48} className="opacity-50" />
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  <div className="overflow-x-auto">
                    <table className="w-full text-sm bg-white rounded shadow">
                      <thead>
                        <tr className="bg-blue-600 text-white">
                          <th className="p-3 text-left">Rank</th>
                          <th className="p-3 text-left">Player</th>
                          <th className="p-3 text-center">Games</th>
                          <th className="p-3 text-center">Wins</th>
                          <th className="p-3 text-right">Total Buy-In</th>
                          <th className="p-3 text-right">Total Buy-Out</th>
                          <th className="p-3 text-right">Total Net P/L</th>
                          <th className="p-3 text-center">Win Rate</th>
                          <th className="p-3 text-right">Actual Value</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(() => {
                          const playerStats = {};
                          games.forEach(game => {
                            if (game.players) {
                              game.players.forEach(player => {
                                const key = player.name.toLowerCase().trim();
                                const fullName = player.fullName || getPlayerFullName(player.name);
                                if (!playerStats[key]) {
                                  playerStats[key] = {
                                    name: player.name,
                                    fullName: fullName,
                                    totalBuyIn: 0,
                                    totalBuyOut: 0,
                                    totalNet: 0,
                                    games: 0,
                                    wins: 0
                                  };
                                }
                                playerStats[key].totalBuyIn += player.buyIn || 0;
                                playerStats[key].totalBuyOut += player.buyOut || 0;
                                playerStats[key].totalNet += player.net || 0;
                                playerStats[key].games += 1;
                                if (game.winner.toLowerCase().trim() === key) {
                                  playerStats[key].wins += 1;
                                }
                              });
                            }
                          });
                          return Object.values(playerStats)
                            .sort((a, b) => b.totalNet - a.totalNet)
                            .map((p, i) => {
                              const winRate = p.games > 0 ? ((p.wins / p.games) * 100).toFixed(1) : '0.0';
                              const actualValue = (p.totalNet / 100).toFixed(2);

                              return (
                                <tr key={i} className="border-b hover:bg-blue-50">
                                  <td className="p-3 text-center">
                                    <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full font-bold ${i === 0 ? 'bg-yellow-400 text-yellow-900' :
                                      i === 1 ? 'bg-gray-300 text-gray-700' :
                                        i === 2 ? 'bg-orange-400 text-orange-900' :
                                          'bg-gray-100 text-gray-600'
                                      }`}>
                                      {i + 1}
                                    </span>
                                  </td>
                                  <td className="p-3">
                                    <div className="font-bold">{p.fullName}</div>
                                    <div className="text-xs text-gray-500">{p.name}</div>
                                  </td>
                                  <td className="p-3 text-center">{p.games}</td>
                                  <td className="p-3 text-center">
                                    <span className="px-2 py-1 bg-green-100 text-green-800 rounded font-semibold">
                                      {p.wins}
                                    </span>
                                  </td>
                                  <td className="p-3 text-right text-gray-700">₹{p.totalBuyIn.toLocaleString()}</td>
                                  <td className="p-3 text-right text-gray-700">₹{p.totalBuyOut.toLocaleString()}</td>
                                  <td className={`p-3 text-right font-bold ${p.totalNet > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                    {p.totalNet > 0 ? '+' : ''}₹{p.totalNet.toLocaleString()}
                                  </td>
                                  <td className="p-3 text-center">
                                    <span className={`px-2 py-1 rounded font-semibold ${parseFloat(winRate) >= 50 ? 'bg-green-100 text-green-800' :
                                      parseFloat(winRate) >= 25 ? 'bg-yellow-100 text-yellow-800' :
                                        'bg-red-100 text-red-800'
                                      }`}>
                                      {winRate}%
                                    </span>
                                  </td>
                                  <td className={`p-3 text-right font-semibold ${parseFloat(actualValue) > 0 ? 'text-green-600' :
                                    parseFloat(actualValue) < 0 ? 'text-red-600' :
                                      'text-gray-600'
                                    }`}>
                                    {parseFloat(actualValue) > 0 ? '+' : ''}₹{actualValue}
                                  </td>
                                </tr>
                              );
                            });
                        })()}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="mb-8 bg-orange-50 p-6 rounded-lg">
                  <h2 className="text-2xl font-bold mb-4">💰 Settlements</h2>
                  {(() => {
                    const settlements = calculateSettlements();
                    if (settlements.length === 0) {
                      return <p className="text-center text-gray-600">All even!</p>;
                    }
                    return settlements.map((s, i) => (
                      <div key={i} className="bg-white p-4 rounded shadow mb-2 flex justify-between items-center">
                        <div className="flex items-center gap-4">
                          <span className="font-bold text-red-600">{s.from}</span>
                          <ArrowRight />
                          <span className="font-bold text-green-600">{s.to}</span>
                        </div>
                        <span className="text-xl font-bold text-orange-600">₹{s.actualValue}</span>
                      </div>
                    ));
                  })()}
                </div>

                <h2 className="text-2xl font-bold mb-4">🎮 Games</h2>
                <div className="space-y-4">
                  {games.map((game) => (
                    <div key={game.id} className="border rounded-lg p-4 bg-gray-50">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <p className="font-bold">{game.date}</p>
                          <p className="text-sm text-gray-600">{game.gameId}</p>
                        </div>
                        <button onClick={() => deleteGame(game.id)} className="text-red-600 hover:bg-red-100 p-2 rounded">
                          <Trash2 size={18} />
                        </button>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
                        <div className="bg-blue-50 p-2 rounded">
                          <p className="text-xs text-gray-600">Players</p>
                          <p className="font-bold">{game.playerCount}</p>
                        </div>
                        <div className="bg-green-50 p-2 rounded">
                          <p className="text-xs text-gray-600">Winner</p>
                          <p className="font-bold text-sm">
                            {game.winnerFullName || getPlayerFullName(game.winner)}
                          </p>
                          <p className="text-xs text-gray-500">{game.winner}</p>
                        </div>
                        <div className="bg-purple-50 p-2 rounded">
                          <p className="text-xs text-gray-600">Profit</p>
                          <p className="font-bold">₹{game.winnerProfit}</p>
                        </div>
                        <div className="bg-orange-50 p-2 rounded">
                          <p className="text-xs text-gray-600">Total Pot</p>
                          <p className="font-bold">₹{game.totalPot}</p>
                        </div>
                      </div>
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b">
                            <th className="p-2 text-left">Player</th>
                            <th className="p-2 text-right">Buy-In</th>
                            <th className="p-2 text-right">Buy-Out</th>
                            <th className="p-2 text-right">Net</th>
                          </tr>
                        </thead>
                        <tbody>
                          {game.players && game.players.map((p, i) => (
                            <tr key={i} className="border-b">
                              <td className="p-2">
                                <div className="font-medium">{p.fullName || getPlayerFullName(p.name)}</div>
                                <div className="text-xs text-gray-500">{p.name}</div>
                              </td>
                              <td className="p-2 text-right">₹{p.buyIn}</td>
                              <td className="p-2 text-right">₹{p.buyOut}</td>
                              <td className={`p-2 text-right font-bold ${p.net > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {p.net > 0 ? '+' : ''}₹{p.net}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
