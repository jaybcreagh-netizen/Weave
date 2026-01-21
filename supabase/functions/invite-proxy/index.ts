import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const TESTFLIGHT_URL = "https://testflight.apple.com/join/98z2aDtK";

serve(async (req) => {
    // Check for code OR userId
    const url = new URL(req.url)
    const code = url.searchParams.get('code')
    const userId = url.searchParams.get('userId')

    if (!code && !userId) {
        return new Response('Missing code or userId parameter', { status: 400 })
    }

    // Determine App Scheme URL
    let appUrl = '';
    if (code) {
        appUrl = `weave://invite/${code}`;
    } else if (userId) {
        appUrl = `weave://user/${userId}`;
    }

    // TestFlight Public Link (Fallback)
    const testFlightUrl = 'https://testflight.apple.com/join/gJ7LdCr9'

    // Basic HTML page with redirection logic
    const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Join me on Weave</title>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta property="og:title" content="Join me on Weave" />
    <meta property="og:description" content="Let's weave our lives together. Use this link to add me as a friend." />
    <!-- <meta property="og:image" content="..." /> -->
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 100vh;
            margin: 0;
            background-color: #f3f4f6;
            color: #1f2937;
            text-align: center;
        }
        .container {
            background: white;
            padding: 2rem;
            border-radius: 1rem;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
            max-width: 90%;
            width: 400px;
        }
        h1 { margin-bottom: 0.5rem; font-size: 1.5rem; }
        p { margin-bottom: 1.5rem; color: #4b5563; }
        .button {
            display: inline-block;
            background-color: #4f46e5;
            color: white;
            padding: 0.75rem 1.5rem;
            border-radius: 0.5rem;
            text-decoration: none;
            font-weight: 500;
            transition: background-color 0.2s;
        }
        .button:hover { background-color: #4338ca; }
    </style>
</head>
<body>
    <div class="container">
        <h1>Opening Weave...</h1>
        <p>If the app doesn't open automatically, click the button below.</p>
        <a id="openButton" href="${appUrl}" class="button">Open App</a>
        <p style="margin-top: 1rem; font-size: 0.875rem;">
            Don't have Weave? <a href="${TESTFLIGHT_URL}" style="color: #4f46e5;">Get it on TestFlight</a>
        </p>
    </div>

    <script>
        // Attempt to redirect to app
        window.location.href = "${appUrl}";

        // Fallback to TestFlight after a short delay if app didn't open
        // Note: This is an approximation. Modern mobile browsers make this tricky.
        // A common pattern is to wait a bit. If the page is still visible, user didn't switch apps.
        setTimeout(function() {
            // Check if page is still visible (basic heuristic)
           if (!document.hidden) {
               // Optional: Auto-redirect to TestFlight? 
               // Often better to let user click "Get it" link to avoid redirect loops if they just cancelled the dialog.
               // But user request asked for redirect.
               window.location.href = "${TESTFLIGHT_URL}"; 
           }
        }, 2500);
        
        // Ensure button also tries deep link
        document.getElementById('openButton').onclick = function(e) {
            setTimeout(function() {
                 window.location.href = "${TESTFLIGHT_URL}";
            }, 2500);
        };
    </script>
</body>
</html>
  `;

    return new Response(html, {
        headers: { "Content-Type": "text/html" },
    });
});
