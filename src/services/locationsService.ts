import AsyncStorage from '@react-native-async-storage/async-storage';

const LOCATIONS_KEY = 'favorite_locations';
const REGIONAL_CITIES_KEY = 'regional_cities';

interface Location {
  name: string;
  lastChecked: number;
  region?: string;
  coordinates?: {
    latitude: number;
    longitude: number;
  };
}

interface RegionalCities {
  [region: string]: string[];
}

export const locationsService = {
  async addLocation(name: string, region?: string, coordinates?: { latitude: number; longitude: number }): Promise<void> {
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
        lastChecked: Date.now(),
        region,
        coordinates
      });

      await AsyncStorage.setItem(LOCATIONS_KEY, JSON.stringify(locations));

      // Update regional cities if region is provided
      if (region) {
        await this.updateRegionalCities(region, name);
      }
    } catch (error) {
      throw error;
    }
  },

  async removeLocation(name: string): Promise<void> {
    try {
      const locations = await this.getLocations();
      const updatedLocations = locations.filter(loc => loc.name.toLowerCase() !== name.toLowerCase());
      await AsyncStorage.setItem(LOCATIONS_KEY, JSON.stringify(updatedLocations));

      // Update regional cities if location had a region
      const location = locations.find(loc => loc.name.toLowerCase() === name.toLowerCase());
      if (location?.region) {
        await this.removeCityFromRegion(location.region, name);
      }
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
    await AsyncStorage.removeItem(REGIONAL_CITIES_KEY);
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

  async getLocationsByRegion(region: string): Promise<string[]> {
    const cities = await this.getCitiesInRegion(region);
    return cities || [];
  },

  async updateRegionalCities(region: string, city: string): Promise<void> {
    try {
      const cities = await this.getCitiesInRegion(region);
      if (!cities) {
        await AsyncStorage.setItem(REGIONAL_CITIES_KEY, JSON.stringify({ [region]: [city] }));
      } else {
        if (!cities.includes(city)) {
          cities.push(city);
          const regionalCities = await this.getRegionalCities();
          regionalCities[region] = cities;
          await AsyncStorage.setItem(REGIONAL_CITIES_KEY, JSON.stringify(regionalCities));
        }
      }
    } catch (error) {
      throw error;
    }
  },

  async removeCityFromRegion(region: string, city: string): Promise<void> {
    try {
      const cities = await this.getCitiesInRegion(region);
      if (cities && cities.includes(city)) {
        const updatedCities = cities.filter(c => c !== city);
        const regionalCities = await this.getRegionalCities();
        regionalCities[region] = updatedCities;
        await AsyncStorage.setItem(REGIONAL_CITIES_KEY, JSON.stringify(regionalCities));
      }
    } catch (error) {
      throw error;
    }
  },

  async getCitiesInRegion(region: string): Promise<string[]> {
    try {
      const regionalCitiesString = await AsyncStorage.getItem(REGIONAL_CITIES_KEY);
      const regionalCities = regionalCitiesString ? JSON.parse(regionalCitiesString) : {};
      return regionalCities[region] || [];
    } catch (error) {
      return [];
    }
  },

  async getRegionalCities(): Promise<RegionalCities> {
    try {
      const regionalCitiesString = await AsyncStorage.getItem(REGIONAL_CITIES_KEY);
      return regionalCitiesString ? JSON.parse(regionalCitiesString) : {};
    } catch (error) {
      return {};
    }
  },

  async getRegions(): Promise<string[]> {
    const regionalCities = await this.getRegionalCities();
    return Object.keys(regionalCities);
  },

  async getRegionForCity(city: string): Promise<string | null> {
    const locations = await this.getLocations();
    const location = locations.find(loc => loc.name.toLowerCase() === city.toLowerCase());
    return location?.region || null;
  },

  async getCoordinatesForCity(city: string): Promise<{ latitude: number; longitude: number } | null> {
    const locations = await this.getLocations();
    const location = locations.find(loc => loc.name.toLowerCase() === city.toLowerCase());
    return location?.coordinates || null;
  },

  async getMostRecentLocation(): Promise<string | null> {
    const locations = await this.getLocations();
    if (locations.length === 0) return null;

    const sortedLocations = [...locations].sort((a, b) => b.lastChecked - a.lastChecked);
    return sortedLocations[0].name;
  },

  async getLocationCount(): Promise<number> {
    const locations = await this.getLocations();
    return locations.length;
  },
};
