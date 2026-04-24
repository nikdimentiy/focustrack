import { createClient } from '@supabase/supabase-js';

const URL = 'https://zyzupcoiuepydzpppwqa.supabase.co';
const KEY = 'sb_publishable_rNjPmhJuViV4CqjMmEFhZg_zi178cF4';

export const sb = createClient(URL, KEY);
