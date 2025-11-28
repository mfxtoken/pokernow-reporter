import React, { useState, useEffect } from 'react';
import {
  Download,
  Trash2,
  AlertCircle,
  CheckCircle,
  TrendingUp,
  TrendingDown,
  Upload,
  ArrowRight,
  Database,
  Save,
  Cloud,
  Settings,
  Users,
  Calendar,
  Trophy,
  LogOut,
  User,
  Lock,
  Moon,
  Sun,
  RotateCcw, // Added for potential future use or if it was intended
  Check, // Added for potential future use or if it was intended
  X // Added for potential future use or if it was intended
} from 'lucide-react';
import html2canvas from 'html2canvas';
import {
  hasCredentials,
  uploadGame,
  fetchAllGames,
  signIn,
  signUp,
  signOut,
  getCurrentUser,
  getProfile,
  updateProfile,
  onAuthStateChange,
  getSettlements,
  updateSettlement
} from './lib/supabase';

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

  // Cloud Sync State
  const [isCloudConnected, setIsCloudConnected] = useState(hasCredentials());
  const [syncing, setSyncing] = useState(false);

  // Auth State
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState('login'); // 'login' or 'signup'
  const [authLoading, setAuthLoading] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const [settlements, setSettlements] = useState({}); // Store cloud settlements
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('darkMode');
    return saved ? JSON.parse(saved) : false;
  });
  const reportRef = useRef(null);

  useEffect(() => {
    localStorage.setItem('darkMode', darkMode);
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

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
    checkUser();

    // Listen for auth changes
    const authListener = onAuthStateChange(async (event, session) => {
      if (session?.user) {
        setUser(session.user);
        loadProfile(session.user.id);
      } else {
        setUser(null);
        setProfile(null);
      }
    });

    return () => {
      // Cleanup if needed
      if (authListener?.data?.subscription?.unsubscribe) {
        authListener.data.subscription.unsubscribe();
      }
    };
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showProfileDropdown && !event.target.closest('.profile-dropdown-container')) {
        setShowProfileDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showProfileDropdown]);

  const initializeApp = async () => {
    try {
      console.log('🔄 Initializing database...');
      await db.init();
      console.log('✓ Database initialized');

      await loadGames();
      setIsInitialized(true);
    } catch (error) {
      console.error('❌ Init error:', error);
      showMessage('error', 'Database initialization failed');
      setIsInitialized(true);
    }
  };

  const loadGames = async () => {
    try {
      console.log('🔍 Loading games from IndexedDB...');
      const dbGames = await db.getAllGames();
      console.log('✓ Loaded games from DB:', dbGames.length);

      // If cloud is connected, fetch and merge
      if (isCloudConnected) {
        try {
          console.log('☁️ Fetching from cloud...');
          const cloudGames = await fetchAllGames();
          const cloudSettlements = await getSettlements();
          console.log('✓ Cloud games:', cloudGames.length);

          // Convert cloud settlements array to object keyed by debtor-creditor
          const settlementsMap = {};
          cloudSettlements.forEach(s => {
            // Ensure actualAmount is included if available, or default to amount
            settlementsMap[`${s.debtor}-${s.creditor}`] = {
              ...s,
              actualAmount: s.actualAmount !== undefined ? s.actualAmount : s.amount
            };
          });
          setSettlements(settlementsMap);

          // Merge games (cloud is source of truth, but keep local for offline)
          const mergedGames = [...dbGames];
          cloudGames.forEach(cloudGame => {
            if (!mergedGames.find(g => g.gameId === cloudGame.gameId)) {
              mergedGames.push(cloudGame);
            }
          });
          setGames(mergedGames);
          console.log('✓ Total games after merge:', mergedGames.length);

          if (mergedGames.length > dbGames.length) {
            showMessage('success', `Synced ${mergedGames.length - dbGames.length} games from cloud`);
          } else if (mergedGames.length > 0) {
            showMessage('success', `Loaded ${mergedGames.length} games`);
          }
        } catch (cloudError) {
          console.error('❌ Cloud fetch failed:', cloudError);
          setGames(dbGames);
          if (dbGames.length > 0) {
            showMessage('info', `Loaded ${dbGames.length} games from local database`);
          }
        }
      } else {
        setGames(dbGames);
        if (dbGames.length > 0) {
          console.log('✓ Using local games:', dbGames.length);
          showMessage('success', `Loaded ${dbGames.length} games from local database`);
        } else {
          console.log('ℹ️ No games in database');
        }
      }
    } catch (error) {
      console.error('❌ Error loading games:', error);
      showMessage('error', 'Failed to load games: ' + error.message);
    }
  };

  const checkUser = async () => {
    const currentUser = await getCurrentUser();
    if (currentUser) {
      setUser(currentUser);
      loadProfile(currentUser.id);
    }
  };

  const loadProfile = async (userId) => {
    const userProfile = await getProfile(userId);
    if (userProfile) {
      setProfile(userProfile);
    } else {
      // If no profile, show profile modal to link player name
      setShowProfileModal(true);
    }
  };

  const handleAuth = async (e) => {
    e.preventDefault();
    setAuthLoading(true);
    const formData = new FormData(e.target);
    const email = formData.get('email');
    const password = formData.get('password');

    try {
      if (authMode === 'signup') {
        await signUp(email, password);
        showMessage('success', 'Account created! Please check your email.');
      } else {
        await signIn(email, password);
        showMessage('success', 'Logged in successfully');
        setShowAuthModal(false);
      }
    } catch (error) {
      showMessage('error', error.message);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    await signOut();
    setUser(null);
    setProfile(null);
    showMessage('info', 'Logged out');
  };

  const handleLinkProfile = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const playerName = formData.get('playerName');
    console.log('Linking profile:', { userId: user?.id, playerName });

    if (user) {
      // Authenticated: update Supabase profile
      try {
        const updated = await updateProfile(user.id, playerName);
        console.log('Profile update result:', updated);
        setProfile(updated);
        showMessage('success', `Profile linked to ${playerName}`);
      } catch (error) {
        console.error('Link profile error (auth):', error);
        showMessage('error', 'Failed to link profile: ' + (error?.message || error));
      }
    } else {
      // No auth: store locally for UI personalization
      const local = { player_name: playerName };
      setProfile(local);
      // Optionally persist in localStorage
      localStorage.setItem('local_profile', JSON.stringify(local));
      showMessage('success', `Profile set to ${playerName}`);
    }
    setShowProfileModal(false);
  };

  const handleShareReport = async () => {
    if (!reportRef.current) return;

    try {
      const canvas = await html2canvas(reportRef.current, {
        backgroundColor: darkMode ? '#111827' : '#ffffff',
        scale: 2, // Higher quality
        logging: false,
        useCORS: true
      });

      const image = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.href = image;
      link.download = `pokernow-report-${new Date().toISOString().split('T')[0]}.png`;
      link.click();
    } catch (error) {
      console.error('Error generating report:', error);
      showMessage('error', 'Failed to generate report image');
    }
  };

  const handleSettlementAction = async (debtor, creditor, amount, action) => {
    if (!isCloudConnected) {
      showMessage('error', 'Please connect to Cloud Database to verify settlements');
      return;
    }
    if (!profile) {
      showMessage('error', 'Please link your profile to verify settlements');
      return;
    }

    let newStatus = action;
    // Map legacy actions if needed, though we'll switch to direct status selection
    if (action === 'pay') newStatus = 'pending'; // Default to pending if just 'pay'
    if (action === 'approve') newStatus = 'paid';
    if (action === 'reject') newStatus = 'pending'; // Reset to pending on reject

    try {
      await updateSettlement(debtor, creditor, newStatus, amount);

      // Update local state immediately
      setSettlements(prev => ({
        ...prev,
        [`${debtor}-${creditor}`]: { debtor, creditor, status: newStatus, amount }
      }));

      showMessage('success', `Settlement updated: ${newStatus.replace('_', ' ')}`);
    } catch (error) {
      showMessage('error', 'Failed to update settlement: ' + error.message);
    }
  };

  // Helper to get all unique player names for the dropdown
  const getAllPlayerNames = () => {
    const names = new Set();
    games.forEach(g => {
      if (g.players) {
        g.players.forEach(p => {
          names.add(p.fullName || getPlayerFullName(p.name));
        });
      }
    });
    return Array.from(names).sort();
  };

  const showMessage = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage({ type: '', text: '' }), 5000);
  };

  const parseCSV = (csvText) => {
    if (!csvText || !csvText.trim()) return [];

    const lines = csvText.trim().split('\n');
    if (lines.length < 2) return []; // Need at least header and one row

    const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim());
    const data = [];

    for (let i = 1; i < lines.length; i++) {
      // Skip empty lines
      if (!lines[i].trim()) continue;

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
    if (!csvData || csvData.length === 0) {
      return { players: [], playerCount: 0 };
    }

    const playerStats = {};
    let totalBuyIn = 0;
    let gameDate = null;

    csvData.forEach(row => {
      if (!row.player_nickname) return; // Skip invalid rows

      const player = row.player_nickname.trim();
      if (!player) return;

      const fullName = getPlayerFullName(player);
      const buyIn = parseFloat(row.buy_in) || 0;
      const buyOut = parseFloat(row.buy_out) || 0;
      const net = parseFloat(row.net) || 0;
      const sessionStart = row.session_start_at;

      if (sessionStart && !gameDate) {
        gameDate = new Date(sessionStart).toISOString().split('T')[0];
      }

      const playerKey = player.toLowerCase();

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

    if (players.length === 0) {
      return { players: [], playerCount: 0 };
    }

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
    const files = Array.from(event.target.files);
    if (files.length === 0) return;

    setLoading({ current: 0, total: files.length });

    try {
      const skipped = [];
      const errors = [];
      let successCount = 0;

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setLoading({ current: i + 1, total: files.length });

        try {
          console.log('Processing file:', file.name, 'Type:', file.type);

          // Check file type
          if (file.name.endsWith('.json')) {
            errors.push(`${file.name}: JSON files are not supported. Please upload CSV files from PokerNow.`);
            continue;
          }

          if (!file.name.endsWith('.csv') && file.type !== 'text/csv') {
            errors.push(`${file.name}: Unsupported file type. Please upload CSV files only.`);
            continue;
          }

          const text = await file.text();

          // Basic CSV validation
          if (!text || text.trim().length === 0) {
            errors.push(`${file.name}: File is empty`);
            continue;
          }

          const csvData = parseCSV(text);
          const analysis = analyzeGameData(csvData);

          if (!analysis || !analysis.players || analysis.players.length === 0) {
            errors.push(`${file.name}: No valid game data found. Make sure this is a PokerNow CSV file.`);
            continue;
          }

          const gameId = `game_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

          // Check for duplicate
          const existingGames = await db.getAllGames();
          const isDuplicate = existingGames.some(g =>
            g.date === analysis.gameDate &&
            g.winner === analysis.winner &&
            g.totalPot === analysis.totalPot
          );

          if (isDuplicate) {
            skipped.push(file.name);
            console.log('Duplicate game skipped:', file.name);
            continue;
          }

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

          // Upload to cloud if connected
          if (isCloudConnected) {
            console.log('Uploading to cloud...');
            const result = await uploadGame(gameData);
            if (result.status === 'skipped') {
              console.log('Game already exists in cloud');
            } else {
              console.log('Game uploaded to cloud');
            }
          }

          successCount++;
          console.log('✓ Game saved successfully');
        } catch (fileError) {
          console.error('❌ Error processing file:', file.name, fileError);
          errors.push(`${file.name}: ${fileError.message || 'Failed to parse'}`);
        }
      }

      // Reload games from database
      console.log('🔄 Reloading games from database...');
      try {
        const dbGames = await db.getAllGames();
        console.log('✓ Loaded games:', dbGames.length);
        setGames(dbGames);
      } catch (loadError) {
        console.error('❌ Error reloading games:', loadError);
        showMessage('error', 'Failed to reload games after upload');
      }

      // Show results
      let msg = '';
      if (successCount > 0) msg += `✓ Successfully added ${successCount} game${successCount > 1 ? 's' : ''}. `;
      if (skipped.length > 0) msg += `⊘ Skipped ${skipped.length} duplicate${skipped.length > 1 ? 's' : ''}. `;
      if (errors.length > 0) msg += `✗ Failed: ${errors.length} file${errors.length > 1 ? 's' : ''}.`;

      if (errors.length > 0) {
        console.error('Upload errors:', errors);
        showMessage('error', msg + ` Check console for details.`);
      } else if (skipped.length > 0 && successCount === 0) {
        showMessage('info', msg);
      } else if (successCount > 0) {
        showMessage('success', msg);
      }

      event.target.value = '';
    } catch (error) {
      console.error('❌ Fatal upload error:', error);
      showMessage('error', `Upload failed: ${error.message}. Please try again.`);

      // Try to reload games even on error
      try {
        const dbGames = await db.getAllGames();
        setGames(dbGames);
      } catch (loadError) {
        console.error('❌ Could not reload games:', loadError);
      }
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

  const handleSyncToCloud = async () => {
    if (!isCloudConnected) {
      showMessage('error', 'Cloud not connected');
      return;
    }

    setSyncing(true);
    let syncedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    try {
      const allGames = await db.getAllGames();
      for (const game of allGames) {
        try {
          const result = await uploadGame(game);
          if (result.status === 'skipped') {
            skippedCount++;
          } else {
            syncedCount++;
          }
        } catch (err) {
          console.error(`Failed to sync game ${game.gameId}:`, err);
          errorCount++;
        }
      }

      let msg = `Sync complete. Uploaded: ${syncedCount}, Skipped: ${skippedCount}`;
      if (errorCount > 0) msg += `, Errors: ${errorCount}`;

      showMessage(errorCount > 0 ? 'warning' : 'success', msg);

      // Refresh to ensure everything is in sync
      loadGames();
    } catch (error) {
      console.error('Sync error:', error);
      showMessage('error', 'Sync failed: ' + error.message);
    } finally {
      setSyncing(false);
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
        to: creditor.fullName,
        amount: Math.round(amount),
        actualAmount: amount
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
    <div className="min-h-screen bg-gradient-to-br from-green-900 to-green-700 dark:from-gray-900 dark:to-gray-800 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl overflow-hidden">
          <div className="bg-gradient-to-r from-green-600 to-green-500 dark:from-gray-700 dark:to-gray-600 p-6 text-white">
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-3xl font-bold">PokerNow Game Reporter</h1>
                <p className="mt-2 opacity-90">Track and analyze your poker game performance</p>
              </div>
              <div className="flex gap-3 items-center">
                {/* Dark Mode Toggle */}
                <button
                  onClick={() => setDarkMode(!darkMode)}
                  className="px-3 py-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors"
                  title={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                >
                  {darkMode ? <Sun size={20} /> : <Moon size={20} />}
                </button>

                {/* Cloud Status Indicator */}
                {isCloudConnected && (
                  <div className="flex items-center gap-2">
                    <div className="px-4 py-2 rounded-lg flex items-center gap-2 font-semibold text-white/80">
                      <Cloud size={20} />
                      <span>Cloud Connected</span>
                    </div>
                    <button
                      onClick={handleSyncToCloud}
                      disabled={syncing}
                      className="px-3 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-100 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                      title="Sync local games to cloud"
                    >
                      {syncing ? 'Syncing...' : 'Sync All'}
                    </button>
                  </div>
                )}

                {/* Auth Button */}
                {user ? (
                  <div className="relative profile-dropdown-container">
                    <button
                      onClick={() => setShowProfileDropdown(!showProfileDropdown)}
                      className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg flex items-center gap-2 font-semibold transition-colors"
                    >
                      <User size={20} />
                      {profile?.player_name || user.email}
                    </button>
                    {showProfileDropdown && (
                      <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg py-2 z-10">
                        <button
                          onClick={() => {
                            setShowProfileModal(true);
                            setShowProfileDropdown(false);
                          }}
                          className="w-full px-4 py-2 text-left text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                        >
                          <Settings size={16} />
                          Link Profile
                        </button>
                        <button
                          onClick={() => {
                            handleLogout();
                            setShowProfileDropdown(false);
                          }}
                          className="w-full px-4 py-2 text-left text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                        >
                          <LogOut size={16} />
                          Logout
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <button
                    onClick={() => setShowAuthModal(true)}
                    className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg flex items-center gap-2 font-semibold transition-colors"
                  >
                    <Lock size={20} />
                    Login
                  </button>
                )}
              </div>
            </div>
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

            {/* Auth Modal */}
            {showAuthModal && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-lg max-w-md w-full p-6">
                  <h2 className="text-2xl font-bold mb-4">{authMode === 'login' ? 'Login' : 'Sign Up'}</h2>
                  <form onSubmit={handleAuth} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">Email</label>
                      <input
                        type="email"
                        name="email"
                        required
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Password</label>
                      <input
                        type="password"
                        name="password"
                        required
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="submit"
                        disabled={authLoading}
                        className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                      >
                        {authLoading ? 'Processing...' : (authMode === 'login' ? 'Login' : 'Sign Up')}
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowAuthModal(false)}
                        className="px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                  <button
                    onClick={() => setAuthMode(authMode === 'login' ? 'signup' : 'login')}
                    className="mt-4 text-sm text-blue-600 hover:underline"
                  >
                    {authMode === 'login' ? "Don't have an account? Sign up" : 'Already have an account? Login'}
                  </button>
                </div>
              </div>
            )}



            {/* Profile Linking Modal */}
            {showProfileModal && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-lg max-w-md w-full p-6">
                  <h2 className="text-2xl font-bold mb-4">Link Your Profile</h2>
                  <p className="text-sm text-gray-600 mb-4">
                    {user ?
                      'Select your player name to link your account and see personalized stats.'
                      : 'Enter your player name for a personalized experience (no cloud sync).'}
                  </p>
                  <form onSubmit={handleLinkProfile} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">Player Name</label>
                      {user && getAllPlayerNames().length > 0 ? (
                        <select
                          name="playerName"
                          required
                          className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="">Select your player name...</option>
                          {getAllPlayerNames().map(name => (
                            <option key={name} value={name}>{name}</option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type="text"
                          name="playerName"
                          required
                          placeholder="Enter your player name (e.g., Chintan Shah)"
                          className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                        />
                      )}
                      <p className="text-xs text-gray-500 mt-1">
                        {getAllPlayerNames().length > 0
                          ? `${getAllPlayerNames().length} player names found from uploaded games`
                          : 'No games uploaded yet. Enter your name manually.'}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="submit"
                        className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                      >
                        Link Profile
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowProfileModal(false)}
                        className="px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300"
                      >
                        Skip for Now
                      </button>
                    </div>
                  </form>
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
                <button
                  onClick={handleShareReport}
                  disabled={games.length === 0}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2"
                  title="Download report as image"
                >
                  <Download size={18} />
                  Share Report
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
                <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border-2 border-green-200 dark:border-green-800">
                  <p className="text-lg font-bold text-green-800 dark:text-green-300">✓ {games.length} Games Loaded</p>
                </div>

                <div ref={reportRef} className="space-y-8 bg-white dark:bg-gray-900 p-4 rounded-xl">
                  {/* Player Statistics Dashboard */}
                  {(() => {
                    if (games.length === 0) return null;

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
                              totalNet: 0,
                              gamesPlayed: 0,
                              wins: 0,
                              bestGame: -Infinity,
                              worstGame: Infinity,
                              gameHistory: []
                            };
                          }
                          playerStats[key].totalNet += player.net || 0;
                          playerStats[key].gamesPlayed += 1;
                          if (player.net > playerStats[key].bestGame) {
                            playerStats[key].bestGame = player.net;
                          }
                          if (player.net < playerStats[key].worstGame) {
                            playerStats[key].worstGame = player.net;
                          }
                          if (game.winner && game.winner.toLowerCase().trim() === key) {
                            playerStats[key].wins += 1;
                          }
                          playerStats[key].gameHistory.push(player.net);
                        });
                      }
                    });

                    const playersArray = Object.values(playerStats);
                    if (playersArray.length === 0) return null;

                    return (
                      <div className="mb-8">
                        <h2 className="text-2xl font-bold mb-6 dark:text-white">👥 Player Statistics</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {playersArray.map((player, idx) => {
                            const winRate = ((player.wins / player.gamesPlayed) * 100).toFixed(1);
                            const avgProfit = (player.totalNet / player.gamesPlayed).toFixed(0);
                            const isPositive = player.totalNet >= 0;

                            // Calculate running balance
                            let runningBalance = 0;
                            const balanceProgression = player.gameHistory.map(net => {
                              runningBalance += net;
                              return runningBalance;
                            });
                            const finalBalance = runningBalance;

                            return (
                              <div
                                key={idx}
                                className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4 border-l-4 hover:shadow-xl transition-shadow"
                                style={{ borderLeftColor: isPositive ? '#10b981' : '#ef4444' }}
                              >
                                <div className="flex items-center gap-3 mb-3">
                                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white font-bold text-lg">
                                    {player.fullName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                                  </div>
                                  <div className="flex-1">
                                    <h3 className="font-bold text-lg dark:text-white">{player.fullName}</h3>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">{player.name}</p>
                                  </div>
                                </div>

                                <div className="space-y-2">
                                  {/* Bankroll Balance */}
                                  <div className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-lg p-3 border border-purple-200 dark:border-purple-800">
                                    <div className="text-xs text-purple-600 dark:text-purple-400 font-semibold mb-1">💰 Bankroll Balance</div>
                                    <div className={`text-2xl font-bold ${finalBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                      {finalBalance >= 0 ? '+' : ''}₹{finalBalance}
                                    </div>
                                    <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                                      Cumulative across {player.gamesPlayed} sessions
                                    </div>
                                  </div>

                                  <div className="flex justify-between items-center">
                                    <span className="text-sm text-gray-600 dark:text-gray-400">Total Profit:</span>
                                    <span className={`font-bold text-lg ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                                      {isPositive ? '+' : ''}₹{player.totalNet}
                                    </span>
                                  </div>

                                  <div className="grid grid-cols-2 gap-2">
                                    <div className="bg-blue-50 dark:bg-blue-900/20 rounded p-2">
                                      <div className="text-xs text-gray-600 dark:text-gray-400">Games</div>
                                      <div className="font-bold text-blue-600 dark:text-blue-400">{player.gamesPlayed}</div>
                                    </div>
                                    <div className="bg-purple-50 dark:bg-purple-900/20 rounded p-2">
                                      <div className="text-xs text-gray-600 dark:text-gray-400">Win Rate</div>
                                      <div className="font-bold text-purple-600 dark:text-purple-400">{winRate}%</div>
                                    </div>
                                  </div>

                                  <div className="bg-gray-50 dark:bg-gray-700 rounded p-2">
                                    <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">Avg Profit/Game</div>
                                    <div className={`font-bold ${parseFloat(avgProfit) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                      {parseFloat(avgProfit) >= 0 ? '+' : ''}₹{avgProfit}
                                    </div>
                                  </div>

                                  <div className="grid grid-cols-2 gap-2 pt-2 border-t dark:border-gray-700">
                                    <div>
                                      <div className="text-xs text-gray-600 dark:text-gray-400">Best</div>
                                      <div className="font-semibold text-green-600">+₹{player.bestGame}</div>
                                    </div>
                                    <div>
                                      <div className="text-xs text-gray-600 dark:text-gray-400">Worst</div>
                                      <div className="font-semibold text-red-600">₹{player.worstGame}</div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}

                  <div className="mb-8 bg-blue-50 dark:bg-blue-900/10 p-6 rounded-lg border-2 border-blue-200 dark:border-blue-800">
                    <h2 className="text-2xl font-bold mb-4 dark:text-white">📊 Consolidated Player Statistics</h2>

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

                      // Calculate rounded values with adjustment
                      players.forEach(p => {
                        p.actualValue = p.totalNet / 100;
                        p.roundedValue = Math.round(p.actualValue);
                        p.roundingDiff = p.actualValue - p.roundedValue;
                      });

                      // Calculate total rounding difference and adjust
                      const totalRoundingDiff = players.reduce((sum, p) => sum + p.roundingDiff, 0);
                      if (Math.abs(totalRoundingDiff) > 0.01 && players.length > 0) {
                        const largestPlayer = players.reduce((max, p) =>
                          Math.abs(p.totalNet) > Math.abs(max.totalNet) ? p : max
                        );
                        largestPlayer.roundedValue += Math.round(totalRoundingDiff);
                      }

                      // Calculate totals using rounded values
                      const totalReceivable = players
                        .filter(p => p.roundedValue > 0)
                        .reduce((sum, p) => sum + p.roundedValue, 0);
                      const totalPayable = players
                        .filter(p => p.roundedValue < 0)
                        .reduce((sum, p) => sum + Math.abs(p.roundedValue), 0);
                      const balance = totalReceivable - totalPayable;

                      return (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                          {/* Total Receivable */}
                          <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-lg p-6 text-white shadow-lg">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-green-100 text-sm font-medium mb-1">Total Receivable</p>
                                <p className="text-3xl font-bold">₹{totalReceivable}</p>
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
                                <p className="text-3xl font-bold">₹{totalPayable}</p>
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
                                  {Math.abs(balance) < 1 ? '✓ Balanced' : `₹${Math.abs(balance)}`}
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

                    {/* Weekly Activity Chart */}
                    {(() => {
                      if (games.length === 0) return null;

                      // Helper to get Monday of the week for a date
                      const getMonday = (d) => {
                        const date = new Date(d);
                        const day = date.getDay();
                        const diff = date.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
                        const monday = new Date(date.setDate(diff));
                        monday.setHours(0, 0, 0, 0);
                        return monday;
                      };

                      // Group games by week
                      const gamesByWeek = {};
                      games.forEach(game => {
                        if (!game.date) return;
                        const monday = getMonday(game.date).toISOString().split('T')[0];
                        if (!gamesByWeek[monday]) {
                          gamesByWeek[monday] = [];
                        }
                        gamesByWeek[monday].push(game);
                      });

                      // Get latest week or current week
                      const weeks = Object.keys(gamesByWeek).sort().reverse();
                      const currentWeekStart = weeks[0];
                      const currentWeekGames = gamesByWeek[currentWeekStart] || [];

                      // Initialize daily counts and games (Mon-Sun)
                      const dailyCounts = [0, 0, 0, 0, 0, 0, 0];
                      const dailyGames = [[], [], [], [], [], [], []];
                      const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

                      currentWeekGames.forEach(game => {
                        const date = new Date(game.date);
                        // getDay(): 0=Sun, 1=Mon... 6=Sat
                        // Map to 0=Mon... 6=Sun
                        let dayIndex = date.getDay() - 1;
                        if (dayIndex === -1) dayIndex = 6; // Sunday
                        dailyCounts[dayIndex]++;
                        dailyGames[dayIndex].push(game);
                      });

                      const maxGames = Math.max(...dailyCounts, 1); // Avoid division by zero

                      return (
                        <div className="mb-8 bg-white p-6 rounded-lg shadow border border-gray-100">
                          <div className="flex items-center justify-between mb-6">
                            <div>
                              <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                                <TrendingUp size={20} className="text-blue-600" />
                                Weekly Activity
                              </h2>
                              <p className="text-sm text-gray-500 mt-1">
                                Week of {new Date(currentWeekStart).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} - {new Date(new Date(currentWeekStart).getTime() + 6 * 24 * 60 * 60 * 1000).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                              </p>
                            </div>
                            <div className="bg-blue-50 px-3 py-1 rounded-full text-blue-700 text-sm font-semibold">
                              {currentWeekGames.length} Games Played
                            </div>
                          </div>

                          <div className="grid grid-cols-7 gap-2 h-32 items-end">
                            {dailyCounts.map((count, i) => (
                              <div key={i} className="flex flex-col items-center gap-2 h-full justify-end group">
                                <div className="relative w-full flex justify-center items-end h-full">
                                  <div
                                    className={`w-full max-w-[30px] rounded-t-lg transition-all duration-500 flex items-end justify-center pb-1 ${count > 0 ? 'bg-blue-500 hover:bg-blue-600' : 'bg-gray-100'
                                      }`}
                                    style={{ height: `${(count / maxGames) * 100}%`, minHeight: count > 0 ? '20px' : '4px' }}
                                  >
                                    {count > 0 && (
                                      <span className="text-xs font-bold text-white mb-1">{count}</span>
                                    )}
                                  </div>
                                </div>
                                <div className="text-xs font-medium text-gray-500">{days[i]}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })()}

                    <div className="overflow-x-auto">
                      <table className="w-full text-sm bg-white dark:bg-gray-800 rounded shadow">
                        <thead>
                          <tr className="bg-blue-600 dark:bg-blue-700 text-white">
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

                            // Calculate rounded actual values with adjustment
                            const players = Object.values(playerStats).sort((a, b) => b.totalNet - a.totalNet);

                            // Calculate actual values and rounding differences
                            players.forEach(p => {
                              p.actualValue = p.totalNet / 100; // Convert to rupees
                              p.roundedValue = Math.round(p.actualValue); // Round to nearest rupee
                              p.roundingDiff = p.actualValue - p.roundedValue; // Difference
                            });

                            // Calculate total rounding difference
                            const totalRoundingDiff = players.reduce((sum, p) => sum + p.roundingDiff, 0);

                            // Adjust the player with largest absolute value to absorb the rounding difference
                            if (Math.abs(totalRoundingDiff) > 0.01 && players.length > 0) {
                              // Find player with largest absolute net value
                              const largestPlayer = players.reduce((max, p) =>
                                Math.abs(p.totalNet) > Math.abs(max.totalNet) ? p : max
                              );
                              largestPlayer.roundedValue += Math.round(totalRoundingDiff);
                            }

                            return players.map((p, i) => {
                              const winRate = p.games > 0 ? ((p.wins / p.games) * 100).toFixed(1) : '0.0';

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
                                  <td className="p-3 text-right">
                                    <div className={`font-semibold ${p.roundedValue > 0 ? 'text-green-600' :
                                      p.roundedValue < 0 ? 'text-red-600' :
                                        'text-gray-600'
                                      }`}>
                                      {p.roundedValue > 0 ? '+' : ''}₹{p.roundedValue}
                                    </div>
                                    {Math.abs(p.roundingDiff) > 0.01 && (
                                      <div className="text-xs text-gray-500">
                                        (was ₹{p.actualValue.toFixed(2)})
                                      </div>
                                    )}
                                  </td>
                                </tr>
                              );
                            });
                          })()}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                <div className="mb-8 bg-orange-50 dark:bg-orange-900/20 p-6 rounded-lg border-2 border-orange-200 dark:border-orange-700">
                  <h2 className="text-2xl font-bold mb-4 dark:text-white">💰 Settlements</h2>
                  {(() => {
                    const settlements = calculateSettlements();
                    if (settlements.length === 0) {
                      return <p className="text-center text-gray-600">All even!</p>;
                    }
                    return settlements.map((s, i) => {
                      const settlementKey = `${s.from}-${s.to}`;
                      const currentStatus = settlements[settlementKey]?.status || 'pending';
                      const isDebtor = profile?.player_name === s.from;
                      const isCreditor = profile?.player_name === s.to;

                      const getStatusColor = (status) => {
                        switch (status) {
                          case 'paid': return 'bg-green-100 text-green-800 border-green-200';
                          case 'payment_sent': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
                          case 'adjusted': return 'bg-blue-100 text-blue-800 border-blue-200';
                          case 'adjusted_offline': return 'bg-purple-100 text-purple-800 border-purple-200';
                          default: return 'bg-gray-100 text-gray-800 border-gray-200';
                        }
                      };

                      const formatStatus = (status) => {
                        if (status === 'payment_sent') return 'Payment Sent';
                        if (status === 'adjusted_offline') return 'Adj. (Offline)';
                        return status.charAt(0).toUpperCase() + status.slice(1);
                      };

                      return (
                        <div key={i} className="bg-white dark:bg-gray-800 p-4 rounded shadow-lg border dark:border-gray-700 mb-2 flex flex-col sm:flex-row justify-between items-center gap-4">
                          <div className="flex items-center gap-4 flex-1">
                            <span className="font-bold text-red-600 dark:text-red-400">{s.from}</span>
                            <ArrowRight className="text-gray-400 dark:text-gray-500" size={20} />
                            <span className="font-bold text-green-600 dark:text-green-400">{s.to}</span>
                            <div className="ml-4">
                              <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">₹{s.amount}</div>
                              <div className="text-xs text-gray-500 dark:text-gray-400">Actual: ₹{s.actualAmount.toFixed(2)}</div>
                            </div>
                          </div>

                          <div className="flex items-center gap-3 flex-wrap justify-end">

                            {/* Role-based Actions */}
                            {isDebtor && currentStatus === 'pending' && (
                              <button
                                onClick={() => handleSettlementAction(s.from, s.to, s.amount, 'payment_sent')}
                                className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors shadow-sm"
                              >
                                Mark Paid
                              </button>
                            )}

                            {isCreditor && currentStatus === 'payment_sent' && (
                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleSettlementAction(s.from, s.to, s.amount, 'paid')}
                                  className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700 transition-colors shadow-sm"
                                >
                                  Confirm
                                </button>
                                <button
                                  onClick={() => handleSettlementAction(s.from, s.to, s.amount, 'pending')}
                                  className="px-3 py-1 bg-red-500 text-white text-sm rounded hover:bg-red-600 transition-colors shadow-sm"
                                >
                                  Reject
                                </button>
                              </div>
                            )}

                            {/* Status Dropdown (Manual Override) */}
                            <select
                              value={currentStatus}
                              onChange={(e) => handleSettlementAction(s.from, s.to, s.amount, e.target.value)}
                              className={`px-3 py-1 rounded border text-sm font-medium focus:outline-none focus:ring-2 focus:ring-offset-1 cursor-pointer ${getStatusColor(currentStatus)}`}
                              disabled={!isCloudConnected}
                              title="Change status manually"
                            >
                              <option value="pending">Pending</option>
                              <option value="payment_sent">Payment Sent</option>
                              <option value="paid">Paid</option>
                              <option value="adjusted">Adjusted</option>
                              <option value="adjusted_offline">Adj. (Offline)</option>
                            </select>
                          </div>
                        </div>
                      );
                    });
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
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm dark:bg-gray-800">
                          <thead>
                            <tr className="border-b dark:border-gray-700">
                              <th className="p-2 text-left">Player</th>
                              <th className="p-2 text-right">Buy-In</th>
                              <th className="p-2 text-right">Buy-Out</th>
                              <th className="p-2 text-right">Net</th>
                            </tr>
                          </thead>
                          <tbody>
                            {game.players && game.players.map((p, i) => (
                              <tr key={i} className="border-b dark:border-gray-700">
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
