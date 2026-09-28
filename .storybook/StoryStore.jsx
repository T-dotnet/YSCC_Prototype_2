import { createContext, useContext, useState } from "react";
import { createSeed, reducer } from "../src/model";

const Store = createContext(null);

// Story interactions are temporary and never read or write the app's storage.
export function StoreProvider({ children, settings = {} }) {
  const [state, setState] = useState(() => {
    const seed = createSeed();
    return { ...seed, settings: { ...seed.settings, ...settings } };
  });
  const commit = (action) => {
    const next = reducer(state, action);
    if (next === state) return { error: "No change in this sample." };
    setState(next);
    return { state: next };
  };
  return <Store.Provider value={{ state, commit, dispatch: commit, storageError: false }}>{children}</Store.Provider>;
}

export const useStore = () => useContext(Store);
