import AsyncStorage from '@react-native-async-storage/async-storage';

interface FavoritePest {
  name: string;
  timestamp: number;
}

const FAVORITES_KEY = 'favorite_pests';

export const favoritesService = {
  async addFavorite(pestName: string): Promise<void> {
    try {
      const favorites = await this.getFavorites();
      const newFavorite: FavoritePest = {
        name: pestName,
        timestamp: Date.now()
      };

      // Remove existing favorite if it exists
      const updatedFavorites = favorites.filter(f => f.name !== pestName);
      
      // Add new favorite (keep only last 50)
      const finalFavorites = [newFavorite, ...updatedFavorites].slice(0, 50);
      
      await AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify(finalFavorites));
    } catch (error) {
      console.error('Error adding favorite:', error);
    }
  },

  async removeFavorite(pestName: string): Promise<void> {
    try {
      const favorites = await this.getFavorites();
      const updatedFavorites = favorites.filter(f => f.name !== pestName);
      await AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify(updatedFavorites));
    } catch (error) {
      console.error('Error removing favorite:', error);
    }
  },

  async isFavorite(pestName: string): Promise<boolean> {
    try {
      const favorites = await this.getFavorites();
      return favorites.some(f => f.name === pestName);
    } catch (error) {
      console.error('Error checking favorite:', error);
      return false;
    }
  },

  async getFavorites(): Promise<FavoritePest[]> {
    try {
      const favoritesString = await AsyncStorage.getItem(FAVORITES_KEY);
      return favoritesString ? JSON.parse(favoritesString) : [];
    } catch (error) {
      console.error('Error getting favorites:', error);
      return [];
    }
  },

  async clearFavorites(): Promise<void> {
    try {
      await AsyncStorage.removeItem(FAVORITES_KEY);
    } catch (error) {
      console.error('Error clearing favorites:', error);
    }
  }
};
