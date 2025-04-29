// app/api/llm-map/route.ts (for Next.js App Router)

import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

// Response structure from LLM
interface LLMResponse {
  code: string;
  explanation: string;
}

export async function POST(req: NextRequest) {
  try {
    const { prompt, mapState } = await req.json();
    console.log('Received prompt:', prompt);
    console.log('Current map state:', mapState);

    // Initialize OpenAI client
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    // Create the system prompt with MapBox expertise
    const systemPrompt = `You are a MapBox GL JS expert. Generate JavaScript code that interacts with a MapBox GL JS map object.
    The map is already initialized, **fully loaded**, and available as the 'map' variable.
    The 'mapboxgl' library object itself is also available as the 'mapboxgl' variable.
    Only return valid JavaScript code that can directly execute in a browser and assumes 'map' and 'mapboxgl' are defined, and that the map is loaded.
    Your code should implement the user's map visualization request.

    **Crucially, the generated code must NOT attempt to fetch data from external URLs (e.g., by providing a URL string in the 'data' property of map.addSource). All data needed for visualization must be included directly within the generated code (e.g., as inline GeoJSON objects or coordinate arrays for markers).**

    Examples of functions you might use:
    - map.addSource() - To add GeoJSON sources
    - map.addLayer() - To create visualization layers
    - map.flyTo() - To navigate the map
    - new mapboxgl.Marker() - To add markers

    When adding sources or layers, do not wrap the code in map.on('load', ...), as the map is guaranteed to be loaded. You may need to check if a source or layer with the same ID already exists before adding it.

    VERY IMPORTANT: Your response must be ONLY valid JSON in exactly this format:
    {
      "code": "// Your JavaScript code here",
      "explanation": "Brief explanation of what the code does"
    }

    Do not include any text before or after the JSON. The JSON must be parseable with JSON.parse().`;

    // Make the API call to OpenAI
    const completion = await openai.chat.completions.create({
      model: 'gpt-4-turbo', // Use gpt-4 or gpt-3.5-turbo based on your needs
      messages: [
        {
          role: 'system',
          content: systemPrompt,
        },
        {
          role: 'user',
          content: `The current map state is:
          Center: [${mapState.center.lng}, ${mapState.center.lat}]
          Zoom: ${mapState.zoom}
          Bounds: SW [${mapState.bounds._sw.lng}, ${mapState.bounds._sw.lat}], NE [${mapState.bounds._ne.lng}, ${mapState.bounds._ne.lat}]

          User request: "${prompt}"

          Generate JavaScript code to fulfill this request. The code will be executed directly in the browser with access to the map object.`,
        },
      ],
      temperature: 0.2, // Lower temperature for more deterministic outputs
      max_tokens: 2000, // Adjust based on expected code complexity
    });

    // Extract the response content
    const responseContent = completion.choices[0].message.content;
    console.log('Raw LLM response:', responseContent);

    let parsedResponse: LLMResponse;

    try {
      // Try to parse the JSON response
      parsedResponse = JSON.parse(responseContent || '{}');
      console.log('Parsed LLM response:', parsedResponse);
      // Validate the parsed response has the expected structure
      if (!parsedResponse.code) {
        throw new Error('Response missing code field');
      }
    } catch (e) {
      console.error('Failed to parse LLM response as JSON:', e);

      // Attempt to extract code using regex as fallback
      // This handles cases where the model didn't properly format as JSON
      const codeMatch =
        responseContent?.match(/```javascript([\s\S]*?)```/) ||
        responseContent?.match(/```js([\s\S]*?)```/) ||
        responseContent?.match(/```([\s\S]*?)```/);

      if (codeMatch && codeMatch[1]) {
        return NextResponse.json({
          code: codeMatch[1].trim(),
          explanation: 'Code extracted from response. Original formatting was not proper JSON.',
        });
      }

      return NextResponse.json(
        { error: 'Failed to process LLM response into valid code' },
        { status: 500 },
      );
    }

    // Basic security validation (in production, you'd want more robust checks)
    // Check for potentially dangerous operations
    const dangerousPatterns = [
      /document\.cookie/i,
      /localStorage/i,
      /sessionStorage/i,
      /fetch\s*\(/i,
      /XMLHttpRequest/i,
      /eval\s*\(/i,
      /Function\s*\(/i,
      /document\.write/i,
      /window\.open/i,
      /window\.location/i,
    ];

    // const hasDangerousCode = dangerousPatterns.some((pattern) => pattern.test(parsedResponse.code));

    // if (hasDangerousCode) {
    //   return NextResponse.json(
    //     { error: 'Generated code contains potentially unsafe operations' },
    //     { status: 403 },
    //   );
    // }

    return NextResponse.json({
      code: parsedResponse.code,
      explanation: parsedResponse.explanation || 'Map operation implemented successfully.',
    });
  } catch (error) {
    console.error('Error processing LLM request:', error);
    return NextResponse.json(
      { error: 'Internal server error processing your request' },
      { status: 500 },
    );
  }
}
