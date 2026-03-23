/**
 * 習慣管理カスタムフック
 * 習慣のCRUD操作とリアルタイム購読を提供する
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';
import type { Habit, HabitFormData, HabitLog, HabitWithLog, HabitCardStatus, WeekDay } from '@/types';

/**
 * 今日の曜日番号を取得する（0=日曜日）
 */
function getTodayWeekday(): WeekDay {
  return new Date().getDay() as WeekDay;
}

/**
 * 今日の日付文字列を取得する（YYYY-MM-DD）
 */
function getTodayString(): string {
  const today = new Date();
  return today.toISOString().split('T')[0];
}

/**
 * 習慣の期限日時を計算する（今日の日付 + deadline_time）
 */
function calcDeadlineAt(targetDate: string, deadlineTime: string): string {
  return `${targetDate}T${deadlineTime}+09:00`;
}

/**
 * HabitLog と現在時刻から表示ステータスを判定する
 */
function calcStatus(log: HabitLog | null, deadlineAt: string): HabitCardStatus {
  if (!log) return 'pending';
  if (log.completed_at) return 'completed';
  if (log.penalty_triggered) return 'penalized';
  if (new Date() > new Date(deadlineAt)) return 'overdue';
  return 'pending';
}

export function useHabits() {
  const { user } = useAuth();
  const [habits, setHabits] = useState<Habit[]>([]);
  const [todayLogs, setTodayLogs] = useState<HabitLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  // 複数箇所でuseHabitsを使う際にチャンネル名が衝突しないよう一意IDを付与
  const channelSuffix = useRef(`${Date.now()}_${Math.random().toString(36).slice(2)}`).current;

  /**
   * 習慣一覧を取得する
   */
  const fetchHabits = useCallback(async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('habits')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('習慣取得エラー:', error);
      setIsLoading(false);
      return;
    }

    const result = (data ?? []) as Habit[];
    setHabits(result);

    // 習慣が0件の場合はログ待ちがないので即座にローディング完了
    // 1件以上の場合は upsertTodayLogs 完了後に isLoading=false になる
    if (result.length === 0) {
      setIsLoading(false);
    }
  }, [user]);

  /**
   * 今日のログを取得または作成する（UPSERT）
   */
  const upsertTodayLogs = useCallback(async (habitList: Habit[]) => {
    if (!user || habitList.length === 0) {
      setTodayLogs([]);
      // isLoading は fetchHabits 側で管理（ここでは触らない）
      return;
    }

    const today = getTodayString();
    const todayWeekday = getTodayWeekday();

    // 今日が繰り返し対象の習慣のみ
    const todayHabits = habitList.filter((h) => h.repeat_days.includes(todayWeekday));

    if (todayHabits.length === 0) {
      setTodayLogs([]);
      setIsLoading(false);
      return;
    }

    // 今日分のログをUPSERT
    const logsToUpsert = todayHabits.map((habit) => ({
      habit_id: habit.id,
      user_id: user.id,
      target_date: today,
      deadline_at: calcDeadlineAt(today, habit.deadline_time),
    }));

    const { error: upsertError } = await supabase
      .from('habit_logs')
      .upsert(logsToUpsert, { onConflict: 'habit_id,target_date', ignoreDuplicates: true });

    if (upsertError) {
      console.error('ログUPSERTエラー:', upsertError);
    }

    // 今日のログを取得
    const { data: logs, error: fetchError } = await supabase
      .from('habit_logs')
      .select('*')
      .eq('user_id', user.id)
      .eq('target_date', today);

    if (fetchError) {
      console.error('ログ取得エラー:', fetchError);
      setIsLoading(false);
      return;
    }

    setTodayLogs((logs ?? []) as HabitLog[]);
    setIsLoading(false);
  }, [user]);

  /**
   * 今日表示する習慣とログのリストを構築する
   */
  const todayHabitsWithLogs: HabitWithLog[] = habits
    .filter((h) => h.repeat_days.includes(getTodayWeekday()))
    .map((habit) => {
      const log = todayLogs.find((l) => l.habit_id === habit.id) ?? null;
      const deadlineAt = log?.deadline_at ?? calcDeadlineAt(getTodayString(), habit.deadline_time);
      const status = calcStatus(log, deadlineAt);
      return { habit, log, status };
    });

  /**
   * 習慣を追加する
   */
  const addHabit = async (formData: HabitFormData): Promise<void> => {
    if (!user) throw new Error('未認証');

    const { error } = await supabase.from('habits').insert({
      user_id: user.id,
      name: formData.name,
      deadline_time: `${formData.deadline_time}:00`, // HH:MM → HH:MM:SS
      repeat_days: formData.repeat_days,
      penalty_type: formData.penalty_type,
      penalty_text: formData.penalty_text,
      selfie_storage_path: formData.selfie_storage_path,
    });

    if (error) throw new Error(error.message);
    await fetchHabits();
  };

  /**
   * 習慣を削除する（論理削除）
   */
  const deleteHabit = async (habitId: string): Promise<void> => {
    const { error } = await supabase
      .from('habits')
      .update({ is_active: false })
      .eq('id', habitId);

    if (error) throw new Error(error.message);
    await fetchHabits();
  };

  /**
   * 習慣を完了にする
   */
  const completeHabit = async (logId: string): Promise<void> => {
    const now = new Date().toISOString();
    const { error } = await supabase
      .from('habit_logs')
      .update({ completed_at: now })
      .eq('id', logId);

    if (error) throw new Error(error.message);

    // ローカル状態を更新
    setTodayLogs((prev) =>
      prev.map((log) =>
        log.id === logId ? { ...log, completed_at: now } : log
      )
    );
  };

  // 初期データ取得
  useEffect(() => {
    if (!user) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    fetchHabits();
  }, [user, fetchHabits]);

  // 習慣取得後にログをUPSERT
  useEffect(() => {
    upsertTodayLogs(habits);
  }, [habits, upsertTodayLogs]);

  // リアルタイムサブスクリプション
  useEffect(() => {
    if (!user) return;

    const habitsSubscription = supabase
      .channel(`habits_changes_${channelSuffix}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'habits', filter: `user_id=eq.${user.id}` },
        () => fetchHabits()
      )
      .subscribe();

    const logsSubscription = supabase
      .channel(`logs_changes_${channelSuffix}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'habit_logs', filter: `user_id=eq.${user.id}` },
        (payload) => {
          const updated = payload.new as HabitLog;
          setTodayLogs((prev) =>
            prev.map((log) => (log.id === updated.id ? updated : log))
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(habitsSubscription);
      supabase.removeChannel(logsSubscription);
    };
  }, [user, fetchHabits]);

  return {
    habits,
    todayHabitsWithLogs,
    isLoading,
    addHabit,
    deleteHabit,
    completeHabit,
    refetch: fetchHabits,
  };
}
