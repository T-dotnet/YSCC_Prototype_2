import { reconcileAssessmentSchedules } from "./assessmentSchedules";
import React, {
  createContext,
  useContext,
  useReducer,
  useEffect,
  useLayoutEffect,
  useState,
  useRef,
  useCallback,
  useMemo,
} from "react";
import { createDefaultWorkspace, reducer, STORAGE_KEY, upgradeSampleData, TODAY, refreshToday } from "./model";
import { ensureSampleMvpFlow } from "./sampleMvpFlow";
import { uiColorSetup } from "./uiColorSetups";
import { makeInitialAssessmentsImmediate } from "./mvpAssessmentPathway";
// Keep the context identity stable while Vite replaces this module in development.
// Otherwise an old provider and a new useStore can briefly use different contexts.
const Store = import.meta.hot?.data?.storeContext || createContext(null);
if (import.meta.hot) import.meta.hot.data.storeContext = Store;
export function StoreProvider({ children }) {
  const [storageError, setStorageError] = useState(false);
  const [state, dispatch] = useReducer(
    (state, action) =>
      action.type === "COMMIT_LOCAL" ? action.state :
      action.type === "REFRESH_DATE" ? { ...state } : reducer(state, action),
    null,
    () => {
      let initialState;
      try {
        const s = JSON.parse(localStorage.getItem(STORAGE_KEY));
        initialState = s?.schema === 1 &&
          Array.isArray(s.people) &&
          s.people.length &&
          Array.isArray(s.issues) &&
          Array.isArray(s.audit)
          ? ensureSampleMvpFlow(upgradeSampleData(s), TODAY)
          : createDefaultWorkspace();
      } catch {
        initialState = createDefaultWorkspace();
      }
      initialState = reconcileAssessmentSchedules(makeInitialAssessmentsImmediate(initialState), TODAY);
      const requestedMode = new URLSearchParams(window.location.search).get("simpleAssessments");
      if (requestedMode !== "off") return initialState;
      return {
        ...initialState,
        settings: { ...initialState.settings, simpleAssessments: false },
      };
    },
  );
  useLayoutEffect(() => {
    document.documentElement.dataset.uiSetup = String(uiColorSetup(state.settings?.uiColorSetup));
  }, [state.settings?.uiColorSetup]);
  useEffect(() => {
    dispatch({ type: "UPGRADE_QUESTIONNAIRE_SAMPLES" });
  }, []);
  useEffect(() => {
    let timer;
    const refresh = () => {
      if (refreshToday()) dispatch({ type: "REFRESH_DATE" });
    };
    const schedule = () => {
      clearTimeout(timer);
      const now = new Date();
      const midnight = new Date(now);
      midnight.setHours(24, 0, 0, 0);
      timer = setTimeout(() => {
        refresh();
        schedule();
      }, Math.max(1000, midnight.getTime() - now.getTime() + 50));
    };
    const onReturn = () => {
      refresh();
      schedule();
    };
    onReturn();
    window.addEventListener("focus", onReturn);
    document.addEventListener("visibilitychange", onReturn);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("focus", onReturn);
      document.removeEventListener("visibilitychange", onReturn);
    };
  }, []);
  const current = useRef(state);
  const persisted = useRef(null);
  current.current = state;
  const commit = useCallback((action) => {
    const before = current.current;
    const next = reducer(before, action);
    if (next === before)
      return {
        error:
          "The record changed or the action is no longer available. Reopen it before saving.",
      };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      setStorageError(true);
      return {
        error:
          "Could not save in this browser. Your entries are still here. Free browser storage and retry; no new record was committed.",
      };
    }
    persisted.current = next;
    current.current = next;
    dispatch({ type: "COMMIT_LOCAL", state: next });
    setStorageError(false);
    return { state: next };
  }, []);
  useEffect(() => {
    if (persisted.current === state) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      persisted.current = state;
      setStorageError(false);
    } catch {
      setStorageError(true);
    }
  }, [state]);
  const value = useMemo(() => ({ state, dispatch, commit, storageError }),
    [state, dispatch, commit, storageError]);
  return (
    <Store.Provider value={value}>
      {children}
    </Store.Provider>
  );
}
export const useStore = () => useContext(Store);
