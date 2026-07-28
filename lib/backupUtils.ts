import AsyncStorage from "@react-native-async-storage/async-storage";
import * as DocumentPicker from "expo-document-picker";
import * as Sharing from "expo-sharing";
import { File as ExpoFile, Paths } from "expo-file-system";
import { zipSync, unzipSync, strToU8, strFromU8 } from "fflate";
import dayjs from "dayjs";
import { t, Lang } from "./i18n";

export const exportBackup = async (
  language: Lang,
): Promise<{ success: boolean; error?: string }> => {
  try {
    const keys = await AsyncStorage.getAllKeys();

    const keysToExport = keys.filter((key) => {
      if (key === "@active_tournaments") return false;
      if (key === "@current_multiplayer_session") return false;
      if (key === "@bracket_needs_sync") return false;
      if (key === "@dart_overall_agg") return false;
      if (key.startsWith("@dart_tourney_agg_")) return false;
      if (key.startsWith("bracket_structure_")) return false;
      if (key.startsWith("@dart_selected_players_")) return false;
      if (key.startsWith("match_save_")) return false;
      return true;
    });

    const result = await AsyncStorage.multiGet(keysToExport);

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

    const dir = Paths.document ?? Paths.cache;
    const file = new ExpoFile(dir, zipFileName);
    await file.write(zippedData);

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(file.uri, {
        mimeType: "application/zip",
        dialogTitle: t(language, "backupDialogTitle"),
      });
      return { success: true };
    }
    return {
      success: false,
      error:
        t(language, "noShareOption"),
    };
  } catch (error) {
    console.error("Backup export error:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : t(language, "unknownExportError"),
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

    const file = new ExpoFile(fileUri);
    const zippedData = await file.bytes();
    const unzipped = unzipSync(zippedData);
    const jsonFileName = Object.keys(unzipped).find((k) => k.endsWith(".json"));

    if (!jsonFileName)
      return {
        success: false,
        error:
          t(language, "noJsonInZip"),
      };
    jsonString = strFromU8(unzipped[jsonFileName]);

    const backupData = JSON.parse(jsonString);

    if (typeof backupData !== "object" || backupData === null) {
      return {
        success: false,
        error: t(language, "invalidBackupFormat"),
      };
    }

    if (!backupData["__CountYourDarts_Backup"]) {
      return {
        success: false,
        error:
          t(language, "notDartsBackup"),
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
          const isObjectWithId = (
            item: unknown,
          ): item is { id: string | number } =>
            item !== null && typeof item === "object" && "id" in item;
          const hasIds =
            parsedLocal.some(isObjectWithId) ||
            parsedBackup.some(isObjectWithId);

          if (hasIds) {
            const localIds = new Set(
              parsedLocal.map((item: { id: string | number }) => item.id),
            );
            const itemsToAdd = parsedBackup.filter(
              (item: { id: string | number }) => !localIds.has(item.id),
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
              parsedLocal.map((i: unknown) => JSON.stringify(i)),
            );
            const itemsToAdd = parsedBackup.filter(
              (i: unknown) => !localStrings.has(JSON.stringify(i)),
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
      error: t(language, "noNewData"),
    };
  } catch (error) {
    console.error("Backup import error:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : t(language, "unknownImportError"),
    };
  }
};
