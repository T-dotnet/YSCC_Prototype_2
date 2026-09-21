import { useState, useEffect, useMemo } from "react";

export function usePathname() {
  const [pathname, setPathname] = useState(() => window.location.pathname || "/");

  useEffect(() => {
    const handleLocationChange = () => {
      setPathname(window.location.pathname || "/");
    };
    window.addEventListener("popstate", handleLocationChange);
    return () => window.removeEventListener("popstate", handleLocationChange);
  }, []);

  return pathname;
}

export function useSearchParams() {
  const [search, setSearch] = useState(() => window.location.search || "");

  useEffect(() => {
    const handleLocationChange = () => {
      setSearch(window.location.search || "");
    };
    window.addEventListener("popstate", handleLocationChange);
    return () => window.removeEventListener("popstate", handleLocationChange);
  }, []);

  return useMemo(() => new URLSearchParams(search), [search]);
}

export function useRouter() {
  return useMemo(
    () => ({
      push(href) {
        if (typeof href === "string") {
          window.history.pushState({}, "", href);
          window.dispatchEvent(new Event("popstate"));
        }
      },
      replace(href) {
        if (typeof href === "string") {
          window.history.replaceState({}, "", href);
          window.dispatchEvent(new Event("popstate"));
        }
      },
      back() {
        window.history.back();
      },
      forward() {
        window.history.forward();
      },
      refresh() {
        window.dispatchEvent(new Event("popstate"));
      },
    }),
    [],
  );
}
