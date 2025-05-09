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

export interface WeatherForecast {
  city: {
    name: string;
    country: string;
    timezone: number;
  };
  list: Array<{
    dt: number;
    main: {
      temp: number;
      temp_min: number;
      temp_max: number;
      humidity: number;
      pressure: number;
    };
    weather: Array<{
      description: string;
      icon: string;
      main: string;
    }>;
    wind: {
      speed: number;
      deg: number;
    };
    clouds: {
      all: number;
    };
    rain?: {
      '3h': number;
    };
    snow?: {
      '3h': number;
    };
    pop: number;
  }>;
}

export interface WeatherAlert {
  id: string;
  sender_name: string;
  event: string;
  start: number;
  end: number;
  description: string;
  tags: string[];
  areas: string[];
}

export interface CachedWeather {
  data: WeatherData;
  timestamp: number;
}

export interface CachedForecast {
  data: WeatherForecast;
  timestamp: number;
}
