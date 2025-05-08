export interface WeatherData {
  main: {
    temp: number;
    humidity: number;
    pressure: number;
    temp_min: number;
    temp_max: number;
    feels_like: number;
  };
  weather: Array<{
    description: string;
    icon: string;
    main: string;
  }>;
  name: string;
  wind: {
    speed: number;
    deg: number;
    gust: number;
  };
  sys: {
    sunrise: number;
    sunset: number;
    country: string;
  };
  visibility: number;
  clouds: {
    all: number;
  };
  dt: number;
  rain?: {
    '1h': number;
  };
  snow?: {
    '1h': number;
  };
  uv?: number;
  pop?: number;
}

export interface CachedWeather {
  data: WeatherData;
  timestamp: number;
}
