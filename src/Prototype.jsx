"use client";
import { useEffect, useState } from "react";
import { StoreProvider } from "./store";
import App from "./App";
export default function Prototype() {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  return ready ? (
    <StoreProvider>
      <App />
    </StoreProvider>
  ) : (
    <div className="boot">
      <span className="brand">✱ YSCC</span>
      <p>Opening your workspace…</p>
    </div>
  );
}
