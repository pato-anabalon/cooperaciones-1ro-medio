import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null | undefined;

export function getSupabaseServerClient() {
  if (client !== undefined) {
    return client;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;

  client =
    url && secretKey
      ? createClient(url, secretKey, {
          auth: { autoRefreshToken: false, persistSession: false },
        })
      : null;

  return client;
}
