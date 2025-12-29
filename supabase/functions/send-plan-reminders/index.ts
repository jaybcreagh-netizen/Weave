import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0"

/**
 * Send Plan Reminders Edge Function
 * 
 * Runs on a schedule (pg_cron) to send push notifications
 * to all participants of upcoming shared plans.
 * 
 * - Finds shared_weaves with weave_date within 1 hour
 * - Sends push to creator AND all participants
 * - Tracks sent reminders to prevent duplicates
 */

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!
        const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        const supabase = createClient(supabaseUrl, serviceRoleKey)

        const now = new Date()
        const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000)

        // Find shared weaves happening in the next hour that haven't had reminders sent
        const { data: upcomingWeaves, error: queryError } = await supabase
            .from('shared_weaves')
            .select(`
                id,
                title,
                weave_date,
                creator_user_id,
                shared_weave_participants!inner(user_id, status)
            `)
            .gte('weave_date', now.toISOString())
            .lte('weave_date', oneHourFromNow.toISOString())

        if (queryError) {
            console.error('Error querying shared_weaves:', queryError)
            return new Response(
                JSON.stringify({ error: 'Failed to query shared weaves' }),
                { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        if (!upcomingWeaves || upcomingWeaves.length === 0) {
            console.log('No upcoming shared weaves found')
            return new Response(
                JSON.stringify({ message: 'No upcoming weaves', sent: 0 }),
                { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        let totalSent = 0
        const expoPushUrl = 'https://exp.host/--/api/v2/push/send'

        for (const weave of upcomingWeaves) {
            // Collect all user IDs to notify (creator + accepted participants)
            const userIds = new Set<string>()
            userIds.add(weave.creator_user_id)

            for (const participant of weave.shared_weave_participants) {
                if (participant.status === 'accepted') {
                    userIds.add(participant.user_id)
                }
            }

            // Check which users haven't received a reminder yet
            const { data: existingReminders } = await supabase
                .from('shared_weave_reminders')
                .select('user_id')
                .eq('shared_weave_id', weave.id)
                .eq('reminder_type', 'one_hour')

            const alreadySent = new Set(existingReminders?.map(r => r.user_id) || [])

            for (const userId of userIds) {
                if (alreadySent.has(userId)) {
                    console.log(`Skipping ${userId} - already sent reminder`)
                    continue
                }

                // Get push tokens for this user
                const { data: tokens } = await supabase
                    .from('user_push_tokens')
                    .select('push_token')
                    .eq('user_id', userId)

                if (!tokens || tokens.length === 0) {
                    console.log(`No push tokens for user ${userId}`)
                    continue
                }

                // Get friend name for notification body
                const { data: profile } = await supabase
                    .from('user_profiles')
                    .select('display_name, username')
                    .eq('id', weave.creator_user_id)
                    .single()

                const creatorName = profile?.display_name || profile?.username || 'Your friend'
                const weaveTime = new Date(weave.weave_date).toLocaleTimeString('en-US', {
                    hour: 'numeric',
                    minute: '2-digit',
                    hour12: true
                })

                // Send push notification
                const messages = tokens.map(t => ({
                    to: t.push_token,
                    title: `Reminder: ${weave.title || 'Upcoming plans'} 🗓️`,
                    body: `With ${creatorName} at ${weaveTime}`,
                    data: {
                        type: 'plan_reminder',
                        sharedWeaveId: weave.id,
                    },
                    sound: 'default',
                    priority: 'high',
                }))

                const expoResponse = await fetch(expoPushUrl, {
                    method: 'POST',
                    headers: {
                        'Accept': 'application/json',
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(messages),
                })

                const expoResult = await expoResponse.json()
                console.log(`Sent reminder to ${userId}:`, expoResult)

                // Record that we sent this reminder
                await supabase.from('shared_weave_reminders').insert({
                    shared_weave_id: weave.id,
                    user_id: userId,
                    reminder_type: 'one_hour',
                })

                totalSent++
            }
        }

        return new Response(
            JSON.stringify({
                success: true,
                weavesProcessed: upcomingWeaves.length,
                remindersSent: totalSent,
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

    } catch (error) {
        console.error('Error in send-plan-reminders:', error)
        return new Response(
            JSON.stringify({ error: error.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
})
