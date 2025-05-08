import AsyncStorage from '@react-native-async-storage/async-storage';

interface Pest {
  name: string;
  confidence: number;
  treatment: string;
  prevention: string;
  symptoms: string;
  crop: string;
}

interface CachedPest {
  data: Pest;
  timestamp: number;
}

const PESTS_CACHE_KEY = 'pests_cache';
const CACHE_EXPIRY_TIME = 604800000; // 7 days in milliseconds

export const pestCacheService = {
  async savePest(pest: Pest): Promise<void> {
    try {
      const cache = await this.getPestCache();
      cache[pest.name] = {
        data: pest,
        timestamp: Date.now(),
      };
      await AsyncStorage.setItem(PESTS_CACHE_KEY, JSON.stringify(cache));
    } catch (error) {
      console.error('Error saving pest to cache:', error);
    }
  },

  async getPest(name: string): Promise<Pest | null> {
    try {
      const cache = await this.getPestCache();
      const cachedPest = cache[name];

      if (!cachedPest) {
        return null;
      }

      // Check if cache is expired
      if (Date.now() - cachedPest.timestamp > CACHE_EXPIRY_TIME) {
        return null;
      }

      return cachedPest.data;
    } catch (error) {
      console.error('Error getting pest from cache:', error);
      return null;
    }
  },

  async getAllPests(): Promise<Pest[]> {
    try {
      const cache = await this.getPestCache();
      const currentTimestamp = Date.now();
      
      // Filter out expired pests
      const validPests = Object.values(cache)
        .filter(pest => currentTimestamp - pest.timestamp <= CACHE_EXPIRY_TIME)
        .map(pest => pest.data);

      return validPests;
    } catch (error) {
      console.error('Error getting all pests from cache:', error);
      return [];
    }
  },

  async clearCache(): Promise<void> {
    try {
      await AsyncStorage.removeItem(PESTS_CACHE_KEY);
    } catch (error) {
      console.error('Error clearing pest cache:', error);
    }
  },

  async getPestCache(): Promise<Record<string, CachedPest>> {
    try {
      const cacheString = await AsyncStorage.getItem(PESTS_CACHE_KEY);
      return cacheString ? JSON.parse(cacheString) : {};
    } catch (error) {
      return {};
    }
  },
};
