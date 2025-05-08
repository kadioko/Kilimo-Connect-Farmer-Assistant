import AsyncStorage from '@react-native-async-storage/async-storage';
import { smsService } from './index';

export interface MarketPrice {
  id: string;
  crop: string;
  price: number;
  unit: string;
  market: string;
  timestamp: number;
  source: 'sms' | 'api';
  confidence: number;
}

export interface PriceUpdateRequest {
  crop: string;
  market: string;
  price: number;
  unit: string;
}

export class MarketPricesService {
  private static instance: MarketPricesService;
  private prices: MarketPrice[] = [];
  private updateInterval: NodeJS.Timeout | null = null;

  private constructor() {}

  static getInstance(): MarketPricesService {
    if (!MarketPricesService.instance) {
      MarketPricesService.instance = new MarketPricesService();
    }
    return MarketPricesService.instance;
  }

  async initialize(): Promise<void> {
    await this.loadPrices();
    this.startPriceUpdates();
  }

  private async loadPrices(): Promise<void> {
    try {
      const storedPrices = await AsyncStorage.getItem('market_prices');
      if (storedPrices) {
        this.prices = JSON.parse(storedPrices);
      }
    } catch (error) {
      console.error('Error loading market prices:', error);
    }
  }

  private async savePrices(): Promise<void> {
    try {
      await AsyncStorage.setItem('market_prices', JSON.stringify(this.prices));
    } catch (error) {
      console.error('Error saving market prices:', error);
    }
  }

  private startPriceUpdates(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }

    this.updateInterval = setInterval(async () => {
      await this.fetchPrices();
    }, 3600000); // Update every hour
  }

  private async fetchPrices(): Promise<void> {
    try {
      // Simulate API call to get market prices
      const newPrices = await this.getMarketPricesFromAPI();
      
      // Process new prices
      const processedPrices = await this.processPrices(newPrices);
      
      // Update stored prices
      this.prices = [...this.prices, ...processedPrices];
      await this.savePrices();
    } catch (error) {
      console.error('Error fetching market prices:', error);
    }
  }

  private async getMarketPricesFromAPI(): Promise<MarketPrice[]> {
    // TODO: Implement actual API call
    return [
      {
        id: Date.now().toString(),
        crop: 'Maize',
        price: 1000,
        unit: 'kg',
        market: 'Nairobi',
        timestamp: Date.now(),
        source: 'api',
        confidence: 0.95
      },
      {
        id: Date.now().toString(),
        crop: 'Beans',
        price: 1500,
        unit: 'kg',
        market: 'Nairobi',
        timestamp: Date.now(),
        source: 'api',
        confidence: 0.9
      }
    ];
  }

  private async processPrices(prices: MarketPrice[]): Promise<MarketPrice[]> {
    const processedPrices: MarketPrice[] = [];

    for (const price of prices) {
      // Validate price data
      if (price.price <= 0 || !price.crop || !price.market) {
        continue;
      }

      // Add to processed prices
      processedPrices.push({
        ...price,
        id: Date.now().toString(),
        timestamp: Date.now()
      });
    }

    return processedPrices;
  }

  async getLatestPrices(): Promise<MarketPrice[]> {
    return [...this.prices].sort((a, b) => b.timestamp - a.timestamp).slice(0, 10);
  }

  async getPricesByCrop(crop: string): Promise<MarketPrice[]> {
    return this.prices.filter(p => p.crop.toLowerCase() === crop.toLowerCase());
  }

  async getPricesByMarket(market: string): Promise<MarketPrice[]> {
    return this.prices.filter(p => p.market.toLowerCase() === market.toLowerCase());
  }

  async requestPriceUpdate(request: PriceUpdateRequest): Promise<void> {
    try {
      const message = `PRICE_UPDATE ${request.crop} ${request.market} ${request.price} ${request.unit}`;
      await smsService.sendSMS(message);
    } catch (error) {
      console.error('Error requesting price update:', error);
      throw error;
    }
  }

  async handleSMSPriceUpdate(message: string): Promise<void> {
    try {
      const [command, crop, market, price, unit] = message.split(' ');
      
      if (command !== 'PRICE_UPDATE') {
        return;
      }

      const newPrice: MarketPrice = {
        id: Date.now().toString(),
        crop,
        price: parseFloat(price),
        unit,
        market,
        timestamp: Date.now(),
        source: 'sms',
        confidence: 0.85
      };

      this.prices = [...this.prices, newPrice];
      await this.savePrices();
    } catch (error) {
      console.error('Error handling SMS price update:', error);
    }
  }

  async getTrendingCrops(): Promise<string[]> {
    const cropCounts: Record<string, number> = {};
    
    for (const price of this.prices) {
      cropCounts[price.crop] = (cropCounts[price.crop] || 0) + 1;
    }

    return Object.entries(cropCounts)
      .sort(([, a], [, b]) => b - a)
      .map(([crop]) => crop)
      .slice(0, 5);
  }

  async getMarketAnalysis(crop: string): Promise<any> {
    const prices = this.prices.filter(p => p.crop === crop);
    
    if (prices.length === 0) {
      return null;
    }

    const latestPrices = prices.sort((a, b) => b.timestamp - a.timestamp).slice(0, 7);
    const priceChanges = latestPrices.map((p, i, arr) => {
      if (i === arr.length - 1) return 0;
      return ((p.price - arr[i + 1].price) / arr[i + 1].price) * 100;
    });

    return {
      currentPrice: latestPrices[0].price,
      priceTrend: priceChanges.reduce((sum, change) => sum + change, 0) / priceChanges.length,
      highestPrice: Math.max(...latestPrices.map(p => p.price)),
      lowestPrice: Math.min(...latestPrices.map(p => p.price)),
      marketDistribution: prices.reduce((acc, p) => {
        acc[p.market] = (acc[p.market] || 0) + 1;
        return acc;
      }, {} as Record<string, number>)
    };
  }
}

export const marketPricesService = MarketPricesService.getInstance();
