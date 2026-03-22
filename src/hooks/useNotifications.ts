/**
 * プッシュ通知カスタムフック
 * 通知権限の取得・push token保存・ローカルリマインダーのスケジュール管理
 */

import { useEffect, useCallback } from 'react';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';
import type { HabitWithLog } from '@/types';

// 通知受信時の表示設定
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export function useNotifications() {
  const { user } = useAuth();

  /**
   * 通知権限を要求し、Expo Push Tokenを取得してDBに保存する
   */
  const registerForPushNotifications = useCallback(async (): Promise<void> => {
    if (!user) return;

    // 権限要求
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('プッシュ通知の権限が拒否されました');
      return;
    }

    // Androidチャンネル設定
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'デフォルト',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
      });
    }

    // Expo Push Tokenを取得
    const tokenData = await Notifications.getExpoPushTokenAsync();
    const expoPushToken = tokenData.data;

    // DBに保存（既存と同じなら更新不要だがUPSERTで安全に処理）
    if (user.expo_push_token !== expoPushToken) {
      const { error } = await supabase
        .from('users')
        .update({ expo_push_token: expoPushToken })
        .eq('id', user.id);

      if (error) {
        console.error('Push Token保存エラー:', error);
      }
    }
  }, [user]);

  /**
   * 今日の習慣に対してリマインダー通知をスケジュールする（期限30分前）
   * 完了済みの習慣は通知をキャンセルする
   */
  const scheduleReminders = useCallback(async (todayHabits: HabitWithLog[]): Promise<void> => {
    for (const { habit, log, status } of todayHabits) {
      const notificationId = `reminder-${habit.id}`;

      // 完了済み or ペナルティ執行済みは通知キャンセル
      if (status === 'completed' || status === 'penalized' || status === 'overdue') {
        await cancelReminder(notificationId);
        continue;
      }

      if (!log?.deadline_at) continue;

      const deadlineTime = new Date(log.deadline_at).getTime();
      const reminderTime = deadlineTime - 30 * 60 * 1000; // 30分前

      // 過去の時刻はスキップ
      if (reminderTime <= Date.now()) continue;

      // 既存の通知をキャンセルして再スケジュール
      await cancelReminder(notificationId);

      await Notifications.scheduleNotificationAsync({
        identifier: notificationId,
        content: {
          title: '⏰ まだ完了していません！',
          body: `「${habit.name}」の期限まで残り30分です！急いで！`,
          sound: true,
          data: { habitId: habit.id },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: new Date(reminderTime),
        },
      });
    }
  }, []);

  /**
   * 指定IDの通知をキャンセルする
   */
  const cancelReminder = async (notificationId: string): Promise<void> => {
    try {
      await Notifications.cancelScheduledNotificationAsync(notificationId);
    } catch {
      // 存在しない通知のキャンセルは無視
    }
  };

  // オンボーディング完了後に通知登録
  useEffect(() => {
    if (user?.onboarding_completed) {
      registerForPushNotifications();
    }
  }, [user?.onboarding_completed, registerForPushNotifications]);

  return {
    registerForPushNotifications,
    scheduleReminders,
    cancelReminder,
  };
}
