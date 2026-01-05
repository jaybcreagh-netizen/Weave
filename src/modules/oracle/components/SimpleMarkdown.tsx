/**
 * SimpleMarkdown Component
 * Lightweight markdown renderer for Oracle responses.
 * Supports: **bold**, bullet points (* or -)
 */

import React from 'react'
import { Text, View, TextStyle } from 'react-native'

interface SimpleMarkdownProps {
    content: string
    style?: TextStyle
    boldStyle?: TextStyle
}

/**
 * Parse and render simple markdown text.
 * Supports:
 * - **bold text**
 * - * bullet points
 * - Line breaks
 */
export function SimpleMarkdown({ content, style, boldStyle }: SimpleMarkdownProps) {
    const defaultBoldStyle: TextStyle = {
        fontWeight: '600',
        ...boldStyle,
    }

    // Split by lines first
    const lines = content.split('\n')

    return (
        <View>
            {lines.map((line, lineIndex) => {
                const trimmed = line.trim()

                // Check if it's a bullet point
                const isBullet = trimmed.startsWith('* ') || trimmed.startsWith('- ')
                const bulletContent = isBullet ? trimmed.slice(2) : trimmed

                // Parse inline bold (**text**)
                const parts = parseBold(isBullet ? bulletContent : line)

                if (trimmed === '') {
                    // Empty line = paragraph break
                    return <View key={lineIndex} style={{ height: 8 }} />
                }

                return (
                    <View
                        key={lineIndex}
                        style={{
                            flexDirection: 'row',
                            flexWrap: 'wrap',
                            marginBottom: 4,
                            paddingLeft: isBullet ? 0 : 0,
                        }}
                    >
                        {isBullet && (
                            <Text style={style}>•  </Text>
                        )}
                        {parts.map((part, partIndex) => (
                            <Text
                                key={partIndex}
                                style={[style, part.bold ? defaultBoldStyle : undefined]}
                            >
                                {part.text}
                            </Text>
                        ))}
                    </View>
                )
            })}
        </View>
    )
}

interface TextPart {
    text: string
    bold: boolean
}

/**
 * Parse bold markers (**text**) into parts
 */
function parseBold(text: string): TextPart[] {
    const parts: TextPart[] = []
    const regex = /\*\*([^*]+)\*\*/g
    let lastIndex = 0
    let match

    while ((match = regex.exec(text)) !== null) {
        // Add text before the match
        if (match.index > lastIndex) {
            parts.push({ text: text.slice(lastIndex, match.index), bold: false })
        }
        // Add the bold text
        parts.push({ text: match[1], bold: true })
        lastIndex = regex.lastIndex
    }

    // Add remaining text
    if (lastIndex < text.length) {
        parts.push({ text: text.slice(lastIndex), bold: false })
    }

    // If no parts, return original text
    if (parts.length === 0) {
        parts.push({ text, bold: false })
    }

    return parts
}
