import React from 'react';
import {
    ArrowLeft,
    TrendingUp,
    TrendingDown,
    Trophy,
    Gamepad2,
    Calendar
} from 'lucide-react';
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer
} from 'recharts';

const PlayerDetailView = ({ player, games, darkMode, onBack }) => {
    // Filter games for this player
    const playerGames = games.filter(g =>
        g.players.some(p => p.name.toLowerCase().trim() === player.name.toLowerCase().trim())
    ).sort((a, b) => new Date(a.date) - new Date(b.date));

    // Calculate stats
    const stats = playerGames.reduce((acc, game) => {
        const p = game.players.find(p => p.name.toLowerCase().trim() === player.name.toLowerCase().trim());
        const net = p.net || 0;

        acc.totalGames++;
        acc.totalProfit += net;
        if (net > 0) acc.wins++;
        if (net > acc.bestWin) acc.bestWin = net;
        if (net < acc.worstLoss) acc.worstLoss = net;

        return acc;
    }, {
        totalGames: 0,
        totalProfit: 0,
        wins: 0,
        bestWin: -Infinity,
        worstLoss: Infinity
    });

    if (stats.bestWin === -Infinity) stats.bestWin = 0;
    if (stats.worstLoss === Infinity) stats.worstLoss = 0;

    const winRate = stats.totalGames > 0 ? ((stats.wins / stats.totalGames) * 100).toFixed(1) : '0.0';

    // Prepare chart data
    let cumulative = 0;
    const chartData = playerGames.map((game, index) => {
        const p = game.players.find(p => p.name.toLowerCase().trim() === player.name.toLowerCase().trim());
        cumulative += (p.net || 0);
        return {
            game: `Game ${index + 1}`,
            date: game.date,
            profit: cumulative,
            net: p.net
        };
    });

    const chartColors = {
        primary: darkMode ? '#8b5cf6' : '#7c3aed',
        grid: darkMode ? '#374151' : '#e5e7eb',
        text: darkMode ? '#d1d5db' : '#374151'
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
            {/* Header */}
            <div className="flex items-center gap-4">
                <button
                    onClick={onBack}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
                >
                    <ArrowLeft size={24} className="text-gray-600 dark:text-gray-400" />
                </button>
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{player.fullName}</h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{player.name}</p>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow border border-gray-100 dark:border-gray-700">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                            <TrendingUp size={20} className="text-green-600 dark:text-green-400" />
                        </div>
                        <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Profit</span>
                    </div>
                    <p className={`text-2xl font-bold ${stats.totalProfit >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                        {stats.totalProfit >= 0 ? '+' : ''}₹{stats.totalProfit.toLocaleString()}
                    </p>
                </div>

                <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow border border-gray-100 dark:border-gray-700">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                            <Gamepad2 size={20} className="text-blue-600 dark:text-blue-400" />
                        </div>
                        <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Games Played</span>
                    </div>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                        {stats.totalGames}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">Win Rate: {winRate}%</p>
                </div>

                <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow border border-gray-100 dark:border-gray-700">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg">
                            <Trophy size={20} className="text-yellow-600 dark:text-yellow-400" />
                        </div>
                        <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Best Win</span>
                    </div>
                    <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                        +₹{stats.bestWin.toLocaleString()}
                    </p>
                </div>

                <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow border border-gray-100 dark:border-gray-700">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
                            <TrendingDown size={20} className="text-red-600 dark:text-red-400" />
                        </div>
                        <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Worst Loss</span>
                    </div>
                    <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                        {stats.worstLoss === 0 ? '₹0' : `₹${stats.worstLoss.toLocaleString()}`}
                    </p>
                </div>
            </div>

            {/* Profit Trend Chart */}
            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow border border-gray-100 dark:border-gray-700">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6">Profit Trend</h3>
                <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} />
                            <XAxis
                                dataKey="date"
                                stroke={chartColors.text}
                                tick={{ fill: chartColors.text, fontSize: 12 }}
                                tickFormatter={(val) => new Date(val).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                            />
                            <YAxis
                                stroke={chartColors.text}
                                tick={{ fill: chartColors.text, fontSize: 12 }}
                                tickFormatter={(val) => `₹${val}`}
                            />
                            <Tooltip
                                contentStyle={{
                                    backgroundColor: darkMode ? '#1f2937' : '#ffffff',
                                    border: `1px solid ${chartColors.grid}`,
                                    borderRadius: '8px',
                                    color: chartColors.text
                                }}
                                formatter={(value) => [`₹${value.toLocaleString()}`, 'Cumulative Profit']}
                                labelFormatter={(label) => new Date(label).toLocaleDateString()}
                            />
                            <Line
                                type="monotone"
                                dataKey="profit"
                                stroke={chartColors.primary}
                                strokeWidth={3}
                                dot={{ fill: chartColors.primary, r: 4 }}
                                activeDot={{ r: 6 }}
                            />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Recent Games History */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow border border-gray-100 dark:border-gray-700 overflow-hidden">
                <div className="p-6 border-b border-gray-100 dark:border-gray-700">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">Game History</h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-gray-50 dark:bg-gray-900/50 text-gray-500 dark:text-gray-400">
                            <tr>
                                <th className="px-6 py-3 text-left">Date</th>
                                <th className="px-6 py-3 text-right">Buy In</th>
                                <th className="px-6 py-3 text-right">Buy Out</th>
                                <th className="px-6 py-3 text-right">Net Result</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                            {[...playerGames].reverse().map((game, i) => {
                                const p = game.players.find(p => p.name.toLowerCase().trim() === player.name.toLowerCase().trim());
                                return (
                                    <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                                        <td className="px-6 py-4 text-gray-900 dark:text-white">
                                            <div className="flex items-center gap-2">
                                                <Calendar size={16} className="text-gray-400" />
                                                {new Date(game.date).toLocaleDateString()}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right text-gray-600 dark:text-gray-400">
                                            ₹{p.buyIn.toLocaleString()}
                                        </td>
                                        <td className="px-6 py-4 text-right text-gray-600 dark:text-gray-400">
                                            ₹{p.buyOut.toLocaleString()}
                                        </td>
                                        <td className={`px-6 py-4 text-right font-bold ${p.net > 0 ? 'text-green-600' : p.net < 0 ? 'text-red-600' : 'text-gray-600'}`}>
                                            {p.net > 0 ? '+' : ''}₹{p.net.toLocaleString()}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default PlayerDetailView;
