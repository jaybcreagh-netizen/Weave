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

        // Create a Supabase client with the Service Role Key
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        // Query for matches
        const { data, error } = await supabaseClient
            .from('user_profiles')
            .select('id, display_name, photo_url, phone_hash')
            .in('phone_hash', phone_hashes)
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
