import { createClient } from '@supabase/supabase-js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.join(__dirname, '..');

// Helper to read .env file manually
async function loadEnv() {
    try {
        const envPath = path.join(PROJECT_ROOT, '.env');
        const content = await fs.readFile(envPath, 'utf-8');
        const env = {};
        content.split('\n').forEach(line => {
            const match = line.match(/^([^=]+)=(.*)$/);
            if (match) {
                env[match[1].trim()] = match[2].trim();
            }
        });
        return env;
    } catch (error) {
        console.error('Error reading .env file:', error);
        return {};
    }
}

// Player Aliases (copied from App.jsx)
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

// CSV Parser (copied from App.jsx)
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

// Game Analyzer (copied from App.jsx)
const analyzeGameData = (csvData) => {
    const playerStats = {};
    let totalBuyIn = 0;
    let gameDate = null;

    csvData.forEach(row => {
        const player = row.player_nickname.trim();
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

async function main() {
    console.log('🚀 Starting CSV Upload Script...');

    // 1. Load Environment Variables
    const env = await loadEnv();
    const supabaseUrl = env.VITE_SUPABASE_URL;
    const supabaseKey = env.VITE_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
        console.error('❌ Missing Supabase credentials in .env file');
        process.exit(1);
    }

    // 2. Initialize Supabase
    const supabase = createClient(supabaseUrl, supabaseKey);
    console.log('✓ Connected to Supabase');

    // 3. Read CSV Files
    const csvDir = path.join(PROJECT_ROOT, 'csv_data');
    let files;
    try {
        files = await fs.readdir(csvDir);
        files = files.filter(f => f.endsWith('.csv'));
    } catch (error) {
        console.error(`❌ Error reading directory ${csvDir}:`, error.message);
        console.log('💡 Please create a "csv_data" folder and put your CSV files there.');
        process.exit(1);
    }

    if (files.length === 0) {
        console.log('⚠️  No CSV files found in csv_data directory.');
        process.exit(0);
    }

    console.log(`✓ Found ${files.length} CSV files to process\n`);

    // 4. Process Files
    let successCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const file of files) {
        console.log(`Processing ${file}...`);
        try {
            const filePath = path.join(csvDir, file);
            const content = await fs.readFile(filePath, 'utf-8');

            // Parse Game ID from filename
            const gameId = file.replace('.csv', '').replace('ledger_', '');

            // Check if game exists in Supabase
            const { data: existing } = await supabase
                .from('games')
                .select('game_id')
                .eq('game_id', gameId)
                .single();

            if (existing) {
                console.log(`  ⏭️  Skipping: Game ${gameId} already exists`);
                skippedCount++;
                continue;
            }

            // Parse and Analyze
            const csvData = parseCSV(content);
            const analysis = analyzeGameData(csvData);

            // Prepare DB Row
            const dbRow = {
                game_id: gameId,
                date: analysis.gameDate,
                total_pot: analysis.totalPot,
                winner: analysis.winner,
                winner_profit: analysis.winnerProfit,
                player_count: analysis.playerCount,
                players: analysis.players,
                created_at: new Date().toISOString()
            };

            // Upload
            const { error } = await supabase
                .from('games')
                .insert(dbRow);

            if (error) throw error;

            console.log(`  ✅ Uploaded: Game ${gameId}`);
            successCount++;

        } catch (error) {
            console.error(`  ❌ Failed: ${error.message}`);
            errorCount++;
        }
    }

    console.log('\n🎉 Upload Complete!');
    console.log(`Uploaded: ${successCount}`);
    console.log(`Skipped:  ${skippedCount}`);
    console.log(`Errors:   ${errorCount}`);
}

main();
