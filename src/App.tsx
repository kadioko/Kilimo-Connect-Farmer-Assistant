import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import HomeScreen from './screens/HomeScreen';
import WeatherScreen from './screens/WeatherScreen';
import PestIdentificationScreen from './screens/PestIdentificationScreen';
import MarketPricesScreen from './screens/MarketPricesScreen';
import QAScreen from './screens/QAScreen';

const Stack = createNativeStackNavigator();

const App = () => {
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
};

export default App;
