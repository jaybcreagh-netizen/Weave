import React, { useState, useEffect } from 'react';
import { View, ScrollView, Alert, ActivityIndicator, Image } from 'react-native';
import { Contact, X, UserPlus, Sparkles, Check } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

import { StandardBottomSheet } from '@/shared/ui/Sheet/StandardBottomSheet';
import { Text } from '@/shared/ui/Text';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { VerifiedBadge } from '@/shared/ui/VerifiedBadge';
import { useTheme } from '@/shared/hooks/useTheme';
import { ContactMatchingService, ContactMatch } from '@/modules/auth/services/contact-matching.service';
import { sendLinkRequest } from '@/modules/relationships/services/friend-linking.service';
import { useAuth } from '@/modules/auth/context/AuthContext';

interface ContactDiscoverySheetProps {
    visible: boolean;
    onClose: () => void;
}

export function ContactDiscoverySheet({ visible, onClose }: ContactDiscoverySheetProps) {
    const { colors } = useTheme();
    const { user } = useAuth();

    const [matches, setMatches] = useState<ContactMatch[]>([]);
    const [loading, setLoading] = useState(false);
    const [scanned, setScanned] = useState(false);
    const [sentRequests, setSentRequests] = useState<Set<string>>(new Set());

    // Auto-scan on open if not scanned yet
    useEffect(() => {
        if (visible && !scanned && !loading) {
            handleScan();
        }
    }, [visible]);

    const handleScan = async () => {
        setLoading(true);
        try {
            const results = await ContactMatchingService.findMatches();
            // Filter out self if phone is linked
            // Filter out already sent requests (client side filter for now)
            setMatches(results);
            setScanned(true);
        } catch (error: any) {
            console.warn('[ContactDiscovery] Scan failed:', error);
            if (error.message.includes('permission')) {
                Alert.alert('Permission Denied', 'We need access to contacts to find your friends.');
                onClose();
            } else {
                Alert.alert('Error', 'Failed to scan contacts. Please try again.');
            }
        } finally {
            setLoading(false);
        }
    };

    const handleSendRequest = async (match: ContactMatch) => {
        if (!user) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        try {
            // Optimistic update
            setSentRequests(prev => new Set(prev).add(match.userId));

            const success = await sendLinkRequest('', match.userId); // Pass empty string for localFriendId if it's a new request

            if (!success) {
                // Revert if failed
                setSentRequests(prev => {
                    const next = new Set(prev);
                    next.delete(match.userId);
                    return next;
                });
                Alert.alert('Error', 'Failed to send request');
            }
        } catch (err) {
            console.error('Failed to send request:', err);
        }
    };

    const renderContent = () => {
        if (loading) {
            return (
                <View style={{ padding: 40, alignItems: 'center', gap: 16 }}>
                    <ActivityIndicator size="large" color={colors.primary} />
                    <Text variant="body" style={{ textAlign: 'center', opacity: 0.7 }}>
                        Hashing and matching contacts securely...
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, opacity: 0.5 }}>
                        <VerifiedBadge size={12} color={colors['muted-foreground']} />
                        <Text variant="caption">Privacy Preserved (SHA-256)</Text>
                    </View>
                </View>
            );
        }

        if (scanned && matches.length === 0) {
            return (
                <View style={{ padding: 32, alignItems: 'center', gap: 12 }}>
                    <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: colors.muted, alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
                        <Contact size={32} color={colors['muted-foreground']} />
                    </View>
                    <Text variant="h3">No Matches Found</Text>
                    <Text variant="body" style={{ textAlign: 'center', opacity: 0.7 }}>
                        None of your contacts are on Weave yet. Invite them to join!
                    </Text>
                    <Button
                        variant="ghost"
                        label="Close"
                        onPress={onClose}
                        style={{ marginTop: 16 }}
                    />
                </View>
            );
        }

        return (
            <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
                {matches.map(match => {
                    const isSent = sentRequests.has(match.userId);
                    return (
                        <Card key={match.userId} style={{ padding: 12, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                            {match.photoUrl ? (
                                <Image
                                    source={{ uri: match.photoUrl }}
                                    style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: colors.muted }}
                                />
                            ) : (
                                <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: colors.muted, alignItems: 'center', justifyContent: 'center' }}>
                                    <Text variant="h3" style={{ opacity: 0.5 }}>{match.displayName.charAt(0)}</Text>
                                </View>
                            )}

                            <View style={{ flex: 1 }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                    <Text variant="h4">{match.displayName}</Text>
                                    <VerifiedBadge size={14} />
                                </View>
                                <Text variant="caption" style={{ opacity: 0.6 }}>On Weave</Text>
                            </View>

                            <Button
                                size="sm"
                                variant={isSent ? 'outline' : 'primary'}
                                label={isSent ? 'Sent' : 'Connect'}
                                icon={isSent ? <Check size={14} /> : <UserPlus size={14} color={colors['primary-foreground']} />}
                                disabled={isSent}
                                onPress={() => handleSendRequest(match)}
                            />
                        </Card>
                    );
                })}
            </ScrollView>
        );
    };

    return (
        <StandardBottomSheet
            visible={visible}
            onClose={onClose}
            title={scanned && matches.length > 0 ? `Found ${matches.length} Weavers` : "Find Friends"}
            height={matches.length > 3 ? "form" : "action"}
        >
            {renderContent()}
        </StandardBottomSheet>
    );
}
