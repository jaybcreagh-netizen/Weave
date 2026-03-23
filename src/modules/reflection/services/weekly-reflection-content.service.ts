import type { SocialSeason } from '@/db/models/UserProfile'

import type { ExtendedWeeklySummary } from './weekly-summary-extended.service'

export function generateLocalWeeklyNarrative(
    summary: ExtendedWeeklySummary,
    season: SocialSeason | null = null
): string {
    const opening = getOpeningLine(summary, season)
    const followThrough = getFollowThroughLine(summary, season)

    return [opening, followThrough].filter(Boolean).join(' ')
}

function getOpeningLine(
    summary: ExtendedWeeklySummary,
    season: SocialSeason | null
): string {
    if (summary.totalWeaves === 0) {
        if (season === 'resting') {
            return 'This was a quiet week in your weave, and that slower pace may have been exactly what this season was asking of you.'
        }

        return 'This was a quiet week in your weave, with more space than momentum.'
    }

    if (summary.totalWeaves >= 5) {
        return `There was real momentum this week, with ${summary.totalWeaves} weaves across ${summary.friendsContacted} connections.`
    }

    if (summary.totalWeaves >= 3) {
        return `This week felt steady, with ${summary.totalWeaves} weaves across ${summary.friendsContacted} friend${summary.friendsContacted === 1 ? '' : 's'}.`
    }

    return `It was a lighter week, but the ${summary.totalWeaves} connection${summary.totalWeaves === 1 ? '' : 's'} you made still shaped the tone.`
}

function getFollowThroughLine(
    summary: ExtendedWeeklySummary,
    season: SocialSeason | null
): string {
    const mostActiveFriend = summary.friendActivity[0]
    if (mostActiveFriend && mostActiveFriend.weaveCount > 1) {
        return `${mostActiveFriend.friendName} stood out as a steady thread through the week.`
    }

    const reconnection = summary.reconnections[0]
    if (reconnection) {
        return `Reconnecting with ${reconnection.friendName} seems to have added a meaningful note to the week.`
    }

    const missedFriend = summary.missedFriends[0]
    if (missedFriend) {
        return `${missedFriend.friend.name} may be worth keeping in mind as you move into next week.`
    }

    switch (season) {
        case 'blooming':
            return 'There is energy here, so it may be worth following the connections that leave you feeling most alive.'
        case 'resting':
            return 'Let the quieter rhythm be enough for now, and trust that steadiness can return gently.'
        default:
            return 'Even when the week feels ordinary, the rhythm you are building still matters.'
    }
}
