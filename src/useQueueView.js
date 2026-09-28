import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";

// Use the framed workspace when present; classic pages retain window scrolling.
const queueScrollTarget = () => document.querySelector(".shell-modern #main") || window;

export default function useQueueView() {
  const path = usePathname();
  const params = useSearchParams();
  const href = path + (params.size ? `?${params}` : "");
  useEffect(() => {
    let position = 0;
    try {
      position = Number(sessionStorage.getItem(`yscc-scroll:${href}`)) || 0;
    } catch {}
    const frame = requestAnimationFrame(() => queueScrollTarget().scrollTo(0, position));
    return () => cancelAnimationFrame(frame);
  }, [path]);
  const remember = () => {
    try {
      const target = queueScrollTarget();
      sessionStorage.setItem(`yscc-scroll:${href}`, String(target === window ? window.scrollY : target.scrollTop));
    } catch {}
  };
  const set = (key, value, fallback, resetPage = false) => {
    const next = new URLSearchParams(window.location.search);
    if (value === fallback || !value) next.delete(key);
    else next.set(key, value);
    if (resetPage) next.delete("page");
    const nextUrl = path + (next.size ? `?${next}` : "");
    window.history.replaceState(null, "", nextUrl);
    window.dispatchEvent(new Event("popstate"));
  };
  return { params, href, set, remember };
}
