import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0"

/**
 * Send Push Notification Edge Function
 * 
 * Sends Expo push notifications to users when:
 * - Someone shares a weave with them
 * - Someone sends/accepts a link request
 * 
 * Called by database triggers or directly via HTTP POST.
 */

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface PushPayload {
    type: 'shared_weave' | 'link_request' | 'link_accepted'
    recipient_user_id: string
    title: string
    body: string
    data?: Record<string, unknown>
}

serve(async (req) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const authHeader = req.headers.get('Authorization') || ''
        const token = authHeader.replace('Bearer ', '').trim()
        const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''

        // Restrict this endpoint to trusted server-side callers only.
        if (!token || token !== serviceRoleKey) {
            return new Response(
                JSON.stringify({ error: 'Unauthorized' }),
                { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        const payload: PushPayload = await req.json()

        if (!payload.recipient_user_id || !payload.title) {
            return new Response(
                JSON.stringify({ error: 'Missing required fields' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Create Supabase client with service role for full access
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!
        const supabase = createClient(supabaseUrl, serviceRoleKey)

        // Get push tokens for the recipient
        const { data: tokens, error: tokenError } = await supabase
            .from('user_push_tokens')
            .select('push_token')
            .eq('user_id', payload.recipient_user_id)

        if (tokenError) {
            console.error('Error fetching push tokens:', tokenError)
            return new Response(
                JSON.stringify({ error: 'Failed to fetch push tokens' }),
                { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        if (!tokens || tokens.length === 0) {
            console.log('No push tokens found for user:', payload.recipient_user_id)
            return new Response(
                JSON.stringify({ message: 'No push tokens found', sent: 0 }),
                { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Send to Expo push notification service
        const expoPushUrl = 'https://exp.host/--/api/v2/push/send'

        const messages = tokens.map(t => ({
            to: t.push_token,
            title: payload.title,
            body: payload.body,
            data: {
                type: payload.type,
                ...payload.data,
            },
            sound: 'default',
            priority: 'high',
        }))

        const expoResponse = await fetch(expoPushUrl, {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Accept-Encoding': 'gzip, deflate',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(messages),
        })

        const expoResult = await expoResponse.json()

        console.log('Expo push result:', expoResult)

        return new Response(
            JSON.stringify({
                success: true,
                sent: tokens.length,
                result: expoResult,
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

    } catch (error) {
        console.error('Error sending push notification:', error)
        return new Response(
            JSON.stringify({ error: error.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
})
