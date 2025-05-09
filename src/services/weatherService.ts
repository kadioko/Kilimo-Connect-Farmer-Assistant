import AsyncStorage from '@react-native-async-storage/async-storage';
import { WeatherData, WeatherForecast, WeatherAlert } from '../types/weather';
const WEATHER_API_KEY = process.env.WEATHER_API_KEY || 'YOUR_API_KEY';
const WEATHER_API_BASE_URL = 'https://api.openweathermap.org/data/2.5';
import { locationsService } from '../services/locationsService';

const WEATHER_CACHE_KEY = 'weather_cache';
const FORECAST_CACHE_KEY = 'forecast_cache';
const CACHE_EXPIRY_TIME = 3600000; // 1 hour in milliseconds
const FORECAST_EXPIRY_TIME = 86400000; // 24 hours in milliseconds

export enum TemperatureUnit {
  Celsius = 'C',
  Fahrenheit = 'F'
}

export enum SpeedUnit {
  MetersPerSecond = 'm/s',
  KilometersPerHour = 'km/h',
  MilesPerHour = 'mph'
}

export enum DistanceUnit {
  Kilometers = 'km',
  Miles = 'mi'
}

interface WeatherPreferences {
  temperatureUnit: TemperatureUnit;
  speedUnit: SpeedUnit;
  distanceUnit: DistanceUnit;
}

const DEFAULT_PREFERENCES: WeatherPreferences = {
  temperatureUnit: TemperatureUnit.Celsius,
  speedUnit: SpeedUnit.KilometersPerHour,
  distanceUnit: DistanceUnit.Kilometers
};

interface CachedWeather {
  data: WeatherData;
  timestamp: number;
}

interface CachedForecast {
  data: WeatherForecast;
  timestamp: number;
}

export class WeatherService {
  private cache: {
    weather: Record<string, CachedWeather>;
    forecast: Record<string, CachedForecast>;
  } = {
    weather: {},
    forecast: {}
  };

  constructor() {
    this.initializeCache();
  }

  private async initializeCache(): Promise<void> {
    try {
      const weatherCache = await AsyncStorage.getItem(WEATHER_CACHE_KEY);
      const forecastCache = await AsyncStorage.getItem(FORECAST_CACHE_KEY);

      if (weatherCache) {
        this.cache.weather = JSON.parse(weatherCache);
      }

      if (forecastCache) {
        this.cache.forecast = JSON.parse(forecastCache);
      }
    } catch (error) {
      console.error('Error initializing cache:', error);
    }
  }

  private async getCachedWeather(city: string): Promise<WeatherData | null> {
    try {
      const cache = await AsyncStorage.getItem(WEATHER_CACHE_KEY);
      if (!cache) return null;

      const cachedData = JSON.parse(cache);
      const cachedWeather = cachedData[city];
      
      if (!cachedWeather) return null;
      
      const now = Date.now();
      if (now - cachedWeather.timestamp > CACHE_EXPIRY_TIME) {
        delete cachedData[city];
        await AsyncStorage.setItem(WEATHER_CACHE_KEY, JSON.stringify(cachedData));
        return null;
      }
      
      return cachedWeather.data;
    } catch (error) {
      console.error('Error getting cached weather:', error);
      return null;
    }
  }

  private async getCachedForecast(city: string): Promise<WeatherForecast | null> {
    try {
      const cache = await AsyncStorage.getItem(FORECAST_CACHE_KEY);
      if (!cache) return null;

      const cachedData = JSON.parse(cache);
      const cachedForecast = cachedData[city];
      
      if (!cachedForecast) return null;
      
      const now = Date.now();
      if (now - cachedForecast.timestamp > FORECAST_EXPIRY_TIME) {
        delete cachedData[city];
        await AsyncStorage.setItem(FORECAST_CACHE_KEY, JSON.stringify(cachedData));
        return null;
      }
      
      return cachedForecast.data;
    } catch (error) {
      console.error('Error getting cached forecast:', error);
      return null;
    }
  }



  private async saveForecastToCache(city: string, forecastData: WeatherForecast): Promise<void> {
    try {
      const cache = await AsyncStorage.getItem(FORECAST_CACHE_KEY);
      const cachedData = cache ? JSON.parse(cache) : {};
      
      cachedData[city] = {
        data: forecastData,
        timestamp: Date.now()
      };
      
      await AsyncStorage.setItem(FORECAST_CACHE_KEY, JSON.stringify(cachedData));
    } catch (error) {
      console.error('Error saving forecast to cache:', error);
    }
  }

  private convertWeatherUnits(weather: WeatherData, preferences: WeatherPreferences = DEFAULT_PREFERENCES): WeatherData {
    const { temperatureUnit, speedUnit } = preferences;
    const convertedWeather = { ...weather };

    // Convert temperature
    if (temperatureUnit === TemperatureUnit.Fahrenheit) {
      convertedWeather.main.temp = (weather.main.temp * 9/5) + 32;
      convertedWeather.main.temp_min = (weather.main.temp_min * 9/5) + 32;
      convertedWeather.main.temp_max = (weather.main.temp_max * 9/5) + 32;
      convertedWeather.main.feels_like = (weather.main.feels_like * 9/5) + 32;
    }

    // Convert wind speed
    if (speedUnit === SpeedUnit.MilesPerHour) {
      convertedWeather.wind.speed *= 2.23694;
    } else if (speedUnit === SpeedUnit.KilometersPerHour) {
      convertedWeather.wind.speed *= 3.6;
    }

    return convertedWeather;
  }

