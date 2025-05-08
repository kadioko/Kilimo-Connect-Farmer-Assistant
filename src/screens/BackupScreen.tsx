import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, FlatList, Switch } from 'react-native';
import { backupService } from '../services/backupService';
import { cloudSyncService } from '../services/cloudSyncService';
import { versionControlService } from '../services/versionControlService';
import { BackupHistoryItem, BackupMetrics, BackupData } from '../services/backupService';
import { BackupSchedule } from '../services/backupSchedulerService';
import { backupSchedulerService, backupValidationService } from '../services';
import { BackupValidationResult } from '../services/backupValidationService';

export const BackupScreen = () => {
  const [backupExists, setBackupExists] = useState(false);
  const [lastBackupTime, setLastBackupTime] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<'pending' | 'synced' | 'failed' | null>(null);
  const [versionHistory, setVersionHistory] = useState<string[]>([]);
  const [schedule, setSchedule] = useState<BackupSchedule | null>(null);
  const [validationStatus, setValidationStatus] = useState<'pending' | 'valid' | 'invalid' | null>(null);
  const [backupHistory, setBackupHistory] = useState<BackupHistoryItem[]>([]);
  const [backupMetrics, setBackupMetrics] = useState<BackupMetrics | null>(null);
  const [validationResult, setValidationResult] = useState<BackupValidationResult | null>(null);

  useEffect(() => {
    checkBackupStatus();
    checkSyncStatus();
    checkVersionHistory();
    checkSchedule();
    checkBackupHistory();
    checkBackupMetrics();
    checkBackupValidation();
    
    // Check backup status periodically
    const interval = setInterval(() => {
      checkBackupStatus();
      checkSyncStatus();
      checkVersionHistory();
      checkSchedule();
      checkBackupHistory();
      checkBackupMetrics();
      checkBackupValidation();
    }, 60000); // Check every minute

    return () => clearInterval(interval);
  }, []);

  const checkBackupStatus = async () => {
    try {
      const backup = await backupService.getBackup();
      setBackupExists(!!backup);
      if (backup) {
        const date = new Date(backup.timestamp);
        setLastBackupTime(
          date.toLocaleDateString() + ' ' + date.toLocaleTimeString()
        );
      } else {
        setLastBackupTime(null);
      }
    } catch (error) {
      console.error('Error checking backup status:', error);
    }
  };

  const checkBackupValidation = async () => {
    try {
      const result = await backupValidationService.validateBackup();
      setValidationResult(result);
      setValidationStatus(result.isValid ? 'valid' : 'invalid');
    } catch (error) {
      console.error('Error checking backup validation:', error);
      setValidationResult(null);
      setValidationStatus('invalid');
    }
  };

  const checkBackupHistory = async () => {
    try {
      const history = await backupService.getBackupHistory();
      setBackupHistory(history);
    } catch (error) {
      console.error('Error checking backup history:', error);
    }
  };

  const checkBackupMetrics = async () => {
    try {
      const metrics = await backupService.getBackupMetrics();
      setBackupMetrics(metrics);
    } catch (error) {
      console.error('Error checking backup metrics:', error);
    }
  };

  const checkSyncStatus = async () => {
    try {
      const syncData = await cloudSyncService.getSyncData();
      setSyncStatus(syncData?.syncStatus || null);
    } catch (error) {
      console.error('Error checking sync status:', error);
      setSyncStatus(null);
    }
  };

  const checkVersionHistory = async () => {
    try {
      const history = await versionControlService.getVersionHistory();
      setVersionHistory(history);
    } catch (error) {
      console.error('Error checking version history:', error);
      setVersionHistory([]);
    }
  };

  const checkSchedule = async () => {
    try {
      const schedule = await backupSchedulerService.getSchedule();
      setSchedule(schedule);
      setValidationStatus(schedule?.validationStatus || null);
    } catch (error) {
      console.error('Error checking schedule:', error);
      setSchedule(null);
      setValidationStatus(null);
    }
  };

  const createBackup = async () => {
    try {
      await backupService.createBackup();
      // Start cloud sync
      await cloudSyncService.syncWithCloud();
      // Create new version
      await versionControlService.createNewVersion({
        added: [],
        removed: [],
        updated: []
      });
      Alert.alert('Success', 'Backup yameundwa kwa mafanikio!');
      await checkBackupStatus();
      await checkSyncStatus();
      await checkVersionHistory();
      await checkSchedule();
    } catch (error) {
      Alert.alert('Error', 'Imeshindwa kundaa backup.');
    }
  };

  const restoreBackup = async () => {
    Alert.alert(
      'Restore Backup',
      'Je, una haja kurefresha backup? Itaondoa maelezo yote yanayopo sana.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'OK',
          onPress: async () => {
            try {
              // First try to restore from cloud
              try {
                await cloudSyncService.restoreFromCloud();
                Alert.alert('Success', 'Backup yameundwa kwa mafanikio!');
              } catch (error) {
                // If cloud restore fails, try local restore
                await backupService.restoreBackup();
                Alert.alert('Success', 'Backup yameundwa kwa mafanikio!');
              }
              await checkBackupStatus();
              await checkSyncStatus();
              await checkVersionHistory();
              await checkSchedule();
            } catch (error) {
              Alert.alert('Error', 'Imeshindwa kurefresha backup.');
            }
          },
        },
      ]
    );
  };

  const handleScheduleChange = async (type: 'daily' | 'weekly' | 'monthly', value: boolean) => {
    try {
      const currentSchedule = await backupSchedulerService.getSchedule();
      if (!currentSchedule) return;

      await backupSchedulerService.setSchedule({
        ...currentSchedule,
        [type]: value
      });

      Alert.alert('Success', `Mipangilio ya ${type} imeundwa kwa mafanikio!`);
      await checkSchedule();
    } catch (error) {
      Alert.alert('Error', 'Imeshindwa kubadili mipangilio.');
    }
  };

  const handleRevert = async (version: Version) => {
    Alert.alert(
      'Revert Version',
      'Je, una haja kureverta kwenye vershini hii? Itaondoa maelezo yote yanayopo sana.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'OK',
          onPress: async () => {
            try {
              await versionControlService.revertToVersion(version.id);
              Alert.alert('Success', 'Version yameundwa kwa mafanikio!');
              await checkBackupStatus();
              await checkSyncStatus();
              await checkVersionHistory();
            } catch (error) {
              Alert.alert('Error', 'Imeshindwa kureverta vershini.');
            }
          },
        },
      ]
    );
  };

  const deleteBackup = async () => {
    Alert.alert(
      'Delete Backup',
      'Je, una haja kufuta backup? Itaondoa backup yote yanayopo.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'OK',
          onPress: async () => {
            try {
              await backupService.deleteBackup();
              Alert.alert('Success', 'Backup yamefutwa kwa mafanikio!');
              await checkBackupStatus();
            } catch (error) {
              Alert.alert('Error', 'Imeshindwa kufuta backup.');
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Backup na Refresh</Text>

      <View style={styles.infoContainer}>
        <Text style={styles.infoText}>
          Status ya Backup: {backupExists ? 'Imeundwa' : 'Haijaundwa'}
        </Text>
        {lastBackupTime && (
          <Text style={styles.infoText}>
            Muda wa Backup ya Mwisho: {lastBackupTime}
          </Text>
        )}
        {syncStatus && (
          <Text style={[styles.infoText, styles.syncStatus]}>
            Status ya Sync: {syncStatus === 'pending' ? 'Inaunda...' : 
                           syncStatus === 'synced' ? 'Imeundwa' : 
                           'Imeshindwa'}
          </Text>
        )}
        {validationStatus && (
          <Text style={[styles.infoText, styles.validationStatus]}>
            Status ya Validasi: {validationStatus === 'pending' ? 'Inaunda...' : 
                              validationStatus === 'valid' ? 'Imeundwa' : 
                              'Imeshindwa'}
          </Text>
        )}
      </View>

      <View style={styles.validationContainer}>
        <Text style={styles.validationTitle}>Backup Validation</Text>
        {validationResult && (
          <>
            <View style={styles.validationRow}>
              <Text style={styles.validationLabel}>Status:</Text>
              <Text style={[
                styles.validationValue,
                validationResult.isValid ? styles.validationSuccess : styles.validationError
              ]}>
                {validationResult.isValid ? '✓ Valid' : '✗ Invalid'}
              </Text>
            </View>
            
            <View style={styles.validationRow}>
              <Text style={styles.validationLabel}>Data Integrity:</Text>
              <View style={styles.integrityContainer}>
                <View style={styles.integrityItem}>
                  <Text style={styles.integrityLabel}>Favorites:</Text>
                  <Text style={[
                    styles.integrityValue,
                    validationResult.dataIntegrity.favorites ? styles.integritySuccess : styles.integrityError
                  ]}>
                    {validationResult.dataIntegrity.favorites ? '✓' : '✗'}
                  </Text>
                </View>
                <View style={styles.integrityItem}>
                  <Text style={styles.integrityLabel}>Pests:</Text>
                  <Text style={[
                    styles.integrityValue,
                    validationResult.dataIntegrity.pests ? styles.integritySuccess : styles.integrityError
                  ]}>
                    {validationResult.dataIntegrity.pests ? '✓' : '✗'}
                  </Text>
                </View>
                <View style={styles.integrityItem}>
                  <Text style={styles.integrityLabel}>Version:</Text>
                  <Text style={[
                    styles.integrityValue,
                    validationResult.dataIntegrity.version ? styles.integritySuccess : styles.integrityError
                  ]}>
                    {validationResult.dataIntegrity.version ? '✓' : '✗'}
                  </Text>
                </View>
              </View>
            </View>

            {validationResult.errors.length > 0 && (
              <View style={styles.validationErrors}>
                <Text style={styles.errorTitle}>Errors:</Text>
                {validationResult.errors.map((error, index) => (
                  <Text key={index} style={styles.errorText}>• {error}</Text>
                ))}
              </View>
            )}

            {validationResult.warnings.length > 0 && (
              <View style={styles.validationWarnings}>
                <Text style={styles.warningTitle}>Warnings:</Text>
                {validationResult.warnings.map((warning, index) => (
                  <Text key={index} style={styles.warningText}>• {warning}</Text>
                ))}
              </View>
            )}

            <View style={styles.performanceContainer}>
              <Text style={styles.performanceTitle}>Performance:</Text>
              <View style={styles.performanceRow}>
                <Text style={styles.performanceLabel}>Load Time:</Text>
                <Text style={styles.performanceValue}>{validationResult.performance.loadTime}ms</Text>
              </View>
              <View style={styles.performanceRow}>
                <Text style={styles.performanceLabel}>Size:</Text>
                <Text style={styles.performanceValue}>
                  {Math.round(validationResult.performance.size / 1024)}KB
                </Text>
              </View>
            </View>
          </>
        )}
      </View>

      {/* Backup Schedule Settings */}
      <Text style={styles.scheduleTitle}>Mipangilio ya Backup</Text>
      <View style={styles.scheduleContainer}>
        <View style={styles.scheduleItem}>
          <Text style={styles.scheduleLabel}>Backup ya Kila Siku</Text>
          <Switch
            value={schedule?.daily || false}
            onValueChange={(value) => handleScheduleChange('daily', value)}
          />
        </View>
        <View style={styles.scheduleItem}>
          <Text style={styles.scheduleLabel}>Backup ya Kila Wiki</Text>
          <Switch
            value={schedule?.weekly || false}
            onValueChange={(value) => handleScheduleChange('weekly', value)}
          />
        </View>
        <View style={styles.scheduleItem}>
          <Text style={styles.scheduleLabel}>Backup ya Kila Mwezi</Text>
          <Switch
            value={schedule?.monthly || false}
            onValueChange={(value) => handleScheduleChange('monthly', value)}
          />
        </View>
      </View>

      {/* Version History */}
      <Text style={styles.versionTitle}>Historia ya Vershini</Text>
      <FlatList
        data={versionHistory}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.versionItem}>
            <Text style={styles.versionTimestamp}>
              {new Date(item.timestamp).toLocaleString()}
            </Text>
            <Text style={styles.versionSource}>
              Source: {item.metadata.source}
            </Text>
            <Text style={styles.versionChanges}>
              Changes:
              {item.changes.added.length > 0 && ` Added: ${item.changes.added.length}`}
              {item.changes.removed.length > 0 && ` Removed: ${item.changes.removed.length}`}
              {item.changes.updated.length > 0 && ` Updated: ${item.changes.updated.length}`}
            </Text>
            <TouchableOpacity
              style={styles.revertButton}
              onPress={() => handleRevert(item)}
            >
              <Text style={styles.buttonText}>Revert</Text>
            </TouchableOpacity>
          </View>
        )}
      />

      <TouchableOpacity
        style={styles.button}
        onPress={createBackup}
      >
        <Text style={styles.buttonText}>Unda Backup</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.button, styles.cloudSyncButton]}
        onPress={async () => {
          try {
            await cloudSyncService.syncWithCloud();
            Alert.alert('Success', 'Sync imeundwa kwa mafanikio!');
            await checkSyncStatus();
          } catch (error) {
            Alert.alert('Error', 'Imeshindwa kusync.');
          }
        }}
      >
        <Text style={styles.buttonText}>Sync na Cloud</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.button, styles.deleteButton]}
        onPress={deleteBackup}
        disabled={!backupExists}
      >
        <Text style={styles.buttonText}>Futa Backup</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.button, styles.restoreButton]}
        onPress={restoreBackup}
        disabled={!backupExists}
      >
        <Text style={styles.buttonText}>Refresh Backup</Text>
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
    color: '#333',
    marginBottom: 20,
  },
  infoContainer: {
    backgroundColor: '#f5f5f5',
    padding: 15,
    borderRadius: 8,
    marginBottom: 20,
  },
  infoText: {
    fontSize: 16,
    color: '#666',
    marginBottom: 5,
  },
  button: {
    backgroundColor: '#4CAF50',
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
  },
  deleteButton: {
    backgroundColor: '#f44336',
  },
  restoreButton: {
    backgroundColor: '#2196F3',
  },
  cloudSyncButton: {
    backgroundColor: '#9C27B0',
  },
  syncStatus: {
    color: (syncStatus === 'pending' ? '#FF9800' : 
           syncStatus === 'synced' ? '#4CAF50' : 
           '#f44336'),
  },
  validationStatus: {
    color: (validationStatus === 'pending' ? '#FF9800' : 
           validationStatus === 'valid' ? '#4CAF50' : 
           '#f44336'),
  },
  scheduleTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 20,
    marginBottom: 10,
  },
  scheduleContainer: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  scheduleItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  scheduleLabel: {
    fontSize: 16,
    color: '#333',
  },
  versionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 20,
    marginBottom: 10,
  },
  versionItem: {
    backgroundColor: '#f5f5f5',
    padding: 15,
    marginVertical: 5,
    borderRadius: 8,
  },
  versionTimestamp: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
  versionSource: {
    fontSize: 12,
    color: '#4CAF50',
    marginBottom: 5,
  },
  versionChanges: {
    fontSize: 12,
    color: '#666',
    marginBottom: 10,
  },
  revertButton: {
    backgroundColor: '#FF9800',
    padding: 5,
    borderRadius: 5,
    alignSelf: 'flex-end',
  },
  buttonText: {
    color: '#fff',
    textAlign: 'center',
    fontSize: 16,
    fontWeight: 'bold',
  },
  validationContainer: {
    marginTop: 20,
  },
  validationTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  validationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  validationLabel: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  validationValue: {
    fontSize: 16,
  },
  validationSuccess: {
    color: '#4CAF50',
  },
  validationError: {
    color: '#F44336',
  },
  validationPending: {
    color: '#2196F3',
  },
  integrityContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  integrityItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  integrityLabel: {
    fontSize: 14,
    marginRight: 5,
  },
  integrityValue: {
    fontSize: 14,
  },
  integritySuccess: {
    color: '#4CAF50',
  },
  integrityError: {
    color: '#F44336',
  },
  validationErrors: {
    marginTop: 10,
    backgroundColor: '#ffebee',
    padding: 10,
    borderRadius: 4,
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  errorText: {
    fontSize: 14,
    color: '#F44336',
  },
  validationWarnings: {
    marginTop: 10,
    backgroundColor: '#fff3e0',
    padding: 10,
    borderRadius: 4,
  },
  warningTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  warningText: {
    fontSize: 14,
    color: '#F57C00',
  },
  performanceContainer: {
    marginTop: 20,
  },
  performanceTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  performanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 5,
  },
  performanceLabel: {
    fontSize: 14,
  },
  performanceValue: {
    fontSize: 14,
    fontWeight: 'bold',
  },
});

export default BackupScreen;
