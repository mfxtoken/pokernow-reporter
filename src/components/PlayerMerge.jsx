import React, { useState } from 'react';
import { Users, ArrowRight, AlertTriangle } from 'lucide-react';

const PlayerMerge = ({ games, onMerge, darkMode }) => {
    const [sourcePlayer, setSourcePlayer] = useState('');
    const [targetPlayer, setTargetPlayer] = useState('');
    const [showConfirm, setShowConfirm] = useState(false);

    // Get unique player names from all games
    const getAllPlayers = () => {
        if (!games || games.length === 0) return [];

        const playerSet = new Set();
        games.forEach(game => {
            game.players?.forEach(player => {
                playerSet.add(player.fullName);
            });
        });

        return Array.from(playerSet).sort();
    };

    const players = getAllPlayers();

    const handleMerge = () => {
        if (!sourcePlayer || !targetPlayer) {
            alert('Please select both source and target players');
            return;
        }

        if (sourcePlayer === targetPlayer) {
            alert('Source and target players must be different');
            return;
        }

        setShowConfirm(true);
    };

    const confirmMerge = () => {
        onMerge(sourcePlayer, targetPlayer);
        setShowConfirm(false);
        setSourcePlayer('');
        setTargetPlayer('');
    };

    const getPlayerStats = (playerName) => {
        if (!playerName || !games) return null;

        let gamesPlayed = 0;
        let totalProfit = 0;

        games.forEach(game => {
            const player = game.players?.find(p => p.fullName === playerName);
            if (player) {
                gamesPlayed++;
                totalProfit += player.net;
            }
        });

        return {
            gamesPlayed,
            totalProfit: totalProfit / 100
        };
    };

    const sourceStats = getPlayerStats(sourcePlayer);
    const targetStats = getPlayerStats(targetPlayer);

    if (players.length === 0) {
        return (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                <Users size={48} className="mx-auto mb-4 opacity-50" />
                <p>No players found. Upload some games first.</p>
            </div>
        );
    }

    return (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg">
            <div className="flex items-center gap-3 mb-6">
                <Users className="text-purple-600 dark:text-purple-400" size={24} />
                <h3 className="text-xl font-bold text-gray-800 dark:text-white">
                    Merge Player Profiles
                </h3>
            </div>

            <div className="mb-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg">
                <div className="flex items-start gap-3">
                    <AlertTriangle className="text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-1" size={20} />
                    <div className="text-sm text-yellow-800 dark:text-yellow-200">
                        <p className="font-semibold mb-1">Warning: This action cannot be undone!</p>
                        <p>All games where the source player appears will be updated to show the target player instead.</p>
                    </div>
                </div>
            </div>

            <div className="grid md:grid-cols-3 gap-6 items-center">
                {/* Source Player */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Source Player (will be removed)
                    </label>
                    <select
                        value={sourcePlayer}
                        onChange={(e) => setSourcePlayer(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500"
                    >
                        <option value="">Select player...</option>
                        {players.map(player => (
                            <option key={player} value={player}>{player}</option>
                        ))}
                    </select>
                    {sourceStats && (
                        <div className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                            <p>{sourceStats.gamesPlayed} games</p>
                            <p className={sourceStats.totalProfit >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                                ${sourceStats.totalProfit.toFixed(2)} profit
                            </p>
                        </div>
                    )}
                </div>

                {/* Arrow */}
                <div className="flex justify-center">
                    <ArrowRight className="text-gray-400" size={32} />
                </div>

                {/* Target Player */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Target Player (will keep)
                    </label>
                    <select
                        value={targetPlayer}
                        onChange={(e) => setTargetPlayer(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500"
                    >
                        <option value="">Select player...</option>
                        {players.map(player => (
                            <option key={player} value={player}>{player}</option>
                        ))}
                    </select>
                    {targetStats && (
                        <div className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                            <p>{targetStats.gamesPlayed} games</p>
                            <p className={targetStats.totalProfit >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                                ${targetStats.totalProfit.toFixed(2)} profit
                            </p>
                        </div>
                    )}
                </div>
            </div>

            <div className="mt-6 flex justify-center">
                <button
                    onClick={handleMerge}
                    disabled={!sourcePlayer || !targetPlayer}
                    className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-semibold transition-colors"
                >
                    Merge Players
                </button>
            </div>

            {/* Confirmation Modal */}
            {showConfirm && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-xl p-6 max-w-md w-full">
                        <h4 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                            Confirm Player Merge
                        </h4>
                        <p className="text-gray-700 dark:text-gray-300 mb-6">
                            Are you sure you want to merge <strong>{sourcePlayer}</strong> into <strong>{targetPlayer}</strong>?
                        </p>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                            This will update {sourceStats?.gamesPlayed || 0} games and combine their statistics.
                        </p>
                        <div className="flex gap-3 justify-end">
                            <button
                                onClick={() => setShowConfirm(false)}
                                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmMerge}
                                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                            >
                                Confirm Merge
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PlayerMerge;
