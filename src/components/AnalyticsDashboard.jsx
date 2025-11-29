import React from 'react';
import {
    LineChart,
    Line,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    Cell
} from 'recharts';
import { TrendingUp, Trophy, Users } from 'lucide-react';

const AnalyticsDashboard = ({ games, darkMode }) => {
    // Calculate bankroll trend over time
    const calculateBankrollTrend = () => {
        if (!games || games.length === 0) return [];

        const sortedGames = [...games].sort((a, b) =>
            new Date(a.date) - new Date(b.date)
        );

        let cumulative = 0;
        return sortedGames.map((game, index) => {
            const myProfit = game.players?.find(p => p.name === 'You')?.net || 0;
            cumulative += myProfit;
            return {
                game: `Game ${index + 1}`,
                date: game.date,
                profit: cumulative / 100 // Convert cents to dollars
            };
        });
    };

    // Calculate win/loss distribution
    const calculateWinLossDistribution = () => {
        if (!games || games.length === 0) return [];

        const distribution = games.reduce((acc, game) => {
            const myProfit = game.players?.find(p => p.name === 'You')?.net || 0;
            const profitDollars = myProfit / 100;

            if (profitDollars > 0) {
                acc.wins++;
                acc.totalWins += profitDollars;
            } else if (profitDollars < 0) {
                acc.losses++;
                acc.totalLosses += Math.abs(profitDollars);
            } else {
                acc.breakeven++;
            }

            return acc;
        }, { wins: 0, losses: 0, breakeven: 0, totalWins: 0, totalLosses: 0 });

        return [
            { name: 'Wins', count: distribution.wins, amount: distribution.totalWins },
            { name: 'Losses', count: distribution.losses, amount: distribution.totalLosses },
            { name: 'Break Even', count: distribution.breakeven, amount: 0 }
        ];
    };

    // Calculate top players by total profit
    const calculateTopPlayers = () => {
        if (!games || games.length === 0) return [];

        const playerStats = {};

        games.forEach(game => {
            game.players?.forEach(player => {
                if (!playerStats[player.fullName]) {
                    playerStats[player.fullName] = {
                        name: player.fullName,
                        totalProfit: 0,
                        gamesPlayed: 0
                    };
                }
                playerStats[player.fullName].totalProfit += player.net;
                playerStats[player.fullName].gamesPlayed++;
            });
        });

        return Object.values(playerStats)
            .map(p => ({
                ...p,
                totalProfit: p.totalProfit / 100 // Convert to Rupees
            }))
            .sort((a, b) => b.totalProfit - a.totalProfit)
            .slice(0, 10); // Top 10 players
    };

    const bankrollData = calculateBankrollTrend();
    const winLossData = calculateWinLossDistribution();
    const topPlayersData = calculateTopPlayers();

    const chartColors = {
        primary: darkMode ? '#8b5cf6' : '#7c3aed',
        secondary: darkMode ? '#10b981' : '#059669',
        tertiary: darkMode ? '#ef4444' : '#dc2626',
        grid: darkMode ? '#374151' : '#e5e7eb',
        text: darkMode ? '#d1d5db' : '#374151'
    };

    if (!games || games.length === 0) {
        return (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                <TrendingUp size={48} className="mx-auto mb-4 opacity-50" />
                <p>Upload some games to see analytics</p>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            {/* Bankroll Trend */}
            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg">
                <div className="flex items-center gap-3 mb-6">
                    <TrendingUp className="text-purple-600 dark:text-purple-400" size={24} />
                    <h3 className="text-xl font-bold text-gray-800 dark:text-white">
                        Bankroll Trend
                    </h3>
                </div>
                <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={bankrollData}>
                        <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} />
                        <XAxis
                            dataKey="game"
                            stroke={chartColors.text}
                            tick={{ fill: chartColors.text }}
                        />
                        <YAxis
                            stroke={chartColors.text}
                            tick={{ fill: chartColors.text }}
                            label={{
                                value: 'Profit (₹)',
                                angle: -90,
                                position: 'insideLeft',
                                fill: chartColors.text
                            }}
                        />
                        <Tooltip
                            contentStyle={{
                                backgroundColor: darkMode ? '#1f2937' : '#ffffff',
                                border: `1px solid ${chartColors.grid}`,
                                borderRadius: '8px',
                                color: chartColors.text
                            }}
                            formatter={(value) => [`₹${value.toFixed(2)}`, 'Cumulative Profit']}
                        />
                        <Legend />
                        <Line
                            type="monotone"
                            dataKey="profit"
                            stroke={chartColors.primary}
                            strokeWidth={3}
                            dot={{ fill: chartColors.primary, r: 4 }}
                            activeDot={{ r: 6 }}
                            name="Cumulative Profit"
                        />
                    </LineChart>
                </ResponsiveContainer>
            </div>

            {/* Win/Loss Distribution */}
            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg">
                <div className="flex items-center gap-3 mb-6">
                    <Trophy className="text-green-600 dark:text-green-400" size={24} />
                    <h3 className="text-xl font-bold text-gray-800 dark:text-white">
                        Win/Loss Distribution
                    </h3>
                </div>
                <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={winLossData}>
                        <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} />
                        <XAxis
                            dataKey="name"
                            stroke={chartColors.text}
                            tick={{ fill: chartColors.text }}
                        />
                        <YAxis
                            stroke={chartColors.text}
                            tick={{ fill: chartColors.text }}
                            label={{
                                value: 'Count',
                                angle: -90,
                                position: 'insideLeft',
                                fill: chartColors.text
                            }}
                        />
                        <Tooltip
                            contentStyle={{
                                backgroundColor: darkMode ? '#1f2937' : '#ffffff',
                                border: `1px solid ${chartColors.grid}`,
                                borderRadius: '8px',
                                color: chartColors.text
                            }}
                            formatter={(value, name) => {
                                if (name === 'count') return [value, 'Sessions'];
                                return [`₹${value.toFixed(2)}`, 'Total Amount'];
                            }}
                        />
                        <Legend />
                        <Bar dataKey="count" fill={chartColors.secondary} name="Sessions" />
                    </BarChart>
                </ResponsiveContainer>
            </div>

            {/* Top Players */}
            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg">
                <div className="flex items-center gap-3 mb-6">
                    <Users className="text-blue-600 dark:text-blue-400" size={24} />
                    <h3 className="text-xl font-bold text-gray-800 dark:text-white">
                        Top Players by Profit
                    </h3>
                </div>
                <ResponsiveContainer width="100%" height={400}>
                    <BarChart data={topPlayersData} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} />
                        <XAxis
                            type="number"
                            stroke={chartColors.text}
                            tick={{ fill: chartColors.text }}
                            label={{
                                value: 'Total Profit (₹)',
                                position: 'insideBottom',
                                fill: chartColors.text,
                                offset: -5
                            }}
                        />
                        <YAxis
                            type="category"
                            dataKey="name"
                            stroke={chartColors.text}
                            tick={{ fill: chartColors.text }}
                            width={150}
                        />
                        <Tooltip
                            contentStyle={{
                                backgroundColor: darkMode ? '#1f2937' : '#ffffff',
                                border: `1px solid ${chartColors.grid}`,
                                borderRadius: '8px',
                                color: chartColors.text
                            }}
                            formatter={(value) => [`₹${value.toFixed(2)}`, 'Total Profit']}
                        />
                        <Legend />
                        <Bar
                            dataKey="totalProfit"
                            name="Total Profit"
                        >
                            {topPlayersData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={[
                                    '#8b5cf6', '#ec4899', '#f43f5e', '#f59e0b', '#10b981',
                                    '#3b82f6', '#6366f1', '#14b8a6', '#84cc16', '#d946ef'
                                ][index % 10]} />
                            ))}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};

export default AnalyticsDashboard;
