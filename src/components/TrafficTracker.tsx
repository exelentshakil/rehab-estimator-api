"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

export function TrafficTracker() {
  const pathname = usePathname();
  const trackedRef = useRef<Record<string, boolean>>({});

  useEffect(() => {
    // Only track once per path per session to avoid spam
    if (!pathname || trackedRef.current[pathname]) return;
    
    trackedRef.current[pathname] = true;

    // We fetch a free IP lookup service from client, or pass to our own API
    // To make this super reliable without extra dependencies we pass it to our API
    fetch("https://api.ipify.org?format=json")
      .then(res => res.json())
      .then(data => {
        fetch("/api/traffic", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            path: pathname,
            userAgent: navigator.userAgent,
            ip: data.ip
          })
        }).catch(console.error);
      })
      .catch(() => {
        // Fallback if ipify fails
        fetch("/api/traffic", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            path: pathname,
            userAgent: navigator.userAgent,
            ip: "unknown"
          })
        }).catch(console.error);
      });
  }, [pathname]);

  return null;
}
