// Supabase Edge Function: Gemini API Proxy
// Securely proxies LLM requests through Supabase, keeping API key server-side

import "jsr:@supabase/functions-js/edge-runtime.d.ts"

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models'

interface RequestBody {
  system?: string
  user: string
  model?: string
  temperature?: number
  maxTokens?: number
}

interface GeminiResponse {
  candidates?: Array<{
    content: {
      parts: Array<{ text: string }>
    }
    finishReason: string
  }>
  usageMetadata?: {
    promptTokenCount: number
    candidatesTokenCount: number
    totalTokenCount: number
  }
  error?: {
    message: string
    code: number
  }
}

Deno.serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    })
  }

  try {
    // Get API key from environment (Supabase secret)
    const apiKey = Deno.env.get('GEMINI_API_KEY')
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'GEMINI_API_KEY not configured' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Parse request body
    const body: RequestBody = await req.json()
    const { system, user, model = 'gemini-3-flash', temperature = 1.0, maxTokens = 1024 } = body

    if (!user) {
      return new Response(
        JSON.stringify({ error: 'Missing required field: user' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Build Gemini request
    const geminiRequest = {
      contents: [
        {
          role: 'user',
          parts: [{ text: user }]
        }
      ],
      systemInstruction: system ? { parts: [{ text: system }] } : undefined,
      generationConfig: {
        temperature,
        maxOutputTokens: maxTokens,
      }
    }

    // Call Gemini API
    const geminiUrl = `${GEMINI_API_URL}/${model}:generateContent?key=${apiKey}`
    const geminiResponse = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(geminiRequest),
    })

    const geminiData: GeminiResponse = await geminiResponse.json()

    // Handle Gemini errors
    if (geminiData.error) {
      console.error('Gemini API error:', geminiData.error)
      return new Response(
        JSON.stringify({ error: geminiData.error.message }),
        { status: geminiResponse.status, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Extract response text
    const text = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || ''
    const usage = geminiData.usageMetadata

    return new Response(
      JSON.stringify({
        text,
        usage: usage ? {
          promptTokens: usage.promptTokenCount,
          completionTokens: usage.candidatesTokenCount,
          totalTokens: usage.totalTokenCount,
        } : undefined,
        finishReason: geminiData.candidates?.[0]?.finishReason,
      }),
      {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    )
  } catch (error) {
    console.error('Edge function error:', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})
