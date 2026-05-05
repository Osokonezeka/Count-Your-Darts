import { useEffect, useRef } from "react";

type UseBotTurnProps<T> = {
  condition: boolean;
  botAvg: number | null;
  delay: number;
  historyLength: number;
  calculate: () => T;
  execute: (result: T) => void | Promise<void>;
  dependencies?: unknown[];
};

export function useBotTurn<T>({
  condition,
  botAvg,
  delay,
  historyLength,
  calculate,
  execute,
  dependencies = [],
}: UseBotTurnProps<T>) {
  const botCache = useRef<Record<number, T>>({});
  const calculateRef = useRef(calculate);
  const executeRef = useRef(execute);

  useEffect(() => {
    calculateRef.current = calculate;
    executeRef.current = execute;
  }, [calculate, execute]);

  useEffect(() => {
    if (!condition || botAvg === null) return;
    let isActiveEffect = true;

    const timer = setTimeout(() => {
      if (!isActiveEffect) return;
      let result: T;
      if (botCache.current[historyLength] !== undefined)
        result = botCache.current[historyLength];
      else {
        result = calculateRef.current();
        botCache.current[historyLength] = result;
      }
      executeRef.current(result);
    }, delay);

    return () => {
      isActiveEffect = false;
      clearTimeout(timer);
    };
  }, [condition, botAvg, delay, historyLength, ...dependencies]);
}
