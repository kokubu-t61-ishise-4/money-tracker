import { createClient, SupabaseClient } from "@supabase/supabase-js";

let supabaseInstance: SupabaseClient | null = null;

export function getSupabase() {
  if (!supabaseInstance) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error("Supabase credentials not configured");
    }

    supabaseInstance = createClient(supabaseUrl, supabaseAnonKey);
  }
  return supabaseInstance;
}

export type Account = {
  id: string;
  name: string;
  balance: number;
  sort_order: number;
  created_at: string;
};

export type MonthlyBill = {
  id: string;
  name: string;
  amount: number;
  due_day: number;
  account_id: string | null;
  created_at: string;
};

export type Budget = {
  id: string;
  name: string;
  monthly_amount: number;
  created_at: string;
};

export type Transaction = {
  id: string;
  date: string;
  category: string;
  description: string | null;
  amount: number;
  account_id: string | null;
  is_income: boolean;
  created_at: string;
};

export type Cash = {
  id: string;
  location: string;
  yen_10000: number;
  yen_5000: number;
  yen_1000: number;
  yen_other: number;
  created_at: string;
};
