import AsyncStorage from '@react-native-async-storage/async-storage';

const LOCATIONS_KEY = 'favorite_locations';

interface Location {
  name: string;
  lastChecked: number;
}

export const locationsService = {
  async addLocation(name: string): Promise<void> {
    try {
      const locations = await this.getLocations();
      
      // Check if location already exists
      const existingLocation = locations.find(loc => loc.name.toLowerCase() === name.toLowerCase());
      if (existingLocation) {
        throw new Error('This location is already in your favorites');
      }

      // Add new location
      locations.push({
        name,
        lastChecked: Date.now()
      });

      await AsyncStorage.setItem(LOCATIONS_KEY, JSON.stringify(locations));
    } catch (error) {
      throw error;
    }
  },

  async removeLocation(name: string): Promise<void> {
    try {
      const locations = await this.getLocations();
      const updatedLocations = locations.filter(loc => loc.name.toLowerCase() !== name.toLowerCase());
      await AsyncStorage.setItem(LOCATIONS_KEY, JSON.stringify(updatedLocations));
    } catch (error) {
      throw error;
    }
  },

  async getLocations(): Promise<Location[]> {
    try {
      const locationsString = await AsyncStorage.getItem(LOCATIONS_KEY);
      return locationsString ? JSON.parse(locationsString) : [];
    } catch (error) {
      return [];
    }
  },

  async clearLocations(): Promise<void> {
    await AsyncStorage.removeItem(LOCATIONS_KEY);
  },

  async updateLastChecked(name: string): Promise<void> {
    try {
      const locations = await this.getLocations();
      const updatedLocations = locations.map(loc => 
        loc.name.toLowerCase() === name.toLowerCase() 
          ? { ...loc, lastChecked: Date.now() }
          : loc
      );
      await AsyncStorage.setItem(LOCATIONS_KEY, JSON.stringify(updatedLocations));
    } catch (error) {
      throw error;
    }
  },

  async getFavoriteLocations(): Promise<string[]> {
    const locations = await this.getLocations();
    return locations.map(loc => loc.name);
  },
};
