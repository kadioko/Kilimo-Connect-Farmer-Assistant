import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

// Import screens (we'll create these later)
import HomeScreen from './src/screens/HomeScreen';
import WeatherScreen from './src/screens/WeatherScreen';
import PestIdentificationScreen from './src/screens/PestIdentificationScreen';
import MarketPricesScreen from './src/screens/MarketPricesScreen';
import QAScreen from './src/screens/QAScreen';

const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Home">
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="Weather" component={WeatherScreen} />
        <Stack.Screen name="PestIdentification" component={PestIdentificationScreen} />
        <Stack.Screen name="MarketPrices" component={MarketPricesScreen} />
        <Stack.Screen name="QA" component={QAScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
