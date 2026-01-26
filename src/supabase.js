import { createClient } from '@supabase/supabase-js';

// 1. Load Environment Variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// 2. Debugging Log (Check your browser console after saving this)
console.log("🔌 Supabase Config Check:");
console.log("   - URL:", supabaseUrl ? supabaseUrl : "❌ MISSING");
console.log("   - Key:", supabaseKey ? "✅ Present" : "❌ MISSING");

// 3. Validation
if (!supabaseUrl || !supabaseKey) {
    console.error("🚨 CRITICAL ERROR: Supabase environment variables are missing!");
    console.error("   - Make sure your .env file exists in the project root.");
    console.error("   - Make sure variables start with VITE_ (e.g. VITE_SUPABASE_URL)");
    throw new Error("Supabase URL or Key is missing.");
}

// 4. Create Client
export const supabase = createClient(supabaseUrl, supabaseKey);