import React, {
  createContext,
  useContext,
  useReducer,
  useEffect,
  useState,
  useRef,
} from "react";
import { createSeed, reducer, STORAGE_KEY, upgradeSampleData } from "./model";
const Store = createContext(null);
export function StoreProvider({ children }) {
  const [storageError, setStorageError] = useState(false);
  const [state, dispatch] = useReducer(
    (state, action) =>
      action.type === "COMMIT_LOCAL" ? action.state : reducer(state, action),
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
          ? upgradeSampleData(s)
          : createSeed();
      } catch {
        initialState = createSeed();
      }
      const requestedMode = new URLSearchParams(window.location.search).get("simpleAssessments");
      if (requestedMode !== "off") return initialState;
      return {
        ...initialState,
        settings: { ...initialState.settings, simpleAssessments: false },
      };
    },
  );
  useEffect(() => {
    dispatch({ type: "UPGRADE_QUESTIONNAIRE_SAMPLES" });
  }, []);
  const current = useRef(state);
  current.current = state;
  const commit = (action) => {
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
    current.current = next;
    dispatch({ type: "COMMIT_LOCAL", state: next });
    setStorageError(false);
    return { state: next };
  };
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      setStorageError(false);
    } catch {
      setStorageError(true);
    }
  }, [state]);
  return (
    <Store.Provider value={{ state, dispatch, commit, storageError }}>
      {children}
    </Store.Provider>
  );
}
export const useStore = () => useContext(Store);
