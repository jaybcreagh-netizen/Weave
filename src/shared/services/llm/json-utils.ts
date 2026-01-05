/**
 * JSON Extraction Utilities
 * Robust extraction of JSON from LLM responses that may contain
 * markdown code blocks or explanatory text.
 */

/**
 * Extract JSON from potentially messy LLM output.
 * Handles:
 * - Markdown code blocks (```json ... ```)
 * - Explanatory text before/after JSON
 * - Nested objects and arrays
 * 
 * @param text - Raw LLM response text
 * @returns Cleaned JSON string
 */
export function extractJson(text: string): string {
    // First, try to extract from markdown code block
    const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
    if (codeBlockMatch) {
        return codeBlockMatch[1].trim()
    }

    // Next, try to find a JSON object or array in the text
    // This handles cases where LLM adds explanatory text
    const jsonMatch = text.match(/(\{[\s\S]*\}|\[[\s\S]*\])/)
    if (jsonMatch) {
        return jsonMatch[1].trim()
    }

    // Fall back to trimming the original text
    return text.trim()
}

/**
 * Safely parse JSON with detailed error information.
 * 
 * @param text - JSON string to parse
 * @param context - Optional context for error messages
 * @returns Parsed object or throws with context
 */
export function safeParseJson<T>(text: string, context?: string): T {
    const extracted = extractJson(text)

    try {
        return JSON.parse(extracted) as T
    } catch (error) {
        // Try to provide helpful error context
        const preview = extracted.substring(0, 100)
        const contextStr = context ? ` (${context})` : ''

        throw new Error(
            `JSON parse error${contextStr}: ${error instanceof Error ? error.message : error}\n` +
            `Preview: ${preview}${extracted.length > 100 ? '...' : ''}`
        )
    }
}

/**
 * Validate that parsed JSON matches expected structure.
 * Performs basic type checking without a full schema validator.
 * 
 * @param data - Parsed JSON data
 * @param requiredFields - Array of field names that must exist
 * @returns The data if valid
 * @throws If required fields are missing
 */
export function validateJsonFields<T extends object>(
    data: T,
    requiredFields: (keyof T)[]
): T {
    const missing = requiredFields.filter(field => !(field in data))

    if (missing.length > 0) {
        throw new Error(`Missing required fields: ${missing.join(', ')}`)
    }

    return data
}
