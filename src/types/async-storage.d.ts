import AsyncStorage from '@react-native-async-storage/async-storage';

declare module '@react-native-async-storage/async-storage' {
  declare module 'react-native' {
    export interface AsyncStorage {
      getItem(key: string): Promise<string | null>;
      setItem(key: string, value: string): Promise<void>;
      removeItem(key: string): Promise<void>;
      clear(): Promise<void>;
      getAllKeys(): Promise<string[]>;
      multiGet(keys: string[]): Promise<[string, string | null][]>;
      multiSet(keyValuePairs: [string, string][]): Promise<void>;
      multiRemove(keys: string[]): Promise<void>;
      multiMerge(keyValuePairs: [string, string][]): Promise<void>;
    }
    export const AsyncStorage: AsyncStorage;
  }
}
