'use client';

import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useEffect, useRef } from 'react';

// hooks/useMapCircle.ts
interface UseMapCircleProps {
  map: mapboxgl.Map | null;
  center: [number, number]; // longitude, latitude
  radius: number; // in kilometers
  color?: string;
  opacity?: number;
}

function createCircleGeoJSON(center: [number, number], radiusKm: number) {
  const points = 64;
  const earthRadius = 6378.1; // Earth's radius in kilometers
  const lat = (center[1] * Math.PI) / 180;
  const lon = (center[0] * Math.PI) / 180;
  const d = radiusKm / earthRadius;

  const coordinates = [];

  for (let i = 0; i <= points; i++) {
    const bearing = (2 * Math.PI * i) / points;

    // Calculate the new coordinates
    const lat2 = Math.asin(
      Math.sin(lat) * Math.cos(d) + Math.cos(lat) * Math.sin(d) * Math.cos(bearing),
    );
    const lon2 =
      lon +
      Math.atan2(
        Math.sin(bearing) * Math.sin(d) * Math.cos(lat),
        Math.cos(d) - Math.sin(lat) * Math.sin(lat2),
      );

    // Convert back to degrees
    const newLat = (lat2 * 180) / Math.PI;
    const newLon = (lon2 * 180) / Math.PI;

    coordinates.push([newLon, newLat]);
  }

  return {
    type: 'Feature',
    geometry: {
      type: 'Polygon',
      coordinates: [coordinates],
    },
    properties: {},
  };
}

export default function SimpleMap() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const nycCoordinates: [number, number] = [-74.006, 40.7128];

  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    const accessToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;

    if (!accessToken) {
      console.error('MapBox access token not found');
      return;
    }

    mapboxgl.accessToken = accessToken;

    // Create a simple map with Mapbox Streets style
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/standard',
      center: nycCoordinates, // New York area - use the same coordinates as your circle
      zoom: 9,
      pitch: 45, // Add some tilt
      bearing: 0,
    });

    // Add navigation controls
    map.current.addControl(new mapboxgl.NavigationControl());

    // Add the circle once the map is loaded
    map.current.on('load', () => {
      if (!map.current) return;

      // Add a source for the circle
      map.current.addSource('circle-source', {
        type: 'geojson',
        data: createCircleGeoJSON(nycCoordinates, 15), // 15km radius
      });

      // Add a fill layer for the circle
      map.current.addLayer({
        id: 'circle-fill',
        type: 'fill',
        source: 'circle-source',
        paint: {
          'fill-color': '#3887be',
          'fill-opacity': 0.3,
        },
      });

      // Add an outline for the circle
      map.current.addLayer({
        id: 'circle-outline',
        type: 'line',
        source: 'circle-source',
        paint: {
          'line-color': '#3887be',
          'line-width': 2,
        },
      });
    });

    // Clean up on unmount
    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, [nycCoordinates]);

  return <div ref={mapContainer} style={{ width: '100%', height: '100%' }} />;
}
