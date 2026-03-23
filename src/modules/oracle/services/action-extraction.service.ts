import { database } from '@/db';
import JournalEntry from '@/db/models/JournalEntry';
import { llmService } from '@/shared/services/llm';
import { getPrompt, interpolatePrompt } from '@/shared/services/llm/prompt-registry';
import { logger } from '@/shared/services/logger.service';
import FriendModel from '@/db/models/Friend';
import JournalEntryFriend from '@/db/models/JournalEntryFriend';
import { Q } from '@nozbe/watermelondb';
import { memoryBridgeService } from '@/modules/journal/services/memory-bridge.service';
import { intelligenceCapabilitiesService } from '@/modules/intelligence/services/intelligence-capabilities.service';

import { SmartAction } from './types';

class ActionExtractionService {
    private isProcessing = false;
    private queue: string[] = []; // Queue of JournalEntry IDs

    /**
     * Queue an entry for action extraction.
     * Call this after a JournalEntry is created or updated.
     */
    queueEntry(entryId: string) {
        if (!this.queue.includes(entryId)) {
            this.queue.push(entryId);
            this.processQueue();
        }
    }

    private async processQueue() {
        if (this.isProcessing || this.queue.length === 0) return;

        this.isProcessing = true;
        const entryId = this.queue.shift();

        if (entryId) {
            try {
                await this.analyzeEntry(entryId);
            } catch (error) {
                logger.error('ActionExtractionService', 'Failed to process entry', { entryId, error });
            } finally {
                this.isProcessing = false;
                // Process next item if exists
                if (this.queue.length > 0) {
                    this.processQueue();
                }
            }
        } else {
            this.isProcessing = false;
        }
    }

    /**
     * Run the "Silent Audit" on a journal entry and return actions.
     */
    public async extractActions(entryId: string, remoteEnabled?: boolean): Promise<SmartAction[]> {
        return this.analyzeEntry(entryId, remoteEnabled);
    }

    private async analyzeEntry(entryId: string, remoteEnabled?: boolean): Promise<SmartAction[]> {
        logger.info('ActionExtractionService', 'Starting analysis', { entryId });

        try {
            const capabilities = await intelligenceCapabilitiesService.getCapabilitiesForCurrentProfile();
            const canUseRemoteActions =
                typeof remoteEnabled === 'boolean' ? remoteEnabled : capabilities.actionExtractionEnabled;

            if (!canUseRemoteActions) {
                logger.info('ActionExtractionService', 'Skipping action extraction because remote AI is unavailable');
                return [];
            }

            const entry = await database.get<JournalEntry>('journal_entries').find(entryId);

            // Skip if too short
            if (!entry.content || entry.content.length < 10) {
                logger.info('ActionExtractionService', 'Skipping short entry');
                return [];
            }

            // Fetch friend names for context
            const links = await database.get<JournalEntryFriend>('journal_entry_friends')
                .query(Q.where('journal_entry_id', entry.id))
                .fetch();

            const friends = await Promise.all(
                links.map(link => database.get<FriendModel>('friends').find(link.friendId))
            );
            const friendNames = friends.map(f => f.name).join(', ');

            // Get Prompt
            const promptDef = getPrompt('journal_action_detection');
            if (!promptDef) {
                logger.error('ActionExtractionService', 'Prompt not found: journal_action_detection');
                return [];
            }

            const userPrompt = interpolatePrompt(promptDef.userPromptTemplate, {
                content: entry.content,
                friendNames: friendNames || 'None detected'
            });

            // Call LLM
            const response = await llmService.complete({
                system: promptDef.systemPrompt,
                user: userPrompt
            }, promptDef.defaultOptions);

            const jsonStr = this.extractJson(response.text);
            const rawActions: SmartAction[] = JSON.parse(jsonStr);

            // Resolve friend names → database IDs
            // The LLM returns names (e.g. "Polo") since it doesn't know UUIDs
            const nameToId = new Map<string, string>();
            for (const f of friends) {
                nameToId.set(f.name.toLowerCase(), f.id);
                // Also map first name for partial matches
                const firstName = f.name.split(' ')[0].toLowerCase();
                if (!nameToId.has(firstName)) {
                    nameToId.set(firstName, f.id);
                }
            }

            const actions = rawActions.map(action => {
                if (action.data?.friendId) {
                    const resolved = nameToId.get(action.data.friendId.toLowerCase());
                    if (resolved) {
                        return { ...action, data: { ...action.data, friendId: resolved } };
                    }
                }
                // Fallback: if no friendId or unresolved, use first linked friend
                if (!action.data?.friendId && friends.length > 0) {
                    return { ...action, data: { ...action.data, friendId: friends[0].id } };
                }
                return action;
            });

            if (Array.isArray(actions) && actions.length > 0) {
                // Save to DB
                await database.write(async () => {
                    await entry.update(rec => {
                        rec.smartActions = actions;
                    });
                });

                await memoryBridgeService.ingestSmartActions(entry, friends, actions);
                logger.info('ActionExtractionService', 'Actions saved', { count: actions.length });
                return actions;
            } else {
                logger.info('ActionExtractionService', 'No actions detected', { actions });
                return [];
            }

        } catch (e) {
            logger.error('ActionExtractionService', 'Failed to parse LLM response', e);
            return [];
        }
    }

    private extractJson(text: string): string {
        try {
            // Remove markdown code blocks if present
            let clean = text.replace(/```(?:json)?\s*([\s\S]*?)```/g, '$1');

            // If it's just a raw list of objects without array brackets (sometimes happens), wrap it?
            // But usually LLM respects [ ... ]

            // Remove any leading/trailing text outside valid JSON brackets
            const openBracket = clean.indexOf('[');
            const closeBracket = clean.lastIndexOf(']');

            if (openBracket >= 0 && closeBracket > openBracket) {
                clean = clean.substring(openBracket, closeBracket + 1);
            }

            return clean.trim();
        } catch (e) {
            return text; // Fallback to original text for JSON.parse to fail naturally details
        }
    }
}

export const actionExtractionService = new ActionExtractionService();
