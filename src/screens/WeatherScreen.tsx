import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, Alert, FlatList, Modal, ScrollView, Image } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { weatherService } from '../services/weatherService';
import { locationsService } from '../services/locationsService';
import { WeatherData, WeatherForecast, WeatherAlert } from '../types/weather';

const WeatherScreen = () => {
  const [showFavoritesModal, setShowFavoritesModal] = useState(false);
  const [favoriteLocations, setFavoriteLocations] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [weatherData, setWeatherData] = useState<WeatherData | null>(null);
  const [forecastData, setForecastData] = useState<WeatherForecast | null>(null);
  const [alerts, setAlerts] = useState<WeatherAlert[]>([]);
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
      // Fetch current weather
      const currentWeather = await weatherService.fetchWeather(searchQuery);
      setWeatherData(currentWeather);

      // Fetch forecast
      const forecast = await weatherService.fetchForecast(searchQuery);
      setForecastData(forecast);

      // Fetch alerts
      const alerts = await weatherService.getWeatherAlerts();
      setAlerts(alerts);

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

      {weatherData && (
        <ScrollView style={styles.weatherContainer}>
          {/* Current Weather */}
          <View style={styles.currentWeatherContainer}>
            <Text style={styles.cityName}>{weatherData.name}</Text>
            <View style={styles.currentWeatherInfo}>
              <Image
                source={{ uri: getWeatherIcon(weatherData.weather[0].icon) }}
                style={styles.weatherIcon}
              />
              <Text style={styles.temperature}>
                {Math.round(weatherData.main.temp)}°C
              </Text>
              <Text style={styles.weatherDescription}>
                {weatherData.weather[0].description}
              </Text>
            </View>
            <View style={styles.weatherDetails}>
              <Text style={styles.detailLabel}>Ukame:</Text>
              <Text style={styles.detailValue}>{weatherData.main.humidity}%</Text>
              <Text style={styles.detailLabel}>Mafaa:</Text>
              <Text style={styles.detailValue}>{weatherData.main.pressure} hPa</Text>
              <Text style={styles.detailLabel}>Mvua:</Text>
              <Text style={styles.detailValue}>{weatherData.rain?.['1h'] || 0} mm</Text>
              <Text style={styles.detailLabel}>Uvumbuzi:</Text>
              <Text style={styles.detailValue}>{weatherData.wind.speed} m/s</Text>
            </View>
          </View>

          {/* Weather Alerts */}
          {alerts.length > 0 && (
            <View style={styles.alertsContainer}>
              <Text style={styles.alertsTitle}>Huduma za Matoa</Text>
              {alerts.map((alert) => (
                <View key={alert.id} style={styles.alertItem}>
                  <Text style={styles.alertEvent}>{alert.event}</Text>
                  <Text style={styles.alertDescription}>{alert.description}</Text>
                  <Text style={styles.alertTime}>
                    {new Date(alert.start * 1000).toLocaleString()} -
                    {new Date(alert.end * 1000).toLocaleString()}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {/* Weather Forecast */}
          <View style={styles.forecastContainer}>
            <Text style={styles.forecastTitle}>Matoa ya Maisha</Text>
            <FlatList
              data={forecastData?.list || []}
              horizontal
              showsHorizontalScrollIndicator={false}
              keyExtractor={(item) => item.dt.toString()}
              renderItem={({ item }) => (
                <View style={styles.forecastItem}>
                  <Text style={styles.forecastTime}>
                    {new Date(item.dt * 1000).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </Text>
                  <Image
                    source={{ uri: getWeatherIcon(item.weather[0].icon) }}
                    style={styles.forecastIcon}
                  />
                  <Text style={styles.forecastTemp}>
                    {Math.round(item.main.temp)}°C
                  </Text>
                  <Text style={styles.forecastDescription}>
                    {item.weather[0].description}
                  </Text>
                  <Text style={styles.forecastRain}>
                    {item.rain?.['3h'] || 0} mm
                  </Text>
                </View>
              )}
            />
          </View>
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  weatherContainer: {
    flex: 1,
    padding: 20,
  },
  currentWeatherContainer: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 20,
    marginVertical: 10,
    elevation: 2,
  },
  cityName: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  currentWeatherInfo: {
    alignItems: 'center',
    marginBottom: 20,
  },
  weatherIcon: {
    width: 100,
    height: 100,
    marginBottom: 10,
  },
  temperature: {
    fontSize: 48,
    fontWeight: 'bold',
  },
  weatherDescription: {
    fontSize: 16,
    color: '#666',
  },
  weatherDetails: {
    marginTop: 20,
  },
  detailLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
  detailValue: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  alertsContainer: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 20,
    marginVertical: 10,
    elevation: 2,
  },
  alertsTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  alertItem: {
    backgroundColor: '#ffebee',
    padding: 15,
    borderRadius: 5,
    marginBottom: 10,
  },
  alertEvent: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#c62828',
  },
  alertDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
  alertTime: {
    fontSize: 14,
    color: '#666',
  },
  forecastContainer: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 20,
    marginVertical: 10,
    elevation: 2,
  },
  forecastTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  forecastItem: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 5,
    marginHorizontal: 10,
    elevation: 1,
  },
  forecastTime: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
  forecastIcon: {
    width: 50,
    height: 50,
    marginBottom: 5,
  },
  forecastTemp: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  forecastDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
  forecastRain: {
    fontSize: 14,
    color: '#666',
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
