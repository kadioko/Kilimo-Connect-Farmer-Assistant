import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Alert, FlatList } from 'react-native';
import { Camera, CameraType } from 'expo-camera';
import * as tf from '@tensorflow/tfjs-react-native';
import { useNavigation } from '@react-navigation/native';
import { pestCacheService } from '../services/pestCacheService';
import { pestDetectionService } from '../services/pestDetectionService';
import { favoritesService } from '../services/favoritesService';
import { pestDatabase } from '../data/pestDatabase';

interface Pest {
  name: string;
  confidence: number;
  treatment: string;
  prevention: string;
  symptoms: string;
  crop: string;
}

interface Pest {
  name: string;
  confidence: number;
  treatment: string;
  prevention: string;
  symptoms: string;
  crop: string;
}

const PestIdentificationScreen = () => {
  const [permission, requestPermission] = Camera.useCameraPermissions();
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [detectedPest, setDetectedPest] = useState<Pest | null>(null);
  const [pestHistory, setPestHistory] = useState<Pest[]>([]);
  const [favoritePests, setFavoritePests] = useState<Pest[]>([]);
  const cameraRef = useRef<Camera>(null);
  const navigation = useNavigation();

  const PESTS = [
    {
      name: 'Mipaka ya Mavuno',
      confidence: 0.95,
      treatment: 'Tumia mafuta ya kisafu au mafuta ya kisafu ya kisasa. Ongeza maji kwa kisafu na uchumi wa kisafu kwa mafuta ya kisafu ya kisasa.'
    },
    {
      name: 'Mipaka ya Mipaka',
      confidence: 0.85,
      treatment: 'Tumia mafuta ya kisafu au mafuta ya kisafu ya kisasa. Ongeza maji kwa kisafu na uchumi wa kisafu kwa mafuta ya kisafu ya kisasa.'
    },
    {
      name: 'Mipaka ya Mipaka',
      confidence: 0.85,
      treatment: 'Tumia mafuta ya kisafu au mafuta ya kisafu ya kisasa. Ongeza maji kwa kisafu na uchumi wa kisafu kwa mafuta ya kisafu ya kisasa.'
    },
  ];

  const takePicture = async () => {
    if (!cameraRef.current) return;

    try {
      setIsProcessing(true);
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.5 });
      
      // Simulate pest detection
      const detectedPest = await pestDetectionService.detectPest(photo.uri);
      
      // Save to history
      const newHistory = [detectedPest, ...pestHistory].slice(0, 10); // Keep last 10 detections
      setPestHistory(newHistory);
      setDetectedPest(detectedPest);
      
      // Save to cache
      await pestCacheService.savePest(detectedPest);
      
      // Check if pest is already a favorite
      const isFavorite = await favoritesService.isFavorite(detectedPest.name);
      if (!isFavorite) {
        // Add to favorites
        await favoritesService.addFavorite(detectedPest.name);
        // Update favorite pests list
        const updatedFavorites = await favoritesService.getFavorites();
        const favoritePests = updatedFavorites.map(f => pestDatabase[f.name]);
        setFavoritePests(favoritePests);
      }
      
      setIsProcessing(false);
    } catch (error) {
      Alert.alert('Error', 'Imeshindwa kuchukua picha. Tafadhali jaribu tena.');
      setIsProcessing(false);
    }
  };

  const renderPestInfo = () => {
    if (!detectedPest) return null;

    return (
      <View style={styles.pestInfoContainer}>
        <Text style={styles.pestTitle}>Pesi Imetambuliwa:</Text>
        <Text style={styles.pestName}>{detectedPest.name}</Text>
        <Text style={styles.pestConfidence}>
          Uaminifu: {Math.round(detectedPest.confidence * 100)}%
        </Text>
        <Text style={styles.pestCropTitle}>Mazao:</Text>
        <Text style={styles.pestCrop}>{detectedPest.crop}</Text>

        <Text style={styles.pestSymptomsTitle}>Alama za pesi:</Text>
        <Text style={styles.pestSymptoms}>{detectedPest.symptoms}</Text>

        <Text style={styles.pestTreatmentTitle}>Usafiri:</Text>
        <Text style={styles.pestTreatment}>{detectedPest.treatment}</Text>

        <Text style={styles.pestPreventionTitle}>Unganisho:</Text>
        <Text style={styles.pestPrevention}>{detectedPest.prevention}</Text>
        <TouchableOpacity 
          style={styles.retryButton}
          onPress={() => setDetectedPest(null)}
        >
          <Text style={styles.retryButtonText}>Jaribu tena</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const handleFavorite = async (pest: Pest) => {
    try {
      // Add to favorites
      await favoritesService.addFavorite(pest.name);
      // Update favorite pests list
      const updatedFavorites = await favoritesService.getFavorites();
      const favoritePests = updatedFavorites.map(f => pestDatabase[f.name]);
      setFavoritePests(favoritePests);
    } catch (error) {
      console.error('Error handling favorite:', error);
      Alert.alert('Error', 'Imeshindwa kuchukua pesi kwenye pesi za kupenda.');
    }
  };

  if (!permission) return null;

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.permissionText}>
          Tafadhali ondoa uhusiano wa kamera kwa mfumo wa kamera.
        </Text>
        <TouchableOpacity 
          style={styles.permissionButton}
          onPress={requestPermission}
        >
          <Text style={styles.permissionButtonText}>Ondoa Uhusiano</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Camera 
        ref={cameraRef}
        style={styles.camera}
        type={CameraType.back}
        onCameraReady={() => setIsCameraReady(true)}
      >
        <View style={styles.overlay}>
          <Text style={styles.title}>Ukurasa wa Mipaka</Text>
          
          {isProcessing ? (
            <View style={styles.processingContainer}>
              <Text style={styles.processingText}>Inachukua picha...</Text>
            </View>
          ) : (
            <TouchableOpacity 
              style={styles.captureButton}
              onPress={takePicture}
              disabled={!isCameraReady}
            >
              <Text style={styles.captureButtonText}>Piga picha</Text>
            </TouchableOpacity>
          )}
        </View>
      </Camera>

      {renderPestInfo()}

      {/* Pest History */}
      <Text style={styles.historyTitle}>Historia ya Pesi</Text>
      <FlatList
        data={pestHistory}
        keyExtractor={(item) => item.name}
        renderItem={({ item }) => (
          <View style={styles.historyItem}>
            <Text style={styles.historyName}>{item.name}</Text>
            <Text style={styles.historyCrop}>{item.crop}</Text>
            <Text style={styles.historyConfidence}>
              Uaminifu: {Math.round(item.confidence * 100)}%
            </Text>
          </View>
        )}
      />

      {/* Favorite Pests */}
      <Text style={styles.favoritesTitle}>Pesi za Kupenda</Text>
      <FlatList
        data={favoritePests}
        keyExtractor={(item) => item.name}
        renderItem={({ item }) => (
          <View style={styles.favoriteItem}>
            <Text style={styles.favoriteName}>{item.name}</Text>
            <Text style={styles.favoriteCrop}>{item.crop}</Text>
            <TouchableOpacity
              style={styles.favoriteButton}
              onPress={() => handleFavorite(item)}
            >
              <Text style={styles.favoriteButtonText}>Kupenda</Text>
            </TouchableOpacity>
          </View>
        )}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  camera: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'transparent',
    justifyContent: 'flex-end',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 20,
  },
  captureButton: {
    backgroundColor: '#4CAF50',
    padding: 20,
    borderRadius: 50,
    alignItems: 'center',
    marginBottom: 20,
  },
  captureButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  processingContainer: {
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: 20,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 20,
  },
  processingText: {
    color: '#fff',
    fontSize: 16,
  },
  pestInfoContainer: {
    backgroundColor: '#fff',
    padding: 20,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  pestTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  pestName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#4CAF50',
    marginBottom: 10,
  },
  pestConfidence: {
    fontSize: 16,
    color: '#666',
    marginBottom: 15,
  },
  pestCropTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  pestCrop: {
    fontSize: 14,
    color: '#4CAF50',
    marginBottom: 15,
  },
  pestSymptomsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  pestSymptoms: {
    fontSize: 14,
    color: '#666',
    marginBottom: 15,
  },
  pestTreatmentTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  pestTreatment: {
    fontSize: 14,
    color: '#666',
    marginBottom: 15,
  },
  pestPreventionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  pestPrevention: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
  },
  historyTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4CAF50',
    marginBottom: 10,
    marginLeft: 10,
  },
  historyItem: {
    backgroundColor: '#fff',
    padding: 10,
    marginHorizontal: 10,
    marginVertical: 5,
    borderRadius: 5,
    elevation: 2,
  },
  historyName: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  historyCrop: {
    fontSize: 12,
    color: '#666',
    marginBottom: 5,
  },
  historyConfidence: {
    fontSize: 12,
    color: '#4CAF50',
  },
  favoritesTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FF9800',
    marginBottom: 10,
    marginLeft: 10,
  },
  favoriteItem: {
    backgroundColor: '#fff',
    padding: 10,
    marginHorizontal: 10,
    marginVertical: 5,
    borderRadius: 5,
    elevation: 2,
    flexDirection: 'row',
    alignItems: 'center',
  },
  favoriteName: {
    fontSize: 14,
    fontWeight: 'bold',
    flex: 1,
  },
  favoriteCrop: {
    fontSize: 12,
    color: '#666',
    flex: 1,
  },
  favoriteButton: {
    backgroundColor: '#FF9800',
    padding: 5,
    borderRadius: 5,
  },
  favoriteButtonText: {
    color: '#fff',
    fontSize: 12,
  },
  retryButton: {
    backgroundColor: '#4CAF50',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
  },
  permissionText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
  },
  permissionButton: {
    backgroundColor: '#4CAF50',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  permissionButtonText: {
    color: '#fff',
    fontSize: 16,
  },
});

export default PestIdentificationScreen;
