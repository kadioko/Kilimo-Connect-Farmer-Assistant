import AsyncStorage from '@react-native-async-storage/async-storage';
import { WeatherData } from '../types/weather';
import { WEATHER_API_KEY, WEATHER_API_BASE_URL } from '../config/weather';

const WEATHER_CACHE_KEY = 'weather_cache';
const CACHE_EXPIRY_TIME = 3600000; // 1 hour in milliseconds

interface CachedWeather {
  data: WeatherData;
  timestamp: number;
}

export const weatherService = {
  async fetchWeather(city: string): Promise<WeatherData> {
    try {
      // First try to get from cache
      const cachedWeather = await this.getCachedWeather(city);
      if (cachedWeather) {
        return cachedWeather;
      }

      // If not in cache, fetch from API
      const response = await fetch(
        `${WEATHER_API_BASE_URL}/weather?q=${city}&appid=${WEATHER_API_KEY}&units=metric`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch weather data');
      }

      const data = await response.json();
      
      // Save to cache
      await this.saveWeatherToCache(city, data);
      
      return data;
    } catch (error) {
      // If API fails, try to get from cache
      const cachedWeather = await this.getCachedWeather(city);
      if (cachedWeather) {
        return cachedWeather;
      }
      throw error;
    }
  },

  async saveWeatherToCache(city: string, weatherData: WeatherData): Promise<void> {
    const cache: Record<string, CachedWeather> = await this.getWeatherCache();
    cache[city] = {
      data: weatherData,
      timestamp: Date.now(),
    };
    await AsyncStorage.setItem(WEATHER_CACHE_KEY, JSON.stringify(cache));
  },

  async getCachedWeather(city: string): Promise<WeatherData | null> {
    const cache = await this.getWeatherCache();
    const cachedWeather = cache[city];

    if (!cachedWeather) {
      return null;
    }

    // Check if cache is expired
    if (Date.now() - cachedWeather.timestamp > CACHE_EXPIRY_TIME) {
      return null;
    }

    return cachedWeather.data;
  },

  async clearWeatherCache(): Promise<void> {
    await AsyncStorage.removeItem(WEATHER_CACHE_KEY);
  },

  private async getWeatherCache(): Promise<Record<string, CachedWeather>> {
    try {
      const cacheString = await AsyncStorage.getItem(WEATHER_CACHE_KEY);
      return cacheString ? JSON.parse(cacheString) : {};
    } catch (error) {
      return {};
    }
  },
};
