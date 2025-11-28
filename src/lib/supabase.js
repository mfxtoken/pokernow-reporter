
import { createClient } from '@supabase/supabase-js';

// Initialize the Supabase client
// We'll use localStorage to persist credentials so the user only enters them once
let supabase = null;

export const getSupabase = () => {
    if (supabase) return supabase;

    const supabaseUrl = localStorage.getItem('supabase_url');
    const supabaseKey = localStorage.getItem('supabase_key');

    if (supabaseUrl && supabaseKey) {
        try {
            supabase = createClient(supabaseUrl, supabaseKey);
            return supabase;
        } catch (error) {
            console.error('Failed to initialize Supabase:', error);
            return null;
        }
    }
    return null;
};

export const saveCredentials = (url, key) => {
    localStorage.setItem('supabase_url', url);
    localStorage.setItem('supabase_key', key);
    supabase = createClient(url, key);
    return supabase;
};

export const clearCredentials = () => {
    localStorage.removeItem('supabase_url');
    localStorage.removeItem('supabase_key');
    supabase = null;
};

export const hasCredentials = () => {
    return !!(localStorage.getItem('supabase_url') && localStorage.getItem('supabase_key'));
};

// Auth Operations

export const signUp = async (email, password) => {
    const client = getSupabase();
    if (!client) throw new Error('Supabase not configured');
    const { data, error } = await client.auth.signUp({ email, password });
    if (error) throw error;
    return data;
};

export const signIn = async (email, password) => {
    const client = getSupabase();
    if (!client) throw new Error('Supabase not configured');
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
};

export const signOut = async () => {
    const client = getSupabase();
    if (!client) return;
    const { error } = await client.auth.signOut();
    if (error) throw error;
};

export const getCurrentUser = async () => {
    const client = getSupabase();
    if (!client) return null;
    const { data: { user } } = await client.auth.getUser();
    return user;
};

export const onAuthStateChange = (callback) => {
    const client = getSupabase();
    if (!client) {
        // Return a safe object with a data property to prevent destructuring errors
        return { data: { subscription: { unsubscribe: () => { } } } };
    }
    return client.auth.onAuthStateChange((event, session) => {
        callback(event, session);
    });
};

// Profile Operations

export const getProfile = async (userId) => {
    const client = getSupabase();
    if (!client) return null;

    const { data, error } = await client
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 is "Row not found"
        console.error('Error fetching profile:', error);
    }
    return data;
};

export const updateProfile = async (userId, playerName) => {
    const client = getSupabase();
    if (!client) throw new Error('Supabase not configured');

    const { data, error } = await client
        .from('profiles')
        .upsert({
            id: userId,
            player_name: playerName,
            updated_at: new Date().toISOString()
        })
        .select()
        .single();

    if (error) throw error;
    return data;
};

// Settlement Operations

export const getSettlements = async () => {
    const client = getSupabase();
    if (!client) return [];

    const { data, error } = await client
        .from('settlements')
        .select('*');

    if (error) {
        console.error('Error fetching settlements:', error);
        return [];
    }
    return data;
};

export const updateSettlement = async (debtor, creditor, status, amount) => {
    const client = getSupabase();
    if (!client) throw new Error('Supabase not configured');

    // We use upsert to handle both creating new status entries and updating existing ones
    const { data, error } = await client
        .from('settlements')
        .upsert({
            debtor,
            creditor,
            status,
            amount,
            updated_at: new Date().toISOString()
        }, { onConflict: 'debtor, creditor' })
        .select()
        .single();

    if (error) throw error;
    return data;
};

// Database Operations

export const uploadGame = async (gameData) => {
    const client = getSupabase();
    if (!client) throw new Error('Supabase not configured');

    // Check if game exists first
    const { data: existing } = await client
        .from('games')
        .select('game_id')
        .eq('game_id', gameData.gameId)
        .single();

    if (existing) {
        console.log(`Game ${gameData.gameId} already exists in cloud`);
        return { status: 'skipped', message: 'Game already exists' };
    }

    // Transform data for Supabase (convert camelCase to snake_case if needed, 
    // but our schema uses snake_case column names so we map it)
    const dbRow = {
        game_id: gameData.gameId,
        date: gameData.date,
        total_pot: gameData.totalPot,
        winner: gameData.winner,
        winner_profit: gameData.winnerProfit,
        player_count: gameData.playerCount,
        players: gameData.players, // JSONB column
        created_at: gameData.addedAt || new Date().toISOString()
    };

    const { data, error } = await client
        .from('games')
        .insert([dbRow])
        .select();

    if (error) throw error;
    return { status: 'uploaded', data };
};

export const fetchAllGames = async () => {
    const client = getSupabase();
    if (!client) return [];

    const { data, error } = await client
        .from('games')
        .select('*')
        .order('date', { ascending: false });

    if (error) {
        console.error('Error fetching games:', error);
        throw error;
    }

    // Transform back to app format
    return data.map(row => ({
        gameId: row.game_id,
        date: row.date,
        totalPot: row.total_pot,
        winner: row.winner,
        winnerProfit: row.winner_profit,
        playerCount: row.player_count,
        players: row.players,
        addedAt: row.created_at
    }));
};
