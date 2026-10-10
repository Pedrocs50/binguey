import { createBingueyClient } from "@binguey/shared";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!url || !key) {
  throw new Error("Faltam VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY (copie .env.example para .env.local).");
}

export const supabase = createBingueyClient(url, key);
