import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import {
  getFirestore,
  Firestore,
  collection,
  addDoc,
  serverTimestamp,
  doc,
  updateDoc,
} from "firebase/firestore";
import { Buffer } from "buffer";
import { t, Lang } from "./i18n";

export interface DynamicFirebaseConnection {
  app: FirebaseApp;
  db: Firestore;
}

export const parseFirebaseConfig = (configStr: string) => {
  try {
    return JSON.parse(configStr);
  } catch (e) {
    const exactMatch = configStr.match(
      /firebaseConfig\s*=\s*(\{[\s\S]+?\})\s*;/,
    );
    if (exactMatch) {
      try {
        const evaluated = new Function(`return ${exactMatch[1]}`)();
        if (evaluated && evaluated.projectId) return evaluated;
      } catch (err) {}
    }

    const strippedStr = configStr.replace(/import\s+.*?['"];?/g, "");
    const match = strippedStr.match(/({[\s\S]+})/);
    if (match) {
      try {
        const evaluated = new Function(`return ${match[1]}`)();
        if (evaluated && evaluated.projectId) return evaluated;
      } catch (err) {
        console.error("Evaluation fallback failed:", err);
      }
    }
    throw e;
  }
};

export const connectToDynamicFirebase = (
  configJsonStr: string,
): DynamicFirebaseConnection | null => {
  try {
    const config = parseFirebaseConfig(configJsonStr);

    const appName = `dynamic-app-${config.projectId || "default"}`;

    let app: FirebaseApp;
    const existingApps = getApps();

    if (!existingApps.length || !existingApps.find((a) => a.name === appName)) {
      app = initializeApp(config, appName);
    } else {
      app = getApp(appName);
    }

    const db = getFirestore(app);

    return { app, db };
  } catch (error) {
    console.error("Error initializing Firebase:", error);
    return null;
  }
};

export const cancelFirebaseRoom = async (configStr: string, roomId: string) => {
  try {
    const connection = connectToDynamicFirebase(configStr);
    if (connection) {
      const roomRef = doc(connection.db, "rooms", roomId);
      await Promise.race([
        updateDoc(roomRef, { status: "cancelled" }),
        new Promise((r) => setTimeout(r, 800)),
      ]).catch(() => {});
    }
  } catch (error) {
    console.error("Error cancelling room:", error);
  }
};

export const generateConnectionString = (
  configJsonStr: string,
  roomId: string,
): string | null => {
  try {
    const config = parseFirebaseConfig(configJsonStr);

    const payload = {
      c: {
        apiKey: config.apiKey,
        projectId: config.projectId,
        appId: config.appId,
      },
      r: roomId,
    };

    const jsonString = JSON.stringify(payload);
    return Buffer.from(jsonString, "utf-8").toString("base64");
  } catch (error) {
    console.error("Error generating connection string:", error);
    return null;
  }
};

export const createHostRoom = async (
  configJsonStr: string,
  tournamentData: unknown,
  language: Lang = "en",
): Promise<{ roomId: string; connectionString: string } | null> => {
  try {
    const connection = connectToDynamicFirebase(configJsonStr);
    if (!connection) return null;

    const { db } = connection;

    const roomRef = await Promise.race([
      addDoc(collection(db, "rooms"), {
        ...JSON.parse(JSON.stringify(tournamentData)),
        status: "waiting",
        createdAt: serverTimestamp(),
      }),
      new Promise<never>((_, reject) =>
        setTimeout(
          () =>
            reject(
              new Error(
                t(language, "firebaseTimeout"),
              ),
            ),
          6000,
        ),
      ),
    ]);

    const connectionString = generateConnectionString(
      configJsonStr,
      roomRef.id,
    );

    if (!connectionString) return null;

    return { roomId: roomRef.id, connectionString };
  } catch (error) {
    console.error("Error creating room in Firebase:", error);
    throw error;
  }
};

export const parseConnectionString = (
  base64Str: string,
): { configStr: string; roomId: string } | null => {
  try {
    const jsonString = Buffer.from(base64Str, "base64").toString("utf-8");
    const payload = JSON.parse(jsonString);

    if (!payload.c || !payload.r) return null;

    return {
      configStr: JSON.stringify(payload.c),
      roomId: payload.r,
    };
  } catch (error) {
    console.error("Error parsing connection string:", error);
    return null;
  }
};
