import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';

const HomeScreen = () => {
  const navigation = useNavigation();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Kilimo Connect</Text>
      
      <TouchableOpacity 
        style={styles.button}
        onPress={() => navigation.navigate('Weather')}
      >
        <Text style={styles.buttonText}>Matoa</Text>
      </TouchableOpacity>

      <TouchableOpacity 
        style={styles.button}
        onPress={() => navigation.navigate('PestIdentification')}
      >
        <Text style={styles.buttonText}>Ukurasa wa Mipaka</Text>
      </TouchableOpacity>

      <TouchableOpacity 
        style={styles.button}
        onPress={() => navigation.navigate('MarketPrices')}
      >
        <Text style={styles.buttonText}>Bei ya Mifugo</Text>
      </TouchableOpacity>

      <TouchableOpacity 
        style={styles.button}
        onPress={() => navigation.navigate('QA')}
      >
        <Text style={styles.buttonText}>Maelezo</Text>
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
    marginVertical: 20,
  },
  button: {
    backgroundColor: '#4CAF50',
    padding: 15,
    borderRadius: 8,
    marginVertical: 10,
  },
  buttonText: {
    color: '#fff',
    textAlign: 'center',
    fontSize: 16,
  },
});

export default HomeScreen;
