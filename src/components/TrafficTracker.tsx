"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

export function TrafficTracker() {
  const pathname = usePathname();
  const trackedRef = useRef<Record<string, boolean>>({});

  useEffect(() => {
    // Check if the user is an admin bypassing tracking via localStorage
    if (typeof window !== 'undefined' && window.localStorage.getItem('disable_tracking') === 'true') {
      return;
    }

    // Only track once per path per session to avoid spam
    if (!pathname || trackedRef.current[pathname]) return;
    
    trackedRef.current[pathname] = true;

    // Use a slightly different approach: don't fail silently, log if something breaks
    const track = async () => {
      let ip = "unknown";
      try {
        const res = await fetch("https://api.ipify.org?format=json");
        const data = await res.json();
        ip = data.ip;
      } catch (e) {
        console.warn("ipify failed, falling back to unknown IP");
      }

      try {
        await fetch("/api/traffic", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            path: pathname,
            userAgent: navigator.userAgent,
            ip: ip
          }),
          // Keepalive ensures the request finishes even if the user navigates away quickly
          keepalive: true 
        });
      } catch (e) {
        console.error("Failed to POST traffic", e);
      }
    };

    track();
  }, [pathname]);

  return null;
}
