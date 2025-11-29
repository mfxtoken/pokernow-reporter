import React, { useRef, useState } from 'react';
import {
    Download,
    TrendingUp,
    TrendingDown,
    Trophy,
    Users,
    CheckCircle
} from 'lucide-react';
import html2canvas from 'html2canvas';
import PlayerDetailView from './PlayerDetailView';

const PlayerStatistics = ({ games, darkMode, getPlayerFullName }) => {
    const [selectedPlayer, setSelectedPlayer] = useState(null);
    const reportRef = useRef(null);

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
            alert('Failed to generate report image');
        }
    };

    if (games.length === 0) {
        return (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                <Users size={48} className="mx-auto mb-4 opacity-50" />
                <p>Upload some games to see player statistics</p>
            </div>
        );
    }

    if (selectedPlayer) {
        return (
            <PlayerDetailView
                player={selectedPlayer}
                games={games}
                darkMode={darkMode}
                onBack={() => setSelectedPlayer(null)}
            />
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-end">
                <button
                    onClick={handleShareReport}
                    className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center gap-2"
                    title="Download report as image"
                >
                    <Download size={18} />
                    Share Report
                </button>
            </div>

            <div ref={reportRef} className="mb-8 bg-blue-50 dark:bg-blue-900/10 p-6 rounded-lg border-2 border-blue-200 dark:border-blue-800">
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
                    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

                    currentWeekGames.forEach(game => {
                        const date = new Date(game.date);
                        // getDay(): 0=Sun, 1=Mon... 6=Sat
                        // Map to 0=Mon... 6=Sun
                        let dayIndex = date.getDay() - 1;
                        if (dayIndex === -1) dayIndex = 6; // Sunday
                        dailyCounts[dayIndex]++;
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
                                        <tr
                                            key={i}
                                            className="border-b hover:bg-blue-50 cursor-pointer transition-colors"
                                            onClick={() => setSelectedPlayer({ name: p.name, fullName: p.fullName })}
                                            title="Click to view player details"
                                        >
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
    );
};

export default PlayerStatistics;
