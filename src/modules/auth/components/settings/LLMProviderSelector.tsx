/**
 * LLM Provider Selector (Dev Settings)
 * Allows switching between LLM providers for testing.
 */

import React, { useState, useCallback, useEffect } from 'react'
import { View, ScrollView, Alert, TextInput } from 'react-native'
import { Text } from '@/shared/ui/Text'
import { Card } from '@/shared/ui/Card'
import { Button } from '@/shared/ui/Button'
import { Icon } from '@/shared/ui/Icon'
import { useTheme } from '@/shared/hooks/useTheme'
import {
    llmConfigManager,
    AVAILABLE_PROVIDERS,
    type ProviderType,
    type ProviderInfo,
} from '@/shared/services/llm'

export function LLMProviderSelector() {
    const { colors } = useTheme()
    const [currentProvider, setCurrentProvider] = useState<ProviderInfo | undefined>()
    const [isLoading, setIsLoading] = useState(false)
    const [geminiKey, setGeminiKey] = useState('')
    const [claudeKey, setClaudeKey] = useState('')
    const [showKeys, setShowKeys] = useState(false)

    useEffect(() => {
        loadCurrentProvider()
    }, [])

    const loadCurrentProvider = () => {
        setCurrentProvider(llmConfigManager.getCurrentProvider())
    }

    const handleSelectProvider = useCallback(async (provider: ProviderType, model: string) => {
        setIsLoading(true)
        try {
            await llmConfigManager.switchProvider(provider, model)
            loadCurrentProvider()
            Alert.alert('Success', `Switched to ${model}`)
        } catch (error) {
            Alert.alert('Error', `Failed to switch: ${error}`)
        } finally {
            setIsLoading(false)
        }
    }, [])

    const handleSaveGeminiKey = useCallback(async () => {
        if (!geminiKey.trim()) return
        await llmConfigManager.setApiKey('gemini', geminiKey.trim())
        Alert.alert('Saved', 'Gemini API key saved')
        setGeminiKey('')
    }, [geminiKey])

    const handleSaveClaudeKey = useCallback(async () => {
        if (!claudeKey.trim()) return
        await llmConfigManager.setApiKey('claude', claudeKey.trim())
        Alert.alert('Saved', 'Claude API key saved')
        setClaudeKey('')
    }, [claudeKey])

    const geminiProviders = AVAILABLE_PROVIDERS.filter(p => p.provider === 'gemini')
    const claudeProviders = AVAILABLE_PROVIDERS.filter(p => p.provider === 'claude')

    return (
        <ScrollView
            className="flex-1 p-4"
            style={{ backgroundColor: colors.background }}
        >
            <Text variant="h3" className="mb-4">LLM Provider Testing</Text>

            {/* Current Provider */}
            <Card className="p-4 mb-4">
                <Text variant="label" style={{ color: colors['muted-foreground'] }}>
                    CURRENT PROVIDER
                </Text>
                <View className="flex-row items-center mt-2">
                    <Icon name="Sparkles" size={20} color={colors.primary} />
                    <Text variant="body" weight="medium" className="ml-2">
                        {currentProvider?.displayName || 'None configured'}
                    </Text>
                </View>
                {currentProvider && (
                    <Text variant="caption" style={{ color: colors['muted-foreground'] }}>
                        {currentProvider.description}
                    </Text>
                )}
            </Card>

            {/* API Keys */}
            <Card className="p-4 mb-4">
                <View className="flex-row justify-between items-center mb-3">
                    <Text variant="label" style={{ color: colors['muted-foreground'] }}>
                        API KEYS
                    </Text>
                    <Button variant="ghost" onPress={() => setShowKeys(!showKeys)}>
                        <Icon name={showKeys ? "EyeOff" : "Eye"} size={16} color={colors['muted-foreground']} />
                    </Button>
                </View>

                {/* Gemini Key */}
                <View className="mb-3">
                    <Text variant="caption" className="mb-1">Gemini API Key</Text>
                    <View className="flex-row gap-2">
                        <TextInput
                            value={geminiKey}
                            onChangeText={setGeminiKey}
                            placeholder={showKeys ? "Enter Gemini key..." : "••••••••••••"}
                            secureTextEntry={!showKeys}
                            className="flex-1 px-3 py-2 rounded-lg"
                            style={{
                                backgroundColor: colors.muted,
                                color: colors.foreground,
                            }}
                        />
                        <Button variant="outline" onPress={handleSaveGeminiKey}>
                            Save
                        </Button>
                    </View>
                </View>

                {/* Claude Key */}
                <View>
                    <Text variant="caption" className="mb-1">Claude API Key</Text>
                    <View className="flex-row gap-2">
                        <TextInput
                            value={claudeKey}
                            onChangeText={setClaudeKey}
                            placeholder={showKeys ? "Enter Claude key..." : "••••••••••••"}
                            secureTextEntry={!showKeys}
                            className="flex-1 px-3 py-2 rounded-lg"
                            style={{
                                backgroundColor: colors.muted,
                                color: colors.foreground,
                            }}
                        />
                        <Button variant="outline" onPress={handleSaveClaudeKey}>
                            Save
                        </Button>
                    </View>
                </View>
            </Card>

            {/* Gemini Models */}
            <Card className="p-4 mb-4">
                <Text variant="label" className="mb-3" style={{ color: colors['muted-foreground'] }}>
                    GEMINI MODELS
                </Text>
                {geminiProviders.map((provider) => (
                    <ProviderRow
                        key={provider.model}
                        provider={provider}
                        isActive={currentProvider?.model === provider.model}
                        isAvailable={llmConfigManager.isProviderAvailable('gemini')}
                        onSelect={() => handleSelectProvider('gemini', provider.model)}
                        isLoading={isLoading}
                    />
                ))}
            </Card>

            {/* Claude Models */}
            <Card className="p-4 mb-4">
                <Text variant="label" className="mb-3" style={{ color: colors['muted-foreground'] }}>
                    CLAUDE MODELS
                </Text>
                {claudeProviders.map((provider) => (
                    <ProviderRow
                        key={provider.model}
                        provider={provider}
                        isActive={currentProvider?.model === provider.model}
                        isAvailable={llmConfigManager.isProviderAvailable('claude')}
                        onSelect={() => handleSelectProvider('claude', provider.model)}
                        isLoading={isLoading}
                    />
                ))}
            </Card>
        </ScrollView>
    )
}

function ProviderRow({
    provider,
    isActive,
    isAvailable,
    onSelect,
    isLoading
}: {
    provider: ProviderInfo
    isActive: boolean
    isAvailable: boolean
    onSelect: () => void
    isLoading: boolean
}) {
    const { colors } = useTheme()

    return (
        <View
            className="flex-row items-center justify-between py-3 border-b"
            style={{ borderColor: colors.border }}
        >
            <View className="flex-1">
                <Text variant="body" weight={isActive ? 'medium' : 'regular'}>
                    {provider.displayName}
                </Text>
                <Text variant="caption" style={{ color: colors['muted-foreground'] }}>
                    {provider.description}
                </Text>
            </View>
            {isActive ? (
                <Icon name="Check" size={20} color={colors.primary} />
            ) : (
                <Button
                    variant="ghost"
                    onPress={onSelect}
                    disabled={isLoading || !isAvailable}
                >
                    <Text style={{ color: isAvailable ? colors.primary : colors['muted-foreground'] }}>
                        {isAvailable ? 'Use' : 'No key'}
                    </Text>
                </Button>
            )}
        </View>
    )
}

export default LLMProviderSelector
