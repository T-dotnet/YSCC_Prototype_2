import { useEffect, useRef, useState } from "react";

// Session storage keeps fictional staff drafts through navigation in this tab.
// A draft is never part of the saved response or clinical review.
export default function useDraft(key, initialValue) {
  const storageKey = `yscc-staff-draft:v2:${key}`;
  const cleared = useRef(false);
  const [error, setError] = useState(false);
  const [draft, setDraft] = useState(() => {
    try {
      return JSON.parse(sessionStorage.getItem(storageKey)) || initialValue;
    } catch {
      return initialValue;
    }
  });
  useEffect(() => {
    if (cleared.current) return;
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(draft));
    } catch {
      setError(true);
    }
  }, [storageKey, draft]);
  useEffect(() => {
    if (!error) return;
    const warn = (event) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [error]);
  const clear = () => {
    cleared.current = true;
    try {
      sessionStorage.removeItem(storageKey);
    } catch {}
  };
  return [draft, setDraft, clear, error];
}
