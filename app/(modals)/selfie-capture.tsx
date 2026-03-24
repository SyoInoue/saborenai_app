/**
 * 自撮り撮影画面
 * インカメラで自撮りを撮影し、Supabase Storageに保存する
 *
 * mode=habit の場合: 習慣作成フロー用。tempStoreにパスを保存してback
 * mode未指定の場合: オンボーディング用。usersテーブルに保存してback
 */

import { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Image,
} from 'react-native';
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';
import { tempStore } from '@/lib/tempStore';
import { COLORS, SPACING } from '@/constants/config';

export default function SelfieCapture() {
  const router = useRouter();
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const isHabitMode = mode === 'habit';

  const { user, refreshUser } = useAuth();
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [capturedUri, setCapturedUri] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  if (!permission) {
    return <View style={styles.container} />;
  }

  if (!permission.granted) {
    return (
      <View style={styles.permissionContainer}>
        <Text style={styles.permissionText}>カメラへのアクセスが必要です</Text>
        <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
          <Text style={styles.permissionButtonText}>権限を許可する</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const takePicture = async () => {
    if (!cameraRef.current) return;
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.7, base64: false });
      if (photo) setCapturedUri(photo.uri);
    } catch (error) {
      console.error('撮影エラー:', error);
      Alert.alert('エラー', '写真の撮影に失敗しました。');
    }
  };

  const uploadSelfie = async () => {
    if (!capturedUri || !user) return;
    setIsUploading(true);
    try {
      const response = await fetch(capturedUri);
      const blob = await response.blob();

      // 習慣モードはユニークなパス、オンボーディングは固定パス
      const storagePath = isHabitMode
        ? `${user.id}/habit_${Date.now()}.jpg`
        : `${user.id}/penalty.jpg`;

      // タイムアウト対策: 最大3回リトライ
      let uploadError = null;
      for (let attempt = 1; attempt <= 3; attempt++) {
        const { error } = await supabase.storage
          .from('selfies')
          .upload(storagePath, blob, { contentType: 'image/jpeg', upsert: true });
        uploadError = error;
        if (!error) break;
        if (attempt < 3) await new Promise((r) => setTimeout(r, 1000 * attempt));
      }

      if (uploadError) throw new Error(uploadError.message);

      if (isHabitMode) {
        // 習慣モード: tempStoreにパスを保存して戻る
        tempStore.setSefliePath(storagePath);
        router.back();
      } else {
        // オンボーディングモード: usersテーブルを更新
        const { error: updateError } = await supabase
          .from('users')
          .update({ selfie_storage_path: storagePath })
          .eq('id', user.id);
        if (updateError) throw new Error(updateError.message);
        await refreshUser();
        router.back();
      }
    } catch (error) {
      console.error('アップロードエラー:', error);
      Alert.alert('エラー', '写真のアップロードに失敗しました。もう一度お試しください。');
    } finally {
      setIsUploading(false);
    }
  };

  if (capturedUri) {
    return (
      <View style={styles.container}>
        <Image source={{ uri: capturedUri }} style={styles.preview} />
        <View style={styles.previewActions}>
          <Text style={styles.previewTitle}>この顔でいいですか？😅</Text>
          <Text style={styles.previewSubtitle}>サボった時にXでこの顔が晒されます</Text>
          <TouchableOpacity
            style={[styles.useButton, isUploading && styles.buttonDisabled]}
            onPress={uploadSelfie}
            disabled={isUploading}
          >
            {isUploading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.useButtonText}>この写真を使う</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.retakeButton}
            onPress={() => setCapturedUri(null)}
            disabled={isUploading}
          >
            <Text style={styles.retakeButtonText}>撮り直す</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView ref={cameraRef} style={styles.camera} facing={'front' as CameraType}>
        <View style={styles.cameraOverlay}>
          <Text style={styles.cameraInstruction}>😱 サボった時のダメな顔を撮っておこう</Text>
          <View style={styles.captureArea}>
            <View style={styles.captureFrame} />
          </View>
          <TouchableOpacity style={styles.captureButton} onPress={takePicture}>
            <View style={styles.captureButtonInner} />
          </TouchableOpacity>
        </View>
      </CameraView>
      <TouchableOpacity style={styles.cancelButton} onPress={() => router.back()}>
        <Text style={styles.cancelText}>キャンセル</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000' },
  permissionContainer: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    backgroundColor: COLORS.background, padding: SPACING.xl,
  },
  permissionText: { fontSize: 16, color: COLORS.text, textAlign: 'center', marginBottom: SPACING.lg },
  permissionButton: {
    backgroundColor: COLORS.primary, borderRadius: 12,
    paddingVertical: SPACING.md, paddingHorizontal: SPACING.xl,
  },
  permissionButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' },
  camera: { flex: 1 },
  cameraOverlay: {
    flex: 1, justifyContent: 'space-between', alignItems: 'center', paddingVertical: SPACING.xl,
  },
  cameraInstruction: {
    color: '#FFFFFF', fontSize: 16, textAlign: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm, borderRadius: 8, marginTop: 60,
  },
  captureArea: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  captureFrame: {
    width: 280, height: 280, borderRadius: 140,
    borderWidth: 3, borderColor: 'rgba(255,255,255,0.7)',
  },
  captureButton: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.3)', justifyContent: 'center', alignItems: 'center',
    borderWidth: 3, borderColor: '#FFFFFF', marginBottom: 40,
  },
  captureButtonInner: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#FFFFFF' },
  preview: { flex: 1 },
  previewActions: { backgroundColor: COLORS.background, padding: SPACING.xl, paddingBottom: 48 },
  previewTitle: {
    fontSize: 22, fontWeight: 'bold', color: COLORS.text, textAlign: 'center', marginBottom: SPACING.xs,
  },
  previewSubtitle: {
    fontSize: 14, color: COLORS.textSecondary, textAlign: 'center', marginBottom: SPACING.lg,
  },
  useButton: {
    backgroundColor: COLORS.primary, borderRadius: 12, paddingVertical: SPACING.md,
    alignItems: 'center', marginBottom: SPACING.sm, minHeight: 52, justifyContent: 'center',
  },
  buttonDisabled: { opacity: 0.6 },
  useButtonText: { color: '#FFFFFF', fontSize: 17, fontWeight: 'bold' },
  retakeButton: {
    borderRadius: 12, paddingVertical: SPACING.md, alignItems: 'center',
    borderWidth: 1, borderColor: COLORS.border,
  },
  retakeButtonText: { color: COLORS.text, fontSize: 17 },
  cancelButton: {
    position: 'absolute', top: 60, right: SPACING.lg,
    backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 20,
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
  },
  cancelText: { color: '#FFFFFF', fontSize: 15 },
});
