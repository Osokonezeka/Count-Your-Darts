import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLanguage } from "../../context/LanguageContext";
import { useTheme } from "../../context/ThemeContext";
import { t } from "../../lib/i18n";
import { IMPOSSIBLE_SCORES, BOGEY_NUMBERS } from "../../lib/gameUtils";
import { ScoreKeyboard } from "../../components/keyboards/ScoreKeyboard";
import { useGameModals } from "../../hooks/useGameModals";

const { width } = Dimensions.get("window");

export default function TournamentMatchScreen() {
  const { theme } = useTheme();
  const { language } = useLanguage();
  const styles = getStyles(theme);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const scrollViewRef = useRef<ScrollView>(null);
  const navigation = useNavigation();
  const isExiting = useRef(false);

  const {
    GameAlerts,
    showExitConfirm,
    showUndoConfirm,
    showInvalidScoreAlert,
  } = useGameModals(language);

  const { matchData, settingsData } = useLocalSearchParams();
  const match = matchData ? JSON.parse(matchData as string) : null;
  const initialSettings = settingsData
    ? JSON.parse(settingsData as string)
    : null;

  const [settings, setSettings] = useState(initialSettings);
  const [isFormatLoaded, setIsFormatLoaded] = useState(false);

  const [activePlayerId, setActivePlayerId] = useState<string | null>(null);
  const [starterId, setStarterId] = useState<string | null>(null);
  const [currentInput, setCurrentInput] = useState("");

  const [p1Score, setP1Score] = useState({ sets: 0, legs: 0 });
  const [p2Score, setP2Score] = useState({ sets: 0, legs: 0 });
  const [p1Throws, setP1Throws] = useState<string[]>([]);
  const [p2Throws, setP2Throws] = useState<string[]>([]);
  const [winner, setWinner] = useState<string | null>(null);

  const [legsHistory, setLegsHistory] = useState<any[]>([]);
  const [p1DoubleAttempts, setP1DoubleAttempts] = useState(0);
  const [p2DoubleAttempts, setP2DoubleAttempts] = useState(0);

  const [p1DoubleThrows, setP1DoubleThrows] = useState<number[]>([]);
  const [p2DoubleThrows, setP2DoubleThrows] = useState<number[]>([]);

  const [showDoublePrompt, setShowDoublePrompt] = useState(false);
  const [pendingTurn, setPendingTurn] = useState<any>(null);

  const STORAGE_KEY = `match_save_${match?.id}`;

  const p1PrevTurns = useMemo(() => {
    return legsHistory.reduce(
      (acc, leg) => acc + (leg.p1Throws || []).length,
      0,
    );
  }, [legsHistory]);

  const p2PrevTurns = useMemo(() => {
    return legsHistory.reduce(
      (acc, leg) => acc + (leg.p2Throws || []).length,
      0,
    );
  }, [legsHistory]);

  const p1ActiveMember = useMemo(() => {
    if (!match?.player1?.isTeam || !match?.player1?.members) return null;
    const totalTurns = p1PrevTurns + p1Throws.length;
    return match.player1.members[totalTurns % match.player1.members.length];
  }, [match, p1Throws.length, p1PrevTurns]);

  const p2ActiveMember = useMemo(() => {
    if (!match?.player2?.isTeam || !match?.player2?.members) return null;
    const totalTurns = p2PrevTurns + p2Throws.length;
    return match.player2.members[totalTurns % match.player2.members.length];
  }, [match, p2Throws.length, p2PrevTurns]);

  useEffect(() => {
    const determineMatchFormat = async () => {
      if (!match || !initialSettings) {
        setIsFormatLoaded(true);
        return;
      }
      try {
        const bKey = `bracket_structure_${initialSettings.name?.replace(/\s/g, "_")}`;
        const bStr = await AsyncStorage.getItem(bKey);
        if (bStr) {
          const bracket = JSON.parse(bStr);
          const totalR = Math.max(...bracket.map((m: any) => m.round));

          let overriddenSettings = { ...initialSettings };

          if (
            initialSettings.format === "double_knockout" ||
            initialSettings.format === "groups_and_double_knockout"
          ) {
            if (initialSettings.customFinals && match.bracket === "gf") {
              overriddenSettings.targetSets = initialSettings.finalSets;
              overriddenSettings.targetLegs = initialSettings.finalLegs;
            } else if (initialSettings.customSemis) {
              const totalWBRounds = Math.max(
                ...bracket
                  .filter((m: any) => m.bracket === "wb")
                  .map((m: any) => m.round),
                1,
              );
              const totalLBRounds = Math.max(
                ...bracket
                  .filter((m: any) => m.bracket === "lb")
                  .map((m: any) => m.round),
                1,
              );
              if (
                (match.bracket === "wb" && match.round === totalWBRounds) ||
                (match.bracket === "lb" && match.round === totalLBRounds)
              ) {
                overriddenSettings.targetSets = initialSettings.semiSets;
                overriddenSettings.targetLegs = initialSettings.semiLegs;
              }
            }
          } else {
            if (
              initialSettings.customFinals &&
              match.round === totalR &&
              !match.isThirdPlace
            ) {
              overriddenSettings.targetSets = initialSettings.finalSets;
              overriddenSettings.targetLegs = initialSettings.finalLegs;
            } else if (
              initialSettings.customSemis &&
              match.round === totalR - 1 &&
              !match.isThirdPlace
            ) {
              overriddenSettings.targetSets = initialSettings.semiSets;
              overriddenSettings.targetLegs = initialSettings.semiLegs;
            }
          }

          setSettings(overriddenSettings);
        }
      } catch (e) {
        console.error(
          t(language, "errorLoadingPhaseSettings") ||
            "Error loading phase settings:",
          e,
        );
      }
      setIsFormatLoaded(true);
    };

    determineMatchFormat();
    loadSavedMatch();
  }, []);

  useEffect(() => {
    if (match && !winner && isFormatLoaded) {
      saveCurrentMatch();
    }
  }, [
    p1Score,
    p2Score,
    p1Throws,
    p2Throws,
    activePlayerId,
    legsHistory,
    p1DoubleAttempts,
    p2DoubleAttempts,
    p1DoubleThrows,
    p2DoubleThrows,
    isFormatLoaded,
  ]);

  useEffect(() => {
    const unsubscribe = navigation.addListener("beforeRemove", (e) => {
      if (winner || isExiting.current) return;
      e.preventDefault();
      handleExitRequest();
    });
    return unsubscribe;
  }, [navigation, winner]);

  const saveCurrentMatch = async () => {
    try {
      const data = {
        p1Score,
        p2Score,
        p1Throws,
        p2Throws,
        activePlayerId,
        starterId,
        legsHistory,
        p1DoubleAttempts,
        p2DoubleAttempts,
        p1DoubleThrows,
        p2DoubleThrows,
      };
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.error(e);
    }
  };

  const loadSavedMatch = async () => {
    try {
      const saved = await AsyncStorage.getItem(STORAGE_KEY);
      if (saved) {
        const d = JSON.parse(saved);
        setP1Score(d.p1Score);
        setP2Score(d.p2Score);
        setP1Throws(d.p1Throws);
        setP2Throws(d.p2Throws);
        setActivePlayerId(d.activePlayerId);
        setStarterId(d.starterId);
        setLegsHistory(d.legsHistory || []);
        setP1DoubleAttempts(d.p1DoubleAttempts || 0);
        setP2DoubleAttempts(d.p2DoubleAttempts || 0);
        setP1DoubleThrows(d.p1DoubleThrows || []);
        setP2DoubleThrows(d.p2DoubleThrows || []);
      } else if (match) {
        setActivePlayerId(match.player1.id);
        setStarterId(match.player1.id);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleKeyPress = (val: string) => {
    if (currentInput.length < 3 && !winner)
      setCurrentInput((prev: string) => prev + val);
  };

  const handleDelete = () => {
    if (winner || currentInput.length > 0) {
      setCurrentInput((prev: string) => prev.slice(0, -1));
      return;
    }
    const isP1 = activePlayerId === match.player1.id;
    const targetName = isP1
      ? p2Throws.length > 0
        ? match.player2.name
        : match.player1.name
      : p1Throws.length > 0
        ? match.player1.name
        : "";
    const targetId = isP1
      ? p2Throws.length > 0
        ? match.player2.id
        : match.player1.id
      : match.player1.id;

    if (targetName) {
      showUndoConfirm(targetName, () => {
        if (targetId === match.player1.id) {
          setP1Throws((v: string[]) => v.slice(0, -1));
          setP1DoubleAttempts((v: number) =>
            Math.max(0, v - (p1DoubleThrows[p1DoubleThrows.length - 1] || 0)),
          );
          setP1DoubleThrows((v: number[]) => v.slice(0, -1));
        } else {
          setP2Throws((v: string[]) => v.slice(0, -1));
          setP2DoubleAttempts((v: number) =>
            Math.max(0, v - (p2DoubleThrows[p2DoubleThrows.length - 1] || 0)),
          );
          setP2DoubleThrows((v: number[]) => v.slice(0, -1));
        }
        setActivePlayerId(targetId);
      });
    }
  };

  const handleEnter = () => {
    if (!currentInput || winner) return;
    const score = parseInt(currentInput);

    if (score > 180 || IMPOSSIBLE_SCORES.includes(score)) {
      showInvalidScoreAlert();
      setCurrentInput("");
      return;
    }

    const isP1 = activePlayerId === match.player1.id;
    const currentLeft =
      settings.startingPoints -
      (isP1 ? p1Throws : p2Throws).reduce(
        (a, b) => a + (b === "BUST" ? 0 : parseInt(b)),
        0,
      );
    const newLeft = currentLeft - score;

    const isCheckoutSetup =
      currentLeft <= 170 && !BOGEY_NUMBERS.includes(currentLeft);
    const isBust =
      newLeft < 0 || newLeft === 1 || (newLeft === 0 && !isCheckoutSetup);
    const couldHaveThrownDouble = isCheckoutSetup && (newLeft <= 50 || isBust);

    if (couldHaveThrownDouble) {
      const bogey2Darts = [109, 108, 106, 105, 103, 102, 99];
      const maxDartsIsOne =
        currentLeft > 110 || bogey2Darts.includes(currentLeft);

      if (score === 0 && (currentLeft <= 40 || currentLeft === 50)) {
        processTurn(isP1, score, newLeft, isBust, 3);
      } else if (newLeft === 0 && !isBust && maxDartsIsOne) {
        processTurn(isP1, score, newLeft, isBust, 1);
      } else {
        setPendingTurn({ isP1, score, newLeft, isBust, currentLeft });
        setShowDoublePrompt(true);
      }
    } else {
      processTurn(isP1, score, newLeft, isBust, 0);
    }
  };

  const processTurn = (
    isP1: boolean,
    score: number,
    newLeft: number,
    isBust: boolean,
    dartsAtDouble: number,
  ) => {
    if (isP1) {
      setP1DoubleAttempts((v: number) => v + dartsAtDouble);
      setP1DoubleThrows((v: number[]) => [...v, dartsAtDouble]);
    } else {
      setP2DoubleAttempts((v: number) => v + dartsAtDouble);
      setP2DoubleThrows((v: number[]) => [...v, dartsAtDouble]);
    }

    if (newLeft === 0 && !isBust) {
      handleWinLeg(isP1, score.toString(), dartsAtDouble);
    } else {
      let result = score.toString();
      if (isBust) result = "BUST";

      if (isP1) {
        setP1Throws([...p1Throws, result]);
        if (match.player2) setActivePlayerId(match.player2.id);
      } else {
        setP2Throws([...p2Throws, result]);
        setActivePlayerId(match.player1.id);
      }
      setCurrentInput("");
    }
    setShowDoublePrompt(false);
    setPendingTurn(null);
  };

  const generateMatchStats = (history: any[], p1Att: number, p2Att: number) => {
    const calc = (playerId: string, isP1: boolean, att: number) => {
      let totalScore = 0,
        totalTurns = 0,
        f9S = 0,
        f9T = 0,
        c60 = 0,
        c80 = 0,
        c100 = 0,
        c120 = 0,
        c140 = 0,
        c170 = 0,
        c180 = 0,
        hF = 0,
        f100 = 0,
        bL = 9999,
        wL = 0,
        lW = 0;

      history.forEach((leg) => {
        const thr = isP1 ? leg.p1Throws : leg.p2Throws;
        if (leg.winnerId === playerId) lW++;
        thr.forEach((t: string, idx: number) => {
          const val = t === "BUST" ? 0 : parseInt(t);
          totalScore += val;
          totalTurns++;
          if (idx < 3) {
            f9S += val;
            f9T++;
          }
          if (val >= 60 && val < 80) c60++;
          else if (val >= 80 && val < 100) c80++;
          else if (val >= 100 && val < 120) c100++;
          else if (val >= 120 && val < 140) c120++;
          else if (val >= 140 && val < 170) c140++;
          else if (val >= 170 && val < 180) c170++;
          else if (val === 180) c180++;
        });
        if (thr.length > 0) {
          const darts = thr.length * 3;
          if (darts < bL) bL = darts;
          if (darts > wL) wL = darts;
        }
        if (leg.winnerId === playerId && thr.length > 0) {
          const last = parseInt(thr[thr.length - 1]);
          if (last > hF) hF = last;
          if (last >= 100) f100++;
        }
      });

      const coPct = att > 0 ? ((lW / att) * 100).toFixed(1) : "0.0";
      const totalDarts = totalTurns * 3;

      return {
        lW,
        avg: totalTurns > 0 ? (totalScore / totalTurns).toFixed(2) : "0.00",
        f9: f9T > 0 ? (f9S / f9T).toFixed(2) : "0.00",
        c60,
        c80,
        c100,
        c120,
        c140,
        c170,
        c180,
        hF,
        f100,
        bL: bL === 9999 ? "-" : bL,
        wL: wL === 0 ? "-" : wL,
        checkout: `${coPct}% (${lW}/${att})`,
        totalDarts,
      };
    };

    const s1 = calc(match.player1.id, true, p1Att);
    const s2 = match.player2 ? calc(match.player2.id, false, p2Att) : null;

    const rawStats = [
      { label: "Legs", p1: s1.lW, p2: s2?.lW || 0 },
      { label: "Darts Thrown", p1: s1.totalDarts, p2: s2?.totalDarts || 0 },
      { label: "3 Darts", p1: s1.avg, p2: s2?.avg || "0.00" },
      { label: "First 9", p1: s1.f9, p2: s2?.f9 || "0.00" },
      { label: "60+", p1: s1.c60, p2: s2?.c60 || 0 },
      { label: "80+", p1: s1.c80, p2: s2?.c80 || 0 },
      { label: "100+", p1: s1.c100, p2: s2?.c100 || 0 },
      { label: "120+", p1: s1.c120, p2: s2?.c120 || 0 },
      { label: "140+", p1: s1.c140, p2: s2?.c140 || 0 },
      { label: "170+", p1: s1.c170, p2: s2?.c170 || 0 },
      { label: "180's", p1: s1.c180, p2: s2?.c180 || 0 },
      { label: "High Finish", p1: s1.hF, p2: s2?.hF || 0 },
      { label: "100+ Finishes", p1: s1.f100, p2: s2?.f100 || 0 },
      { label: "Best Leg", p1: s1.bL, p2: s2?.bL || "-" },
      { label: "Worst Leg", p1: s1.wL, p2: s2?.wL || "-" },
      {
        label: "Checkout %",
        p1: s1.checkout,
        p2: s2?.checkout || "0.0% (0/0)",
      },
    ];

    return rawStats.filter((s) => {
      if (["Legs", "3 Darts", "Checkout %"].includes(s.label)) return true;
      const isZero = (val: any) =>
        val === 0 ||
        val === "0" ||
        val === "0.00" ||
        val === "-" ||
        val === "0.0% (0/0)";
      return !(isZero(s.p1) && isZero(s.p2));
    });
  };

  const handleWinLeg = async (
    isP1: boolean,
    winningThrowStr: string,
    winningDartsAtDouble: number,
  ) => {
    let mWinner = null;
    let mWinnerObj = null;
    const f1 = isP1 ? [...p1Throws, winningThrowStr] : p1Throws;
    const f2 = !isP1 ? [...p2Throws, winningThrowStr] : p2Throws;
    const newHistory = [
      ...legsHistory,
      {
        p1Throws: f1,
        p2Throws: f2,
        winnerId: isP1 ? match.player1.id : match.player2.id,
        starterId: starterId,
      },
    ];
    setLegsHistory(newHistory);

    let nSet1 = p1Score.sets,
      nLeg1 = p1Score.legs,
      nSet2 = p2Score.sets,
      nLeg2 = p2Score.legs;

    if (isP1) {
      nLeg1++;
      if (nLeg1 === settings.targetLegs) {
        nSet1++;
        if (nSet1 === settings.targetSets) {
          mWinner = match.player1.name;
          mWinnerObj = match.player1;
        } else {
          nLeg1 = 0;
          nLeg2 = 0;
        }
      }
      setP1Score({ sets: nSet1, legs: nLeg1 });
      setP2Score({ sets: nSet2, legs: nLeg2 });
    } else {
      nLeg2++;
      if (nLeg2 === settings.targetLegs) {
        nSet2++;
        if (nSet2 === settings.targetSets) {
          mWinner = match.player2.name;
          mWinnerObj = match.player2;
        } else {
          nLeg2 = 0;
          nLeg1 = 0;
        }
      }
      setP2Score({ sets: nSet2, legs: nLeg2 });
      setP1Score({ sets: nSet1, legs: nLeg1 });
    }

    if (mWinner) {
      setWinner(mWinner);
      try {
        await AsyncStorage.removeItem(STORAGE_KEY);
        const bKey = `bracket_structure_${settings.name?.replace(/\s/g, "_")}`;
        const bStr = await AsyncStorage.getItem(bKey);
        if (bStr) {
          const bracket = JSON.parse(bStr);
          const idx = bracket.findIndex((m: any) => m.id === match.id);
          if (idx > -1) {
            bracket[idx].winner = mWinnerObj;
            bracket[idx].score = {
              p1Sets: nSet1,
              p1Legs: nLeg1,
              p2Sets: nSet2,
              p2Legs: nLeg2,
            };
            const totalP1Att =
              p1DoubleAttempts + (isP1 ? winningDartsAtDouble : 0);
            const totalP2Att =
              p2DoubleAttempts + (!isP1 ? winningDartsAtDouble : 0);
            bracket[idx].stats = generateMatchStats(
              newHistory,
              totalP1Att,
              totalP2Att,
            );
            bracket[idx].logs = newHistory;

            const nextId = bracket[idx].nextMatchId;
            if (nextId) {
              const nIdx = bracket.findIndex((m: any) => m.id === nextId);
              if (nIdx > -1) {
                if (bracket[idx].nextMatchSlot === "p1")
                  bracket[nIdx].player1 = mWinnerObj;
                else if (bracket[idx].nextMatchSlot === "p2")
                  bracket[nIdx].player2 = mWinnerObj;
                else {
                  if (bracket[idx].matchIndex % 2 === 0)
                    bracket[nIdx].player1 = mWinnerObj;
                  else bracket[nIdx].player2 = mWinnerObj;
                }
              }
            }

            const dropId = bracket[idx].loserDropMatchId;
            if (dropId) {
              const dIdx = bracket.findIndex((m: any) => m.id === dropId);
              if (dIdx > -1) {
                const mLoserObj = isP1 ? match.player2 : match.player1;
                if (bracket[idx].loserDropSlot === "p1")
                  bracket[dIdx].player1 = mLoserObj;
                else bracket[dIdx].player2 = mLoserObj;
              }
            }

            if (bracket[idx].bracket === "gf" && bracket[idx].round === 1) {
              const gfM1 = bracket.find(
                (x: any) => x.bracket === "gf" && x.round === 2,
              );
              if (gfM1) {
                if (mWinnerObj.id === bracket[idx].player1?.id) {
                  gfM1.isBye = true;
                  gfM1.winner = mWinnerObj;
                } else {
                  gfM1.player1 = bracket[idx].player1;
                  gfM1.player2 = bracket[idx].player2;
                }
              }
            }

            const totalR = Math.max(...bracket.map((m: any) => m.round));
            if (bracket[idx].round === totalR - 1) {
              const loser = isP1 ? match.player2 : match.player1;
              const tpIdx = bracket.findIndex((m: any) => m.isThirdPlace);
              if (tpIdx > -1) {
                if (bracket[idx].matchIndex % 2 === 0)
                  bracket[tpIdx].player1 = loser;
                else bracket[tpIdx].player2 = loser;
              }
            }
            await AsyncStorage.setItem(bKey, JSON.stringify(bracket));
          }
        }
      } catch (e) {
        console.error(e);
      }
    } else {
      setP1Throws([]);
      setP2Throws([]);
      setP1DoubleThrows([]);
      setP2DoubleThrows([]);
      const nStart =
        starterId === match.player1.id ? match.player2.id : match.player1.id;
      setStarterId(nStart);
      setActivePlayerId(nStart);
      setCurrentInput("");
    }
  };

  const handleExitRequest = () => {
    showExitConfirm(
      () => {
        isExiting.current = true;
        router.back();
      },
      t(language, "exitMatchSub") || "Score will be saved.",
    );
  };

  const renderTable = () => {
    const rows = [];
    const p1Active =
      activePlayerId === match.player1.id && p1Throws.length === 0;
    const p2Active =
      activePlayerId === match.player2?.id && p2Throws.length === 0;
    rows.push(
      <View key="s" style={styles.row}>
        <View style={[styles.colScored, styles.disabledScoredCell]}>
          <Text style={styles.disabledScoredText}>-</Text>
        </View>
        <View style={[styles.colToGo, p1Active && styles.activeToGoCell]}>
          <Text style={[styles.txtToGo, p1Active && styles.activeToGoText]}>
            {settings.startingPoints}
          </Text>
        </View>
        <View style={styles.colCenter} />
        <View style={[styles.colToGo, p2Active && styles.activeToGoCell]}>
          <Text style={[styles.txtToGo, p2Active && styles.activeToGoText]}>
            {match.player2 ? settings.startingPoints : "-"}
          </Text>
        </View>
        <View style={[styles.colScored, styles.disabledScoredCell]}>
          <Text style={styles.disabledScoredText}>-</Text>
        </View>
      </View>,
    );
    const maxR = Math.max(p1Throws.length, p2Throws.length) + 1;
    let s1 = settings.startingPoints,
      s2 = settings.startingPoints;
    for (let i = 0; i < maxR; i++) {
      const t1 = p1Throws[i],
        t2 = p2Throws[i];
      if (t1 && t1 !== "BUST") s1 -= parseInt(t1);
      if (t2 && t2 !== "BUST") s2 -= parseInt(t2);
      const isP1T =
        activePlayerId === match.player1.id && i === p1Throws.length;
      const isP2T =
        activePlayerId === match.player2?.id && i === p2Throws.length;
      rows.push(
        <View key={i} style={styles.row}>
          <View style={styles.colScored}>
            <Text style={[styles.txtScored, t1 === "BUST" && styles.txtBust]}>
              {isP1T ? currentInput : t1 || ""}
            </Text>
          </View>
          <View
            style={[
              styles.colToGo,
              activePlayerId === match.player1.id &&
                i === p1Throws.length - 1 &&
                styles.activeToGoCell,
            ]}
          >
            <Text
              style={[
                styles.txtToGo,
                activePlayerId === match.player1.id &&
                  i === p1Throws.length - 1 &&
                  styles.activeToGoText,
                t1 && s1 === 0 && { color: theme.colors.warning },
              ]}
            >
              {t1 ? s1 : ""}
            </Text>
          </View>
          <View style={styles.colCenter}>
            <Text style={styles.txtDarts}>{(i + 1) * 3}</Text>
          </View>
          <View
            style={[
              styles.colToGo,
              activePlayerId === match.player2?.id &&
                i === p2Throws.length - 1 &&
                styles.activeToGoCell,
            ]}
          >
            <Text
              style={[
                styles.txtToGo,
                activePlayerId === match.player2?.id &&
                  i === p2Throws.length - 1 &&
                  styles.activeToGoText,
                t2 && s2 === 0 && { color: theme.colors.warning },
              ]}
            >
              {t2 ? s2 : ""}
            </Text>
          </View>
          <View style={styles.colScored}>
            <Text style={[styles.txtScored, t2 === "BUST" && styles.txtBust]}>
              {isP2T ? currentInput : t2 || ""}
            </Text>
          </View>
        </View>,
      );
    }
    return rows;
  };

  if (!isFormatLoaded || !settings) {
    return (
      <View
        style={[
          styles.container,
          { justifyContent: "center", alignItems: "center" },
        ]}
      >
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.matchHeader}>
        <TouchableOpacity onPress={handleExitRequest}>
          <Ionicons name="close" size={28} color={theme.colors.textMain} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {t(language, "firstTo") || "First to"} {settings.targetSets}{" "}
          {t(language, "setsShort") || "Sets"} / {settings.targetLegs}{" "}
          {t(language, "legsShort") || "Legs"}
        </Text>
        <View style={{ width: 28 }} />
      </View>

      <View style={styles.playerInfoBar}>
        <View style={styles.playerInfoItem}>
          <Text
            style={[
              styles.pName,
              activePlayerId === match.player1.id && styles.pActive,
            ]}
            numberOfLines={1}
          >
            {match.player1.name}
          </Text>
          {p1ActiveMember && (
            <Text
              style={[
                styles.pMemberName,
                activePlayerId === match.player1.id && styles.pMemberActive,
              ]}
              numberOfLines={1}
            >
              {p1ActiveMember}
            </Text>
          )}
        </View>
        <View style={styles.scoreBadge}>
          {settings.targetSets > 1 && (
            <View style={styles.scoreBadgeRow}>
              <Text style={styles.scoreBadgeNum}>{p1Score.sets}</Text>
              <Text style={styles.scoreBadgeLabel}>S</Text>
              <Text style={styles.scoreBadgeNum}>{p2Score.sets}</Text>
            </View>
          )}
          <View style={styles.scoreBadgeRow}>
            <Text style={styles.scoreBadgeNum}>{p1Score.legs}</Text>
            <Text style={styles.scoreBadgeLabel}>L</Text>
            <Text style={styles.scoreBadgeNum}>{p2Score.legs}</Text>
          </View>
        </View>
        <View style={styles.playerInfoItem}>
          <Text
            style={[
              styles.pName,
              activePlayerId === match.player2?.id && styles.pActive,
            ]}
            numberOfLines={1}
          >
            {match.player2?.name || t(language, "byePlayer") || "Bye"}
          </Text>
          {p2ActiveMember && (
            <Text
              style={[
                styles.pMemberName,
                activePlayerId === match.player2?.id && styles.pMemberActive,
              ]}
              numberOfLines={1}
            >
              {p2ActiveMember}
            </Text>
          )}
        </View>
      </View>

      <View style={styles.tableHead}>
        <Text style={styles.headLabel}>
          {t(language, "scored") || "Scored"}
        </Text>
        <Text style={styles.headLabelToGo}>
          {t(language, "toGo") || "To Go"}
        </Text>
        <View style={{ width: 40 }} />
        <Text style={styles.headLabelToGo}>
          {t(language, "toGo") || "To Go"}
        </Text>
        <Text style={styles.headLabel}>
          {t(language, "scored") || "Scored"}
        </Text>
      </View>

      <ScrollView
        ref={scrollViewRef}
        style={{ flex: 1 }}
        onContentSizeChange={() =>
          scrollViewRef.current?.scrollToEnd({ animated: true })
        }
      >
        {renderTable()}
      </ScrollView>

      {winner && (
        <View style={styles.winOverlay}>
          <Text style={styles.winTitle}>
            {winner} {t(language, "wins") || "Wins!"}
          </Text>
          <TouchableOpacity
            style={styles.winBtn}
            onPress={() => {
              isExiting.current = true;
              router.back();
            }}
          >
            <Text style={styles.winBtnTxt}>
              {t(language, "close") || "Close"}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      <Modal visible={showDoublePrompt} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {t(language, "doublesDarts") || "Darts at double"}
            </Text>
            <Text style={styles.modalDesc}>
              {t(language, "doublesDartsDesc") ||
                "How many darts were thrown at a double?"}
            </Text>
            <View style={styles.doublePromptActions}>
              {(() => {
                let maxDarts = 3;
                const bogey2Darts = [109, 108, 106, 105, 103, 102, 99];

                if (
                  pendingTurn?.currentLeft > 110 ||
                  bogey2Darts.includes(pendingTurn?.currentLeft)
                ) {
                  maxDarts = 1;
                } else if (pendingTurn?.currentLeft > 50) {
                  maxDarts = 2;
                }

                if (pendingTurn?.newLeft === 0 && !pendingTurn?.isBust) {
                  const winOpts = Array.from(
                    { length: maxDarts },
                    (_, i) => i + 1,
                  );
                  const bustOpts = Array.from(
                    { length: maxDarts + 1 },
                    (_, i) => i,
                  );

                  return (
                    <View style={{ width: "100%" }}>
                      <Text style={styles.promptSectionTitle}>
                        {t(language, "checkout") || "Checkout (Win)"}
                      </Text>
                      <View style={styles.doublePromptActions}>
                        {winOpts.map((num) => (
                          <TouchableOpacity
                            key={`win-${num}`}
                            style={[
                              styles.doubleBtn,
                              {
                                backgroundColor:
                                  theme.colors.success || "#28a745",
                              },
                            ]}
                            onPress={() =>
                              processTurn(
                                pendingTurn.isP1,
                                pendingTurn.score,
                                0,
                                false,
                                num,
                              )
                            }
                          >
                            <Text style={styles.doubleBtnTxt}>{num}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>

                      <Text
                        style={[
                          styles.promptSectionTitle,
                          {
                            color: theme.colors.danger || "#dc3545",
                            marginTop: 20,
                          },
                        ]}
                      >
                        {t(language, "bust") || "Bust"}
                      </Text>
                      <View style={styles.doublePromptActions}>
                        {bustOpts.map((num) => (
                          <TouchableOpacity
                            key={`bust-${num}`}
                            style={[
                              styles.doubleBtn,
                              {
                                backgroundColor:
                                  theme.colors.danger || "#dc3545",
                              },
                            ]}
                            onPress={() =>
                              processTurn(
                                pendingTurn.isP1,
                                pendingTurn.score,
                                0,
                                true,
                                num,
                              )
                            }
                          >
                            <Text style={styles.doubleBtnTxt}>{num}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                  );
                }

                let opts = Array.from({ length: maxDarts + 1 }, (_, i) => i);
                return opts.map((num) => (
                  <TouchableOpacity
                    key={num}
                    style={styles.doubleBtn}
                    onPress={() => {
                      processTurn(
                        pendingTurn.isP1,
                        pendingTurn.score,
                        pendingTurn.newLeft,
                        pendingTurn.isBust,
                        num,
                      );
                    }}
                  >
                    <Text style={styles.doubleBtnTxt}>{num}</Text>
                  </TouchableOpacity>
                ));
              })()}
            </View>
          </View>
        </View>
      </Modal>

      <View>
        <ScoreKeyboard
          onKeyPress={handleKeyPress}
          onDelete={handleDelete}
          onSubmit={handleEnter}
          theme={theme}
          hideWrapperBorder={true}
          keyStyle={{ height: 80 }}
          style={[
            styles.kb,
            { paddingBottom: insets.bottom > 0 ? insets.bottom : 0 },
          ]}
        />
      </View>

      <GameAlerts />
    </View>
  );
}

const getStyles = (theme: any) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.background },
    matchHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      padding: 12,
      backgroundColor: theme.colors.card,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.cardBorder,
    },
    headerTitle: {
      fontSize: 13,
      fontWeight: "800",
      color: theme.colors.textMuted,
      textTransform: "uppercase",
    },
    playerInfoBar: {
      flexDirection: "row",
      alignItems: "center",
      padding: 15,
      backgroundColor: theme.colors.background,
    },
    playerInfoItem: { flex: 1 },
    pName: {
      fontSize: 18,
      fontWeight: "800",
      color: theme.colors.textMuted,
      textAlign: "center",
    },
    pActive: { color: theme.colors.primary, fontSize: 20 },
    pMemberName: {
      fontSize: 13,
      fontWeight: "700",
      color: theme.colors.textLight,
      textAlign: "center",
      marginTop: 2,
    },
    pMemberActive: {
      color: theme.colors.primary,
      opacity: 0.8,
    },
    scoreBadge: {
      backgroundColor: theme.colors.cardBorder,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
    },
    scoreBadgeRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingVertical: 2,
    },
    scoreBadgeNum: {
      fontSize: 16,
      fontWeight: "900",
      color: theme.colors.textMain,
      width: 20,
      textAlign: "center",
    },
    scoreBadgeLabel: {
      fontSize: 13,
      fontWeight: "700",
      color: theme.colors.textMuted,
      width: 14,
      textAlign: "center",
    },
    tableHead: {
      flexDirection: "row",
      backgroundColor: theme.colors.card,
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.cardBorder,
    },
    headLabel: {
      flex: 1,
      textAlign: "center",
      fontSize: 11,
      fontWeight: "700",
      color: theme.colors.textMuted,
      textTransform: "uppercase",
    },
    headLabelToGo: {
      flex: 1.3,
      textAlign: "center",
      fontSize: 11,
      fontWeight: "700",
      color: theme.colors.textMuted,
      textTransform: "uppercase",
    },
    row: {
      flexDirection: "row",
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.cardBorder,
      height: 55,
    },
    colScored: { flex: 1, justifyContent: "center", alignItems: "center" },
    colToGo: {
      flex: 1.3,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: theme.colors.card,
    },
    colCenter: {
      width: 40,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: theme.colors.cardBorder,
    },
    activeToGoCell: {
      backgroundColor: theme.colors.primaryLight || "rgba(0, 122, 255, 0.15)",
    },
    activeToGoText: { color: theme.colors.primary },
    disabledScoredCell: {
      backgroundColor: theme.colors.cardBorder,
      opacity: 0.5,
    },
    disabledScoredText: {
      color: theme.colors.textMuted,
      fontSize: 22,
      fontWeight: "600",
    },
    txtScored: {
      fontSize: 20,
      fontWeight: "600",
      color: theme.colors.textMain,
    },
    txtToGo: { fontSize: 24, fontWeight: "900", color: theme.colors.textMain },
    txtDarts: {
      fontSize: 12,
      fontWeight: "700",
      color: theme.colors.textMuted,
    },
    txtBust: { color: "red", fontSize: 14, fontWeight: "800" },
    kb: {
      backgroundColor: theme.colors.background,
      borderTopWidth: 1,
      borderColor: theme.colors.cardBorder,
    },
    winOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: "rgba(0,0,0,0.9)",
      justifyContent: "center",
      alignItems: "center",
      zIndex: 1000,
    },
    winTitle: {
      color: "#fff",
      fontSize: 32,
      fontWeight: "900",
      marginBottom: 20,
    },
    winBtn: {
      backgroundColor: theme.colors.primary,
      padding: 15,
      borderRadius: 10,
    },
    winBtnTxt: { color: "#fff", fontWeight: "800", fontSize: 16 },
    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.7)",
      justifyContent: "center",
      alignItems: "center",
      padding: 20,
    },
    modalContent: {
      backgroundColor: theme.colors.card,
      borderRadius: 20,
      padding: 24,
      width: "100%",
      alignItems: "center",
    },
    modalTitle: {
      fontSize: 22,
      fontWeight: "900",
      color: theme.colors.textMain,
      marginBottom: 8,
    },
    modalDesc: {
      fontSize: 14,
      color: theme.colors.textMuted,
      textAlign: "center",
      marginBottom: 24,
    },
    promptSectionTitle: {
      fontSize: 13,
      fontWeight: "900",
      color: theme.colors.success,
      marginBottom: 8,
      textTransform: "uppercase",
      textAlign: "center",
      letterSpacing: 1,
    },
    doublePromptActions: {
      flexDirection: "row",
      justifyContent: "space-between",
      width: "100%",
      gap: 10,
    },
    doubleBtn: {
      flex: 1,
      backgroundColor: theme.colors.primary,
      paddingVertical: 15,
      borderRadius: 12,
      alignItems: "center",
    },
    doubleBtnTxt: { color: "#fff", fontSize: 20, fontWeight: "800" },
  });
