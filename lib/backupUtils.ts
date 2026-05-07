import AsyncStorage from "@react-native-async-storage/async-storage";
import * as DocumentPicker from "expo-document-picker";
import * as Sharing from "expo-sharing";
import { Platform } from "react-native";
import { zipSync, unzipSync, strToU8, strFromU8 } from "fflate";
import { Buffer } from "buffer";
import dayjs from "dayjs";
import { t, Lang } from "./i18n";

export const exportBackup = async (
  language: Lang,
): Promise<{ success: boolean; error?: string }> => {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const result = await AsyncStorage.multiGet(keys);

    const backupData: Record<string, string | null> = {};
    result.forEach(([key, value]) => {
      backupData[key] = value;
    });

    backupData["__CountYourDarts_Backup"] = JSON.stringify({
      timestamp: dayjs().toISOString(),
      version: "1.0.0",
    });

    const jsonString = JSON.stringify(backupData);
    const timestamp = dayjs().toISOString().replace(/[:.]/g, "-");
    const baseFileName = `CountYourDarts_Backup_${timestamp}`;
    const zipFileName = `${baseFileName}.zip`;

    const zippedData = zipSync({
      [`${baseFileName}.json`]: strToU8(jsonString),
    });

    if (Platform.OS === "web") {
      const blob = new Blob([zippedData as any], { type: "application/zip" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = zipFileName;
      a.click();
      URL.revokeObjectURL(url);
      return { success: true };
    }

    const FS = require("expo-file-system/legacy");
    const dir = FS.documentDirectory || FS.cacheDirectory;
    const fileUri = `${dir}${zipFileName}`;

    const base64Zip = Buffer.from(zippedData).toString("base64");
    await FS.writeAsStringAsync(fileUri, base64Zip, {
      encoding: FS.EncodingType.Base64,
    });

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(fileUri, {
        mimeType: "application/zip",
        dialogTitle: t(language, "backupDialogTitle") || "Export Darts Backup",
      });
      return { success: true };
    }
    return {
      success: false,
      error:
        t(language, "noShareOption") ||
        "No sharing option available on this device.",
    };
  } catch (error) {
    console.error("Backup export error:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : t(language, "unknownExportError") || "Unknown error during export.",
    };
  }
};

export const importBackup = async (
  language: Lang,
): Promise<{ success: boolean; error?: string }> => {
  try {
    const result = await DocumentPicker.getDocumentAsync({
      type: ["application/zip", "*/*"],
      copyToCacheDirectory: true,
    });

    if (result.canceled || !result.assets || result.assets.length === 0) {
      return { success: false };
    }

    const fileUri = result.assets[0].uri;
    let jsonString = "";

    if (Platform.OS === "web") {
      const file = (result.assets[0] as any).file;
      if (!file)
        return {
          success: false,
          error:
            t(language, "noWebFile") ||
            "File object is missing on web platform.",
        };

      const arrayBuffer = await file.arrayBuffer();
      const unzipped = unzipSync(new Uint8Array(arrayBuffer));
      const jsonFileName = Object.keys(unzipped).find((k) =>
        k.endsWith(".json"),
      );
      if (!jsonFileName)
        return {
          success: false,
          error:
            t(language, "noJsonInZip") ||
            "No JSON file found in the ZIP archive.",
        };
      jsonString = strFromU8(unzipped[jsonFileName]);
    } else {
      const FS = require("expo-file-system/legacy");
      const base64Content = await FS.readAsStringAsync(fileUri, {
        encoding: FS.EncodingType.Base64,
      });
      const zippedData = Buffer.from(base64Content, "base64");
      const unzipped = unzipSync(new Uint8Array(zippedData));
      const jsonFileName = Object.keys(unzipped).find((k) =>
        k.endsWith(".json"),
      );
      if (!jsonFileName)
        return {
          success: false,
          error:
            t(language, "noJsonInZip") ||
            "No JSON file found in the ZIP archive.",
        };
      jsonString = strFromU8(unzipped[jsonFileName]);
    }

    const backupData = JSON.parse(jsonString);

    if (typeof backupData !== "object" || backupData === null) {
      return {
        success: false,
        error: t(language, "invalidBackupFormat") || "Invalid backup format.",
      };
    }

    if (!backupData["__CountYourDarts_Backup"]) {
      return {
        success: false,
        error:
          t(language, "notDartsBackup") ||
          "Selected JSON file is not a valid Count Your Darts backup.",
      };
    }

    delete backupData["__CountYourDarts_Backup"];

    const currentKeys = await AsyncStorage.getAllKeys();
    const currentDataRaw = await AsyncStorage.multiGet(currentKeys);
    const currentData: Record<string, string | null> = {};
    currentDataRaw.forEach(([key, value]) => {
      currentData[key] = value;
    });

    const kvPairs: [string, string][] = [];

    for (const [key, backupValueRaw] of Object.entries(backupData)) {
      if (backupValueRaw === null) continue;
      const backupValueStr = String(backupValueRaw);
      const localValueStr = currentData[key];

      if (!localValueStr) {
        kvPairs.push([key, backupValueStr]);
        continue;
      }

      try {
        const parsedLocal = JSON.parse(localValueStr);
        const parsedBackup = JSON.parse(backupValueStr);

        if (Array.isArray(parsedLocal) && Array.isArray(parsedBackup)) {
          const isObjectWithId = (item: any) =>
            item && typeof item === "object" && "id" in item;
          const hasIds =
            parsedLocal.some(isObjectWithId) ||
            parsedBackup.some(isObjectWithId);

          if (hasIds) {
            const localIds = new Set(parsedLocal.map((item: any) => item.id));
            const itemsToAdd = parsedBackup.filter(
              (item: any) => !localIds.has(item.id),
            );
            const mergedArray = [...parsedLocal, ...itemsToAdd];

            mergedArray.sort((a, b) => {
              const idA = Number(a.id);
              const idB = Number(b.id);
              if (!isNaN(idA) && !isNaN(idB)) return idB - idA;
              return 0;
            });

            kvPairs.push([key, JSON.stringify(mergedArray)]);
          } else {
            const localStrings = new Set(
              parsedLocal.map((i: any) => JSON.stringify(i)),
            );
            const itemsToAdd = parsedBackup.filter(
              (i: any) => !localStrings.has(JSON.stringify(i)),
            );
            const mergedArray = [...parsedLocal, ...itemsToAdd];
            kvPairs.push([key, JSON.stringify(mergedArray)]);
          }
        } else if (
          parsedLocal !== null &&
          typeof parsedLocal === "object" &&
          parsedBackup !== null &&
          typeof parsedBackup === "object"
        ) {
          const mergedObject = { ...parsedLocal, ...parsedBackup };
          kvPairs.push([key, JSON.stringify(mergedObject)]);
        } else {
          kvPairs.push([key, backupValueStr]);
        }
      } catch (e) {
        kvPairs.push([key, backupValueStr]);
      }
    }

    if (kvPairs.length > 0) {
      await AsyncStorage.multiSet(kvPairs);
      return { success: true };
    }
    return {
      success: false,
      error: t(language, "noNewData") || "No new data to import.",
    };
  } catch (error) {
    console.error("Backup import error:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : t(language, "unknownImportError") || "An unknown error occurred.",
    };
  }
};
