/**
 * Supabaseクライアントの初期化
 * AsyncStorageを使用してセッションを永続化する
 */

import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/constants/config';

/**
 * Supabaseクライアントのシングルトンインスタンス
 * AsyncStorageによりセッションがアプリ再起動後も維持される
 */
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
