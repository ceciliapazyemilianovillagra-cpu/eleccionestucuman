"use client";
import { useCallback, useState } from "react";

export type GeoPoint = { lat: number; lng: number; accuracy: number };

export function useGeolocation() {
  const [locating, setLocating] = useState(false);
  const [geoError, setGeoError] = useState("");

  const getLocation = useCallback((): Promise<GeoPoint | null> => {
    setGeoError("");
    if (!("geolocation" in navigator)) {
      setGeoError("Este dispositivo no soporta ubicación.");
      return Promise.resolve(null);
    }
    setLocating(true);
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLocating(false);
          resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy });
        },
        () => {
          setLocating(false);
          setGeoError("No pudimos obtener tu ubicación. Activá el permiso de ubicación e intentá de nuevo.");
          resolve(null);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    });
  }, []);

  return { getLocation, locating, geoError };
}
