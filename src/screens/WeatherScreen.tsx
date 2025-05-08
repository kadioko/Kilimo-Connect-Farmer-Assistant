import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, Alert, FlatList, Modal } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { weatherService } from '../../services/weatherService';
import { locationsService } from '../../services/locationsService';

interface WeatherData {
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

const WeatherScreen = () => {
  const [showFavoritesModal, setShowFavoritesModal] = useState(false);
  const [favoriteLocations, setFavoriteLocations] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [weatherData, setWeatherData] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(false);
  const [offline, setOffline] = useState(false);
  const [error, setError] = useState('');
  const navigation = useNavigation();

  const API_KEY = 'YOUR_API_KEY'; // You'll need to replace this with your actual API key

  const fetchWeather = async () => {
    if (!searchQuery.trim()) {
      setError('Tafadhali andaa jina la mkoa kwanza');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const data = await weatherService.fetchWeather(searchQuery);
      setWeatherData(data);
      setOffline(false);
    } catch (err) {
      if (err.message === 'Network request failed') {
        setError('Hakuna kujumbe. Tafadhali jaribu tena baada ya kujihusisha na mtandao.');
        setOffline(true);
      } else if (err.message === 'Failed to fetch weather data') {
        setError('Hakuna data ya matoa. Tafadhali jaribu tena.');
      } else {
        setError('Imeshindwa kuchukua data ya matoa. Tafadhali jaribu tena.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Fetch weather for Dar es Salaam by default
    setSearchQuery('Dar es Salaam');
    fetchWeather();

    // Load favorite locations
    const loadFavorites = async () => {
      const favorites = await locationsService.getFavoriteLocations();
      setFavoriteLocations(favorites);
    };
    loadFavorites();

    // Clear weather cache when component unmounts
    return () => {
      weatherService.clearWeatherCache();
    };
  }, []);

  const getWeatherIcon = (iconCode: string) => {
    return `https://openweathermap.org/img/wn/${iconCode}@2x.png`;
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Matoa</Text>

      <View style={styles.searchContainer}>
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Tafuta mkoa..."
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          <TouchableOpacity 
            style={styles.favoriteButton}
            onPress={() => setShowFavoritesModal(true)}
          >
            <Text style={styles.favoriteButtonText}>Mkoa wako</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity style={styles.searchButton} onPress={fetchWeather}>
          <Text style={styles.searchButtonText}>Tafuta</Text>
        </TouchableOpacity>
      </View>

      {/* Favorites Modal */}
      <Modal
        visible={showFavoritesModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowFavoritesModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Mkoa wako</Text>
              <TouchableOpacity 
                style={styles.closeButton}
                onPress={() => setShowFavoritesModal(false)}
              >
                <Text style={styles.closeButtonText}>Sema</Text>
              </TouchableOpacity>
            </View>

            <FlatList
              data={favoriteLocations}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.favoriteItem}
                  onPress={() => {
                    setSearchQuery(item);
                    fetchWeather();
                    setShowFavoritesModal(false);
                  }}
                >
                  <Text style={styles.favoriteText}>{item}</Text>
                </TouchableOpacity>
              )}
            />

            <TouchableOpacity
              style={styles.addFavoriteButton}
              onPress={async () => {
                if (searchQuery.trim()) {
                  try {
                    await locationsService.addLocation(searchQuery);
                    const newFavorites = await locationsService.getFavoriteLocations();
                    setFavoriteLocations(newFavorites);
                    Alert.alert('Success', 'Mkoa imejiondokana kwa mkoa wako');
                  } catch (error) {
                    Alert.alert('Error', 'Mkoa hii tayari imejiondokana kwa mkoa wako');
                  }
                } else {
                  Alert.alert('Error', 'Tafadhali andaa jina la mkoa kwanza');
                }
              }}
            >
              <Text style={styles.addFavoriteButtonText}>Ongeza mkoa hapa kwa mkoa wako</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {loading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4CAF50" />
          <Text style={styles.loadingText}>Inachukua data...</Text>
        </View>
      )}

      {offline && (
        <View style={styles.offlineContainer}>
          <Text style={styles.offlineText}>Hakuna kujumbe</Text>
          <Text style={styles.offlineSubtext}>Inatumika data ya zamani</Text>
        </View>
      )}

      {error && (
        <Text style={styles.errorText}>{error}</Text>
      )}

      {weatherData && (
        <View style={styles.weatherContainer}>
          <Text style={styles.cityName}>{weatherData.name}</Text>
          
          <View style={styles.weatherInfo}>
            <Text style={styles.temperature}>
              {Math.round(weatherData.main.temp)}°C
            </Text>
            <Text style={styles.weatherDescription}>
              {weatherData.weather[0].description}
            </Text>
          </View>

          <View style={styles.detailsContainer}>
            <View style={styles.detailRow}>
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>Urefu:</Text>
                <Text style={styles.detailValue}>
                  {weatherData.main.humidity}%
                </Text>
              </View>
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>Bara:</Text>
                <Text style={styles.detailValue}>
                  {weatherData.main.pressure} hPa
                </Text>
              </View>
            </View>
            <View style={styles.detailRow}>
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>Mvua:</Text>
                <Text style={styles.detailValue}>
                  {weatherData.wind.speed} m/s
                </Text>
              </View>
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>Mwanga:</Text>
                <Text style={styles.detailValue}>
                  {new Date(weatherData.sys.sunrise * 1000).toLocaleTimeString()} - {new Date(weatherData.sys.sunset * 1000).toLocaleTimeString()}
                </Text>
              </View>
            </View>
            <View style={styles.detailRow}>
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>Mwaka:</Text>
                <Text style={styles.detailValue}>
                  {new Date(weatherData.dt * 1000).toLocaleDateString()} {new Date(weatherData.dt * 1000).toLocaleTimeString()}
                </Text>
              </View>
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>Mawingu:</Text>
                <Text style={styles.detailValue}>
                  {weatherData.clouds.all}%
                </Text>
              </View>
            </View>
            <View style={styles.detailRow}>
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>Kuona:</Text>
                <Text style={styles.detailValue}>
                  {weatherData.visibility / 1000} km
                </Text>
              </View>
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>Mwaka:</Text>
                <Text style={styles.detailValue}>
                  {new Date(weatherData.dt * 1000).toLocaleDateString()} {new Date(weatherData.dt * 1000).toLocaleTimeString()}
                </Text>
              </View>
            </View>
            <View style={styles.detailRow}>
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>Maji:</Text>
                <Text style={styles.detailValue}>
                  {weatherData.rain?.['1h'] ? `${weatherData.rain['1h']} mm` : 'Hakuna'}
                </Text>
              </View>
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>Kifupi:</Text>
                <Text style={styles.detailValue}>
                  {weatherData.snow?.['1h'] ? `${weatherData.snow['1h']} mm` : 'Hakuna'}
                </Text>
              </View>
            </View>
            <View style={styles.detailRow}>
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>UV:</Text>
                <Text style={styles.detailValue}>
                  {weatherData.uv ? weatherData.uv.toFixed(1) : 'Hakuna'}
                </Text>
              </View>
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>Ugavu:</Text>
                <Text style={styles.detailValue}>
                  {weatherData.pop ? `${(weatherData.pop * 100).toFixed(0)}%` : 'Hakuna'}
                </Text>
              </View>
            </View>
            <View style={styles.detailRow}>
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>Mvua ya Kasi:</Text>
                <Text style={styles.detailValue}>
                  {weatherData.wind.gust ? `${weatherData.wind.gust.toFixed(1)} m/s` : 'Hakuna'}
                </Text>
              </View>
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>Ujuzi:</Text>
                <Text style={styles.detailValue}>
                  {weatherData.main.feels_like.toFixed(1)}°C
                </Text>
              </View>
            </View>
          </View>
        </View>
      )}

      <TouchableOpacity 
        style={styles.backButton}
        onPress={() => navigation.goBack()}
      >
        <Text style={styles.backButtonText}>Rudi nyuma</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
  },
  searchContainer: {
    marginBottom: 20,
  },
  inputContainer: {
    flexDirection: 'row',
    flex: 1,
    marginRight: 10,
  },
  favoriteButton: {
    backgroundColor: '#666',
    padding: 10,
    borderRadius: 8,
    marginLeft: 5,
  },
  favoriteButtonText: {
    color: '#fff',
    fontSize: 12,
  },
  input: {
    flex: 1,
    height: 40,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 10,
    marginRight: 10,
  },
  searchButton: {
    backgroundColor: '#4CAF50',
    padding: 10,
    borderRadius: 8,
  },
  searchButtonText: {
    color: '#fff',
    fontSize: 16,
  },
  loadingContainer: {
    alignItems: 'center',
    marginTop: 20,
  },
  loadingText: {
    marginTop: 10,
    color: '#4CAF50',
    fontSize: 16,
  },
  offlineContainer: {
    backgroundColor: '#FFEB3B',
    padding: 15,
    borderRadius: 8,
    marginTop: 20,
    alignItems: 'center',
  },
  offlineText: {
    color: '#F57C00',
    fontWeight: 'bold',
    fontSize: 16,
  },
  offlineSubtext: {
    color: '#757575',
    fontSize: 14,
    marginTop: 5,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  closeButton: {
    padding: 5,
  },
  closeButtonText: {
    color: '#666',
    fontSize: 16,
  },
  favoriteItem: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  favoriteText: {
    fontSize: 16,
  },
  addFavoriteButton: {
    backgroundColor: '#4CAF50',
    padding: 15,
    borderRadius: 8,
    marginTop: 20,
  },
  addFavoriteButtonText: {
    color: '#fff',
    textAlign: 'center',
    fontSize: 16,
  },
  errorText: {
    color: 'red',
    textAlign: 'center',
    marginTop: 20,
  },
  weatherContainer: {
    alignItems: 'center',
  },
  cityName: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  weatherInfo: {
    alignItems: 'center',
    marginBottom: 20,
  },
  temperature: {
    fontSize: 48,
    fontWeight: 'bold',
  },
  weatherDescription: {
    fontSize: 16,
    color: '#666',
  },
  detailsContainer: {
    width: '100%',
    marginTop: 20,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 15,
    padding: 10,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
  },
  detailItem: {
    flex: 1,
    alignItems: 'center',
  },
  detailLabel: {
    color: '#666',
    marginBottom: 5,
  },
  detailValue: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  backButton: {
    backgroundColor: '#4CAF50',
    padding: 15,
    borderRadius: 8,
    marginTop: 20,
  },
  backButtonText: {
    color: '#fff',
    textAlign: 'center',
    fontSize: 16,
  },
});

export default WeatherScreen;
