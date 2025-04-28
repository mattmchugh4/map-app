'use client';

import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useEffect, useRef } from 'react';

export default function SimpleMap() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);

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
      center: [-74.5, 40], // New York area
      zoom: 9,
      pitch: 45, // Add some tilt
      bearing: 0,
    });

    // Add navigation controls
    map.current.addControl(new mapboxgl.NavigationControl());

    // Clean up on unmount
    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, []);
  const nycCoordinates: [number, number] = [-74.006, 40.7128];

  useMapCircle({
    map: map.current,
    center: nycCoordinates,
    radius: 15, // 15km radius, adjust as needed
    color: '#3887be', // Mapbox blue color
    opacity: 0.3,
  });

  return <div ref={mapContainer} style={{ width: '100%', height: '100%' }} />;
}

// hooks/useMapCircle.ts

interface UseMapCircleProps {
  map: mapboxgl.Map | null;
  center: [number, number]; // longitude, latitude
  radius: number; // in kilometers
  color?: string;
  opacity?: number;
}

export function useMapCircle({
  map,
  center,
  radius,
  color = '#FF0000',
  opacity = 0.2,
}: UseMapCircleProps) {
  useEffect(() => {
    if (!map) return;

    // Wait for map to load
    map.on('load', () => {
      // Add a source for the circle
      map.addSource('circle-source', {
        type: 'geojson',
        data: createCircleGeoJSON(center, radius),
      });

      // Add a fill layer for the circle
      map.addLayer({
        id: 'circle-fill',
        type: 'fill',
        source: 'circle-source',
        paint: {
          'fill-color': color,
          'fill-opacity': opacity,
        },
      });

      // Add an outline for the circle
      map.addLayer({
        id: 'circle-outline',
        type: 'line',
        source: 'circle-source',
        paint: {
          'line-color': color,
          'line-width': 2,
        },
      });
    });

    return () => {
      // Clean up when the component unmounts
      if (map && map.getSource('circle-source')) {
        map.removeLayer('circle-fill');
        map.removeLayer('circle-outline');
        map.removeSource('circle-source');
      }
    };
  }, [map, center, radius, color, opacity]);
}

// Helper function to create a circle GeoJSON
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
