'use client';

import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useEffect, useRef, useState } from 'react';

export default function InteractiveLLMMap() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [userPrompt, setUserPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ code: string; explanation: string } | null>(null);
  const [lastExecution, setLastExecution] = useState<string | null>(null);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    const accessToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
    if (!accessToken) {
      console.error('MapBox access token not found');
      return;
    }

    mapboxgl.accessToken = accessToken;
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/standard',
      center: [-98.5795, 39.8283], // Center of US
      zoom: 3,
    });

    map.current.addControl(new mapboxgl.NavigationControl());

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, []);

  // Function to send user prompt to your LLM API
  const handleLLMRequest = async () => {
    if (!map.current || !userPrompt.trim()) return;

    setIsLoading(true);
    setError('');
    setResult(null);

    try {
      // Get current map state to send to LLM
      const mapState = {
        center: map.current.getCenter(),
        zoom: map.current.getZoom(),
        bounds: map.current.getBounds(),
      };

      // Request to your LLM endpoint
      const response = await fetch('/api/llm-map', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: userPrompt,
          mapState,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to get response from LLM');
      }

      const data = await response.json();
      setResult(data);

      // Execute the returned JavaScript if it exists
      if (data.code) {
        try {
          // Store the code being executed for reference
          setLastExecution(data.code);

          // Create a function that has access to the map
          const executeMapCode = new Function('map', 'mapboxgl', data.code);
          executeMapCode(map.current, mapboxgl);
        } catch (execError) {
          console.error('Error executing map code:', execError);
          setError(
            `Code execution error: ${
              execError instanceof Error ? execError.message : 'Unknown error'
            }`,
          );
        }
      }
    } catch (err) {
      console.error('Error executing LLM request:', err);
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  // Examples to help users get started
  const examples = [
    'Draw a 10km circle around Chicago',
    'Show me population density in Texas',
    'Add markers for the top 5 cities in California',
    'Highlight all national parks in the visible area',
  ];

  return (
    <div className="flex flex-col h-screen">
      <div className="p-4 bg-gray-100 border-b">
        <h2 className="text-xl font-bold mb-2">LLM-Powered Map Interface</h2>
        <div className="flex gap-2">
          <input
            type="text"
            value={userPrompt}
            onChange={(e) => setUserPrompt(e.target.value)}
            className="flex-1 p-2 border rounded"
            placeholder="Tell the map what to do... (e.g., 'Draw a 10km circle around Seattle')"
          />
          <button
            onClick={handleLLMRequest}
            disabled={isLoading}
            className="px-4 py-2 bg-blue-500 text-white rounded disabled:bg-blue-300"
          >
            {isLoading ? 'Processing...' : 'Run'}
          </button>
        </div>

        {/* Example suggestions */}
        <div className="mt-2 text-sm">
          <span className="text-gray-500">Try: </span>
          <div className="flex flex-wrap gap-2 mt-1">
            {examples.map((example, i) => (
              <button
                key={i}
                onClick={() => setUserPrompt(example)}
                className="px-2 py-1 bg-gray-200 rounded hover:bg-gray-300 text-sm"
              >
                {example}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="mt-2 p-2 bg-red-100 border border-red-300 text-red-700 rounded">
            <strong>Error:</strong> {error}
          </div>
        )}
      </div>

      {/* Main map container */}
      <div className="flex-1 relative" ref={mapContainer}>
        {isLoading && (
          <div className="absolute inset-0 bg-black bg-opacity-20 flex items-center justify-center">
            <div className="bg-white p-4 rounded shadow-lg">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
              <p className="mt-2">Generating map code...</p>
            </div>
          </div>
        )}
      </div>

      {/* Results panel */}
      {result && (
        <div className="p-4 border-t bg-gray-50">
          <div className="flex justify-between items-center">
            <h3 className="font-medium">Results</h3>
            <button onClick={() => setResult(null)} className="text-gray-500 hover:text-gray-700">
              Hide
            </button>
          </div>

          <div className="mt-2">
            <p className="font-bold">Explanation:</p>
            <p className="text-gray-700">{result.explanation}</p>
          </div>

          <div className="mt-2">
            <details>
              <summary className="cursor-pointer text-blue-600 hover:text-blue-800">
                Show generated code
              </summary>
              <pre className="mt-2 p-3 bg-gray-800 text-gray-100 rounded overflow-auto text-sm">
                <code>{result.code}</code>
              </pre>
            </details>
          </div>
        </div>
      )}
    </div>
  );
}
