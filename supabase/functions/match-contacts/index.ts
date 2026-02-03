import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
        const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
        const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        const authHeader = req.headers.get('Authorization') || ''
        const token = authHeader.replace('Bearer ', '').trim()

        if (!token) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 401,
            })
        }

        // Validate caller is an authenticated user.
        const authClient = createClient(supabaseUrl, anonKey, {
            global: { headers: { Authorization: authHeader } },
            auth: {
                persistSession: false,
                autoRefreshToken: false,
                detectSessionInUrl: false,
            },
        })

        const { data: authData, error: authError } = await authClient.auth.getUser(token)
        if (authError || !authData?.user) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 401,
            })
        }

        const { phone_hashes } = await req.json()

        if (!phone_hashes || !Array.isArray(phone_hashes) || phone_hashes.length === 0) {
            return new Response(JSON.stringify({ matches: [] }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200,
            })
        }

        // Limit batch size to prevent abuse/timeouts
        if (phone_hashes.length > 2000) {
            throw new Error('Batch size too large (max 2000)')
        }

        // Validate and dedupe to reduce abuse/enumeration attempts.
        const uniqueHashes = Array.from(new Set(
            phone_hashes
                .filter((hash: unknown): hash is string => typeof hash === 'string')
                .map(hash => hash.trim().toLowerCase())
                .filter(hash => /^[a-f0-9]{64}$/.test(hash))
        ))

        if (uniqueHashes.length === 0) {
            return new Response(JSON.stringify({ matches: [] }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200,
            })
        }

        // Create a Supabase client with the Service Role Key
        const supabaseClient = createClient(
            supabaseUrl,
            serviceRoleKey
        )

        // Query for matches
        const { data, error } = await supabaseClient
            .from('user_profiles')
            .select('id, display_name, photo_url, phone_hash')
            .in('phone_hash', uniqueHashes)
            .limit(100) // Cap results for MVP

        if (error) throw error

        // Map to client-friendly format
        const matches = data.map(profile => ({
            user_id: profile.id,
            phone_hash: profile.phone_hash,
            // Only return minimal info needed for "People You May Know"
            photo_url: profile.photo_url,
            // Note: We intentionally DO NOT return the plain phone number or full name if not needed,
            // but for "People You May Know" we might need a name. 
            // The client has the contact name, so usually we'd rely on that, but having the profile name helps confirm.
        }))

        return new Response(JSON.stringify({ matches }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        })

    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        })
    }
})
