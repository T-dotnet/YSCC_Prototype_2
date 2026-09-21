import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";

export default function useQueueView() {
  const path = usePathname();
  const params = useSearchParams();
  const href = path + (params.size ? `?${params}` : "");
  useEffect(() => {
    let position = 0;
    try {
      position = Number(sessionStorage.getItem(`yscc-scroll:${href}`)) || 0;
    } catch {}
    const frame = requestAnimationFrame(() => window.scrollTo(0, position));
    return () => cancelAnimationFrame(frame);
  }, [path]);
  const remember = () => {
    try {
      sessionStorage.setItem(`yscc-scroll:${href}`, String(window.scrollY));
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
