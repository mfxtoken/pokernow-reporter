// Storage utility for browsers without window.storage API
// Falls back to localStorage

const storage = {
  async get(key) {
    try {
      // Try window.storage first (for Claude.ai)
      if (window.storage && typeof window.storage.get === 'function') {
        return await window.storage.get(key);
      }
      
      // Fallback to localStorage
      const value = localStorage.getItem(key);
      if (value === null) {
        throw new Error('Key not found');
      }
      return { key, value };
    } catch (error) {
      throw error;
    }
  },

  async set(key, value) {
    try {
      // Try window.storage first (for Claude.ai)
      if (window.storage && typeof window.storage.set === 'function') {
        return await window.storage.set(key, value);
      }
      
      // Fallback to localStorage
      localStorage.setItem(key, value);
      return { key, value };
    } catch (error) {
      throw error;
    }
  },

  async delete(key) {
    try {
      // Try window.storage first (for Claude.ai)
      if (window.storage && typeof window.storage.delete === 'function') {
        return await window.storage.delete(key);
      }
      
      // Fallback to localStorage
      localStorage.removeItem(key);
      return { key, deleted: true };
    } catch (error) {
      throw error;
    }
  }
};

export default storage;