/* Planer – „Bewegung reduzieren“ aus den iOS-Einstellungen (AccessibilityInfo). Bis zur Antwort gilt: reduzieren. */
import { useEffect, useState } from "react";
import { AccessibilityInfo } from "react-native";

export function useReduceMotion(): boolean {
  const [reduce, setReduce] = useState(true);
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled().then((v) => { if (alive) setReduce(v); }).catch(() => { if (alive) setReduce(false); });
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduce);
    return () => { alive = false; sub.remove(); };
  }, []);
  return reduce;
}