  async fetchWeather(city: string, preferences?: WeatherPreferences): Promise<WeatherData> {
    try {
      // First try to get from cache
      const cachedWeather = await this.getCachedWeather(city);
      if (cachedWeather) {
        return this.convertWeatherUnits(cachedWeather, preferences);
      }

      // If not in cache, fetch from API
      const response = await fetch(
        `${WEATHER_API_BASE_URL}/weather?q=${city}&appid=${WEATHER_API_KEY}&units=metric&lang=sw`
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch weather data for ${city}: ${response.statusText}`);
      }

      const data = await response.json();
      
      // Save to cache
      await this.saveWeatherToCache(city, data);
      
      return this.convertWeatherUnits(data, preferences);
    } catch (error) {
      console.error(`Error fetching weather for ${city}:`, error);
      // If API fails, try to get from cache
      const cachedWeather = await this.getCachedWeather(city);
      if (cachedWeather) {
        return this.convertWeatherUnits(cachedWeather, preferences);
      }
      throw error;
    }
  }

  async fetchForecast(city: string): Promise<WeatherForecast> {
    try {
      // First try to get from cache
      const cachedForecast = await this.getCachedForecast(city);
      if (cachedForecast) {
        return cachedForecast;
      }

      // If not in cache, fetch from API
      const response = await fetch(
        `${WEATHER_API_BASE_URL}/forecast?q=${city}&appid=${WEATHER_API_KEY}&units=metric&lang=sw`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch weather forecast');
      }

      const data = await response.json();
      
      // Save to cache
      await this.saveForecastToCache(city, data);
      
      return data;
    } catch (error) {
      console.error('Error fetching forecast:', error);
      throw error;
    }
  }

  private async saveForecastToCache(city: string, forecastData: WeatherForecast): Promise<void> {
    try {
      const cache = await AsyncStorage.getItem(FORECAST_CACHE_KEY);
      const cachedData = cache ? JSON.parse(cache) : {};
      
      cachedData[city] = {
        data: forecastData,
        timestamp: Date.now()
      };
      
      await AsyncStorage.setItem(FORECAST_CACHE_KEY, JSON.stringify(cachedData));
    } catch (error) {
      console.error('Error saving forecast to cache:', error);
    }
  }



  async clearWeatherCache(): Promise<void> {
    await AsyncStorage.removeItem(WEATHER_CACHE_KEY);
    await AsyncStorage.removeItem(FORECAST_CACHE_KEY);
  }

  async getWeatherCache(): Promise<Record<string, CachedWeather>> {
    try {
      const cacheString = await AsyncStorage.getItem(WEATHER_CACHE_KEY);
      return cacheString ? JSON.parse(cacheString) : {};
    } catch (error) {
      console.error('Error getting weather cache:', error);
      return {};
    }
  }

  async getForecastCache(): Promise<Record<string, CachedForecast>> {
    try {
      const cacheString = await AsyncStorage.getItem(FORECAST_CACHE_KEY);
      return cacheString ? JSON.parse(cacheString) : {};
    } catch (error) {
      console.error('Error getting forecast cache:', error);
      return {};
    }
  }

  async getWeatherForMultipleCities(cities: string[]): Promise<Record<string, WeatherData>> {
    const results: Record<string, WeatherData> = {};
    
    for (const city of cities) {
      try {
        const weather = await this.fetchWeather(city);
        results[city] = weather;
      } catch (error) {
        console.error(`Error fetching weather for ${city}:`, error);
      }
    }

    return results;
  }

  async getRegionalWeather(region: string): Promise<Record<string, WeatherData>> {
    // Get list of cities in the region
    const cities = await this.getCitiesInRegion(region);
    return this.getWeatherForMultipleCities(cities);
  }

  async getCitiesInRegion(region: string): Promise<string[]> {
    try {
      // First try to get from locations service
      const cities = await locationsService.getLocationsByRegion(region);
      if (cities.length > 0) {
        return cities;
      }

      // If no cities found in locations service, try to fetch from API
      const response = await fetch(
        `${WEATHER_API_BASE_URL}/city?q=${region}&appid=${WEATHER_API_KEY}`
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch cities for region ${region}: ${response.statusText}`);
      }

      const data = await response.json();
      const cities = data.map((city: any) => city.name);

      // Save cities to locations service for future use
      for (const city of cities) {
        try {
          await locationsService.addLocation(city, region);
        } catch (error) {
          console.error(`Error adding city ${city} to favorites:`, error);
        }
      }

      return cities;
    } catch (error) {
      console.error('Error getting cities for region:', error);
      return [];
    }
  }

  async getWeatherAlerts(): Promise<WeatherAlert[]> {
    try {
      const response = await fetch(
        `${WEATHER_API_BASE_URL}/alerts?appid=${WEATHER_API_KEY}`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch weather alerts');
      }

      const alerts = await response.json();
      
      // Filter alerts for relevant locations
      const userLocations = await locationsService.getFavoriteLocations();
      
      return alerts.filter((alert: WeatherAlert) => {
        // Check if alert affects any of the user's locations
        return alert.areas.some(area => userLocations.includes(area));
      });
    } catch (error) {
      console.error('Error fetching weather alerts:', error);
      return [];
    }
  }
}
