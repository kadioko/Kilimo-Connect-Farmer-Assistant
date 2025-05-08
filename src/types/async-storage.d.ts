import AsyncStorage from '@react-native-async-storage/async-storage';

declare module '@react-native-async-storage/async-storage' {
  export default AsyncStorage;

  interface AsyncStorage {
    getItem(key: string): Promise<string | null>;
    setItem(key: string, value: string): Promise<void>;
    removeItem(key: string): Promise<void>;
    clear(): Promise<void>;
    getAllKeys(): Promise<string[]>;
    multiGet(keys: string[]): Promise<[string, string | null][]>;
    multiSet(keyValuePairs: [string, string][]): Promise<void>;
    multiRemove(keys: string[]): Promise<void>;
    mergeItem(key: string, value: string): Promise<void>;
  }
}
