import AsyncStorage from "@react-native-async-storage/async-storage";

export const saveSetting = async <T>(key: string, value: T): Promise<void> => {
  await AsyncStorage.setItem(key, JSON.stringify(value));
};

export const getSetting = async <T = unknown>(
  key: string,
): Promise<T | null> => {
  const value = await AsyncStorage.getItem(key);
  return value ? JSON.parse(value) : null;
};
