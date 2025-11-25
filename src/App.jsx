import React, { useState, useEffect } from 'react';
import { Download, Trash2, AlertCircle, CheckCircle, TrendingUp, TrendingDown, Upload, ArrowRight } from 'lucide-react';
import storage from './storage';

export default function PokerNowReporter() {
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [isInitialized, setIsInitialized] = useState(false);

  const playerAliases = {
    'cs': 'Chintan Shah',
    'sas': 'Simal Shah',
    'mani27': 'Manigandan Manjunathan',
    'gp': 'Gaurav Jain',
    'pratik': 'Pratik Jain',
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
    loadGames();
  }, []);

  const loadGames = async () => {
    try {
      const result = await storage.get('pokernow-games');
      if (result && result.value) {
        setGames(JSON.parse(result.value));
      }
      setIsInitialized(true);
    } catch (error) {
      setGames([]);
      setIsInitialized(true);
    }
  };

  const saveGames = async (newGames) => {
    try {
      await storage.set('pokernow-games', JSON.stringify(newGames));
      setGames(newGames);
    } catch (error) {
      showMessage('error', 'Failed to save games to storage');
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
      const player = row.player_nickname;
      const playerKey = player.toLowerCase().trim();
      const buyIn = parseFloat(row.buy_in) || 0;
      const buyOut = parseFloat(row.buy_out) || 0;
      const net = parseFloat(row.net) || 0;
      const sessionStart = row.session_start_at;

      if (sessionStart && !gameDate) {
        gameDate = new Date(sessionStart).toISOString().split('T')[0];
      }

      if (!playerStats[playerKey]) {
        playerStats[playerKey] = { 
          name: player,
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
    const totalPot = totalBuyIn;

    return {
      gameDate,
      players,
      winner: winner.name,
      winnerProfit: winner.net,
      totalPot,
      playerCount: players.length
    };
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (!file.name.endsWith('.csv')) {
      showMessage('error', 'Please upload a CSV file');
      return;
    }

    setLoading(true);
    try {
      const text = await file.text();
      const csvData = parseCSV(text);
      const analysis = analyzeGameData(csvData);
      const gameId = file.name.replace('.csv', '').replace('ledger_', '');

      const gameData = {
        gameId,
        url: 'Uploaded file: ' + file.name,
        date: analysis.gameDate,
        players: analysis.players,
        playerCount: analysis.playerCount,
        winner: analysis.winner,
        winnerProfit: analysis.winnerProfit,
        totalPot: analysis.totalPot,
        addedAt: new Date().toISOString(),
        rawData: csvData
      };

      const newGames = [...games, gameData];
      await saveGames(newGames);
      
      showMessage('success', `Game added! ${analysis.playerCount} players, Winner: ${analysis.winner}`);
      event.target.value = '';
    } catch (error) {
      showMessage('error', `Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const deleteGame = async (index) => {
    const newGames = games.filter((_, i) => i !== index);
    await saveGames(newGames);
    showMessage('success', 'Game deleted');
  };

  const clearAllGames = async () => {
    if (window.confirm('Are you sure you want to delete all games? This cannot be undone.')) {
      try {
        await storage.set('pokernow-games', JSON.stringify([]));
        setGames([]);
        showMessage('success', 'All games cleared successfully!');
      } catch (error) {
        showMessage('error', 'Failed to clear games: ' + error.message);
      }
    }
  };

  const calculateSettlements = () => {
    const playerConsolidated = {};
    
    games.forEach(game => {
      if (game.players && Array.isArray(game.players)) {
        game.players.forEach(player => {
          const playerKey = player.name.toLowerCase().trim();
          
          if (!playerConsolidated[playerKey]) {
            playerConsolidated[playerKey] = {
              name: player.name,
              fullName: getPlayerFullName(player.name),
              totalNet: 0
            };
          }
          
          playerConsolidated[playerKey].totalNet += player.net || 0;
        });
      }
    });

    const players = Object.values(playerConsolidated);
    const creditors = players.filter(p => p.totalNet > 0).sort((a, b) => b.totalNet - a.totalNet);
    const debtors = players.filter(p => p.totalNet < 0).sort((a, b) => a.totalNet - b.totalNet);
    
    const settlements = [];
    let creditorIdx = 0;
    let debtorIdx = 0;
    
    while (creditorIdx < creditors.length && debtorIdx < debtors.length) {
      const creditor = creditors[creditorIdx];
      const debtor = debtors[debtorIdx];
      const amountToSettle = Math.min(creditor.totalNet, Math.abs(debtor.totalNet));
      
      settlements.push({
        from: debtor.fullName,
        to: creditor.fullName,
        amount: amountToSettle,
        actualValue: (amountToSettle / 100).toFixed(2)
      });
      
      creditor.totalNet -= amountToSettle;
      debtor.totalNet += amountToSettle;
      
      if (creditor.totalNet === 0) creditorIdx++;
      if (debtor.totalNet === 0) debtorIdx++;
    }
    
    return settlements;
  };

  const exportToCSV = () => {
    if (games.length === 0) {
      showMessage('error', 'No games to export');
      return;
    }

    try {
      const playerConsolidated = {};
      
      games.forEach(game => {
        if (game.players && Array.isArray(game.players)) {
          game.players.forEach(player => {
            const playerKey = player.name.toLowerCase().trim();
            
            if (!playerConsolidated[playerKey]) {
              playerConsolidated[playerKey] = {
                name: player.name,
                totalBuyIn: 0,
                totalBuyOut: 0,
                totalNet: 0,
                gamesPlayed: 0,
                wins: 0
              };
            }
            
            playerConsolidated[playerKey].totalBuyIn += player.buyIn || 0;
            playerConsolidated[playerKey].totalBuyOut += player.buyOut || 0;
            playerConsolidated[playerKey].totalNet += player.net || 0;
            playerConsolidated[playerKey].gamesPlayed += 1;
            
            if (game.winner.toLowerCase().trim() === playerKey) {
              playerConsolidated[playerKey].wins += 1;
            }
          });
        }
      });

      const consolidatedPlayers = Object.values(playerConsolidated)
        .sort((a, b) => b.totalNet - a.totalNet);

      const rows = [];
      rows.push(['PokerNow Games Report']);
      rows.push(['Generated on', new Date().toLocaleString()]);
      rows.push(['Total Games', games.length]);
      rows.push([]);
      
      rows.push(['CONSOLIDATED PLAYER STATISTICS']);
      rows.push(['Player', 'Games Played', 'Wins', 'Total Buy-In', 'Total Buy-Out', 'Total Net P/L', 'Win Rate %', 'Actual Value']);
      
      consolidatedPlayers.forEach(player => {
        const winRate = player.gamesPlayed > 0 ? ((player.wins / player.gamesPlayed) * 100).toFixed(1) : '0.0';
        const actualValue = (player.totalNet / 100).toFixed(2);
        
        rows.push([
          player.name,
          player.gamesPlayed,
          player.wins,
          player.totalBuyIn,
          player.totalBuyOut,
          player.totalNet,
          winRate,
          actualValue
        ]);
      });

      rows.push([]);
      
      const playerConsolidatedBalance = {};
      games.forEach(game => {
        if (game.players && Array.isArray(game.players)) {
          game.players.forEach(player => {
            const playerKey = player.name.toLowerCase().trim();
            if (!playerConsolidatedBalance[playerKey]) {
              playerConsolidatedBalance[playerKey] = {
                name: player.name,
                totalNet: 0
              };
            }
            playerConsolidatedBalance[playerKey].totalNet += player.net || 0;
          });
        }
      });

      const playersBalance = Object.values(playerConsolidatedBalance);
      const totalPositive = playersBalance.filter(p => p.totalNet > 0).reduce((sum, p) => sum + p.totalNet, 0);
      const totalNegative = playersBalance.filter(p => p.totalNet < 0).reduce((sum, p) => sum + Math.abs(p.totalNet), 0);
      const difference = Math.abs(totalPositive - totalNegative);

      rows.push(['BALANCE SUMMARY']);
      rows.push(['Category', 'Actual Value']);
      rows.push(['Total Receivable (Money to be received)', (totalPositive / 100).toFixed(2)]);
      rows.push(['Total Payable (Money to be paid)', (totalNegative / 100).toFixed(2)]);
      rows.push(['Difference (should be 0 if balanced)', (difference / 100).toFixed(2)]);
      rows.push([]);
      
      const settlements = calculateSettlements();
      rows.push(['SETTLEMENT - WHO PAYS WHOM']);
      rows.push(['From (Debtor)', 'To (Creditor)', 'Actual Value']);
      
      if (settlements.length === 0) {
        rows.push(['No settlements needed - all players are even']);
      } else {
        settlements.forEach(settlement => {
          rows.push([settlement.from, settlement.to, settlement.actualValue]);
        });
      }
      
      rows.push([]);
      rows.push(['Game Summary']);
      rows.push(['Game ID', 'Date', 'Players', 'Winner', 'Winner Profit', 'Total Pot']);
      
      games.forEach(game => {
        rows.push([
          game.gameId || '',
          game.date || '',
          game.playerCount || 0,
          game.winner || '',
          game.winnerProfit || 0,
          game.totalPot || 0
        ]);
      });

      rows.push([]);
      rows.push(['Detailed Player Performance by Game']);
      rows.push([]);

      games.forEach((game, idx) => {
        rows.push([`Game ${idx + 1} - ${game.date} (${game.gameId})`]);
        rows.push(['Player', 'Buy-In', 'Buy-Out', 'Net Profit/Loss']);
        if (game.players && Array.isArray(game.players)) {
          game.players.forEach(player => {
            rows.push([
              player.name || '', 
              player.buyIn || 0, 
              player.buyOut || 0, 
              player.net || 0
            ]);
          });
        }
        rows.push([]);
      });

      const csvContent = '\uFEFF' + rows.map(row => 
        row.map(cell => {
          const cellStr = String(cell);
          if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
            return '"' + cellStr.replace(/"/g, '""') + '"';
          }
          return cellStr;
        }).join(',')
      ).join('\r\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `pokernow_report_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      showMessage('success', 'Report exported successfully! Open with Excel.');
    } catch (error) {
      showMessage('error', 'Export failed: ' + error.message);
    }
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
            {message.text && (
              <div className={`mb-4 p-4 rounded-lg flex items-center gap-2 ${
                message.type === 'success' ? 'bg-green-100 text-green-800' : 
                message.type === 'info' ? 'bg-blue-100 text-blue-800' :
                'bg-red-100 text-red-800'
              }`}>
                {message.type === 'success' ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
                {message.text}
              </div>
            )}

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Upload CSV Ledger File
              </label>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-green-500 transition-colors bg-gradient-to-br from-green-50 to-blue-50">
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="file-upload"
                  disabled={loading}
                />
                <label 
                  htmlFor="file-upload" 
                  className="cursor-pointer flex flex-col items-center gap-3"
                >
                  <Upload size={48} className="text-green-600" />
                  <div>
                    <span className="text-lg font-semibold text-gray-700 block">
                      Click to upload CSV ledger file
                    </span>
                    <span className="text-sm text-gray-500 mt-1 block">
                      Download the ledger CSV from your PokerNow game page
                    </span>
                  </div>
                  {loading && (
                    <div className="mt-2">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto"></div>
                      <p className="text-sm text-gray-600 mt-2">Processing...</p>
                    </div>
                  )}
                </label>
              </div>
            </div>

            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-800">
                Games Tracked: {games.length}
              </h2>
              <div className="flex gap-2">
                <button
                  onClick={exportToCSV}
                  disabled={games.length === 0}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
                >
                  <Download size={18} />
                  Export Report
                </button>
                <button
                  onClick={clearAllGames}
                  disabled={games.length === 0}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
                >
                  <Trash2 size={18} />
                  Clear All
                </button>
              </div>
            </div>

            {games.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <p className="text-lg">No games added yet.</p>
                <p className="mt-2">Upload a CSV file to get started.</p>
              </div>
            ) : (
              <>
                <div className="mb-8 bg-gradient-to-r from-blue-50 to-purple-50 p-6 rounded-lg border-2 border-blue-200">
                  <h2 className="text-2xl font-bold text-gray-800 mb-4">📊 Consolidated Player Statistics</h2>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm bg-white rounded-lg shadow">
                      <thead>
                        <tr className="bg-gradient-to-r from-blue-600 to-purple-600 text-white">
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
                          const playerConsolidated = {};
                          
                          games.forEach(game => {
                            if (game.players && Array.isArray(game.players)) {
                              game.players.forEach(player => {
                                const playerKey = player.name.toLowerCase().trim();
                                
                                if (!playerConsolidated[playerKey]) {
                                  playerConsolidated[playerKey] = {
                                    name: player.name,
                                    totalBuyIn: 0,
                                    totalBuyOut: 0,
                                    totalNet: 0,
                                    gamesPlayed: 0,
                                    wins: 0
                                  };
                                }
                                
                                playerConsolidated[playerKey].totalBuyIn += player.buyIn || 0;
                                playerConsolidated[playerKey].totalBuyOut += player.buyOut || 0;
                                playerConsolidated[playerKey].totalNet += player.net || 0;
                                playerConsolidated[playerKey].gamesPlayed += 1;
                                
                                if (game.winner.toLowerCase().trim() === playerKey) {
                                  playerConsolidated[playerKey].wins += 1;
                                }
                              });
                            }
                          });

                          const consolidatedPlayers = Object.values(playerConsolidated)
                            .sort((a, b) => b.totalNet - a.totalNet);

                          return consolidatedPlayers.map((player, idx) => {
                            const winRate = player.gamesPlayed > 0 ? ((player.wins / player.gamesPlayed) * 100).toFixed(1) : '0.0';
                            const actualValue = (player.totalNet / 100).toFixed(2);
                            
                            return (
                              <tr key={idx} className="border-b hover:bg-blue-50 transition-colors">
                                <td className="p-3">
                                  <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full font-bold ${
                                    idx === 0 ? 'bg-yellow-400 text-yellow-900' :
                                    idx === 1 ? 'bg-gray-300 text-gray-700' :
                                    idx === 2 ? 'bg-orange-400 text-orange-900' :
                                    'bg-gray-100 text-gray-600'
                                  }`}>
                                    {idx + 1}
                                  </span>
                                </td>
                                <td className="p-3 font-bold text-gray-800">{player.name}</td>
                                <td className="p-3 text-center text-gray-700">{player.gamesPlayed}</td>
                                <td className="p-3 text-center">
                                  <span className="px-2 py-1 bg-green-100 text-green-800 rounded font-semibold">
                                    {player.wins}
                                  </span>
                                </td>
                                <td className="p-3 text-right text-gray-700">₹{player.totalBuyIn.toLocaleString()}</td>
                                <td className="p-3 text-right text-gray-700">₹{player.totalBuyOut.toLocaleString()}</td>
                                <td className={`p-3 text-right font-bold text-lg ${
                                  player.totalNet > 0 ? 'text-green-600' : 
                                  player.totalNet < 0 ? 'text-red-600' : 'text-gray-600'
                                }`}>
                                  {player.totalNet > 0 ? '+' : ''}₹{player.totalNet.toLocaleString()}
                                </td>
                                <td className="p-3 text-center">
                                  <span className={`px-2 py-1 rounded font-semibold ${
                                    parseFloat(winRate) >= 50 ? 'bg-green-100 text-green-800' :
                                    parseFloat(winRate) >= 25 ? 'bg-yellow-100 text-yellow-800' :
                                    'bg-red-100 text-red-800'
                                  }`}>
                                    {winRate}%
                                  </span>
                                </td>
                                <td className={`p-3 text-right font-semibold ${
                                  parseFloat(actualValue) > 0 ? 'text-green-600' : 
                                  parseFloat(actualValue) < 0 ? 'text-red-600' : 'text-gray-600'
                                }`}>
                                  {parseFloat(actualValue) > 0 ? '+' : ''}₹{parseFloat(actualValue).toLocaleString()}
                                </td>
                              </tr>
                            );
                          });
                        })()}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="mb-8 grid md:grid-cols-3 gap-4">
                  {(() => {
                    const playerConsolidated = {};
                    
                    games.forEach(game => {
                      if (game.players && Array.isArray(game.players)) {
                        game.players.forEach(player => {
                          const playerKey = player.name.toLowerCase().trim();
                          
                          if (!playerConsolidated[playerKey]) {
                            playerConsolidated[playerKey] = {
                              name: player.name,
                              totalNet: 0
                            };
                          }
                          
                          playerConsolidated[playerKey].totalNet += player.net || 0;
                        });
                      }
                    });

                    const players = Object.values(playerConsolidated);
                    const totalPositive = players.filter(p => p.totalNet > 0).reduce((sum, p) => sum + p.totalNet, 0);
                    const totalNegative = players.filter(p => p.totalNet < 0).reduce((sum, p) => sum + Math.abs(p.totalNet), 0);
                    const difference = Math.abs(totalPositive - totalNegative);
                    const isBalanced = difference < 1;

                    return (
                      <>
                        <div className="bg-gradient-to-br from-green-500 to-green-600 p-6 rounded-lg shadow-lg text-white">
                          <div className="flex items-center justify-between mb-2">
                            <h3 className="text-lg font-semibold opacity-90">Total Receivable</h3>
                            <TrendingUp size={24} />
                          </div>
                          <p className="text-3xl font-bold">₹{(totalPositive / 100).toFixed(2)}</p>
                          <p className="text-xs opacity-75 mt-2">Money to be received</p>
                        </div>

                        <div className="bg-gradient-to-br from-red-500 to-red-600 p-6 rounded-lg shadow-lg text-white">
                          <div className="flex items-center justify-between mb-2">
                            <h3 className="text-lg font-semibold opacity-90">Total Payable</h3>
                            <TrendingDown size={24} />
                          </div>
                          <p className="text-3xl font-bold">₹{(totalNegative / 100).toFixed(2)}</p>
                          <p className="text-xs opacity-75 mt-2">Money to be paid</p>
                        </div>

                        <div className={`bg-gradient-to-br ${isBalanced ? 'from-blue-500 to-blue-600' : 'from-orange-500 to-orange-600'} p-6 rounded-lg shadow-lg text-white`}>
                          <div className="flex items-center justify-between mb-2">
                            <h3 className="text-lg font-semibold opacity-90">Balance Check</h3>
                            {isBalanced ? <CheckCircle size={24} /> : <AlertCircle size={24} />}
                          </div>
                          <p className="text-3xl font-bold">
                            {isBalanced ? '✓ Balanced' : '⚠ Unbalanced'}
                          </p>
                          <p className="text-sm opacity-90 mt-1">
                            Difference: ₹{(difference / 100).toFixed(2)}
                          </p>
                          <p className="text-xs opacity-75 mt-2">
                            {isBalanced ? 'All accounts match' : 'Check for errors'}
                          </p>
                        </div>
                      </>
                    );
                  })()}
                </div>

                <div className="mb-8 bg-gradient-to-r from-orange-50 to-red-50 p-6 rounded-lg border-2 border-orange-200">
                  <h2 className="text-2xl font-bold text-gray-800 mb-4">💰 Settlement - Who Pays Whom</h2>
                  {(() => {
                    const settlements = calculateSettlements();
                    
                    if (settlements.length === 0) {
                      return (
                        <div className="text-center py-8 text-gray-600">
                          <p className="text-lg font-semibold">✅ All players are even - No settlements needed!</p>
                        </div>
                      );
                    }
                    
                    return (
                      <div className="space-y-3">
                        {settlements.map((settlement, idx) => (
                          <div key={idx} className="bg-white p-4 rounded-lg shadow flex items-center justify-between hover:shadow-lg transition-shadow">
                            <div className="flex items-center gap-4 flex-1">
                              <div className="text-right">
                                <p className="text-sm text-gray-600">From</p>
                                <p className="text-lg font-bold text-red-600">{settlement.from}</p>
                              </div>
                              <ArrowRight className="text-gray-400" size={32} />
                              <div className="text-left">
                                <p className="text-sm text-gray-600">To</p>
                                <p className="text-lg font-bold text-green-600">{settlement.to}</p>
                              </div>
                            </div>
                            <div className="text-right ml-6">
                              <p className="text-sm text-gray-600">Amount</p>
                              <p className="text-2xl font-bold text-orange-600">₹{settlement.actualValue}</p>
                            </div>
                          </div>
                        ))}
                        <div className="mt-4 p-4 bg-blue-100 rounded-lg">
                          <p className="text-sm text-blue-800">
                            💡 <strong>Total transactions needed:</strong> {settlements.length} (optimized for minimum transfers)
                          </p>
                        </div>
                      </div>
                    );
                  })()}
                </div>

                <h2 className="text-2xl font-bold text-gray-800 mb-4">🎮 Individual Games</h2>
                <div className="space-y-6">
                  {games.map((game, index) => (
                    <div key={index} className="border border-gray-200 rounded-lg p-6 hover:shadow-lg transition-shadow">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <h3 className="text-lg font-bold text-gray-800">
                            Game on {game.date}
                          </h3>
                          <p className="text-sm text-gray-600 font-mono">{game.gameId}</p>
                        </div>
                        <button
                          onClick={() => deleteGame(index)}
                          className="p-2 text-red-600 hover:bg-red-100 rounded transition-colors"
                          title="Delete game"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                        <div className="bg-blue-50 p-3 rounded">
                          <p className="text-xs text-gray-600 mb-1">Players</p>
                          <p className="text-xl font-bold text-blue-700">{game.playerCount}</p>
                        </div>
                        <div className="bg-green-50 p-3 rounded">
                          <p className="text-xs text-gray-600 mb-1">Winner</p>
                          <p className="text-lg font-bold text-green-700">{game.winner}</p>
                        </div>
                        <div className="bg-purple-50 p-3 rounded">
                          <p className="text-xs text-gray-600 mb-1">Winner Profit</p>
                          <p className="text-lg font-bold text-purple-700">₹{game.winnerProfit.toLocaleString()}</p>
                        </div>
                        <div className="bg-orange-50 p-3 rounded">
                          <p className="text-xs text-gray-600 mb-1">Total Pot</p>
                          <p className="text-lg font-bold text-orange-700">₹{game.totalPot.toLocaleString()}</p>
                        </div>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-gray-50 border-b">
                              <th className="p-2 text-left">Player</th>
                              <th className="p-2 text-right">Buy-In</th>
                              <th className="p-2 text-right">Buy-Out</th>
                              <th className="p-2 text-right">Net P/L</th>
                              <th className="p-2 text-center">Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {game.players.map((player, pIdx) => (
                              <tr key={pIdx} className="border-b hover:bg-gray-50">
                                <td className="p-2 font-medium">{player.name}</td>
                                <td className="p-2 text-right">₹{player.buyIn.toLocaleString()}</td>
                                <td className="p-2 text-right">₹{player.buyOut.toLocaleString()}</td>
                                <td className={`p-2 text-right font-bold ${
                                  player.net > 0 ? 'text-green-600' : player.net < 0 ? 'text-red-600' : 'text-gray-600'
                                }`}>
                                  {player.net > 0 ? '+' : ''}₹{player.net.toLocaleString()}
                                </td>
                                <td className="p-2 text-center">
                                  {player.net > 0 ? (
                                    <TrendingUp className="inline text-green-600" size={18} />
                                  ) : player.net < 0 ? (
                                    <TrendingDown className="inline text-red-600" size={18} />
                                  ) : (
                                    <span className="text-gray-400">—</span>
                                  )}
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