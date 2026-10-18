import { useEffect, useRef } from 'react';
import { Animated, Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NavigationButton } from '@/shared/NavigationButton';
import { colors } from '@/shared/theme';
import ComposeReview from './ComposeReview';
export function ReviewLayer({ bookId, close }: { bookId: string; close: () => void }) {
  const top = useRef(new Animated.Value(-260)).current, insets = useSafeAreaInsets();
  useEffect(() => { const animation = Animated.timing(top, { toValue: 0, duration: 220, useNativeDriver: Platform.OS !== 'web' }); animation.start(); return () => animation.stop(); }, [top]);
  return <Modal visible transparent animationType="none" onRequestClose={close}>
    <View style={{ flex: 1, paddingTop: Math.max(12, insets.top), alignItems: 'center' }}>
      <Pressable accessibilityRole="button" accessibilityLabel="感想画面を閉じる" onPress={close} style={StyleSheet.absoluteFill} />
      <Animated.View accessibilityViewIsModal style={{ width: '100%', maxWidth: 760, height: '88%', backgroundColor: colors.paper, borderRadius: 18, overflow: 'hidden', transform: [{ translateY: top }], boxShadow: '0 4px 20px rgba(41,46,41,0.15)' }}>
        <View style={{ alignItems: 'flex-end', padding: 8 }}><NavigationButton close label="閉じる" onPress={close} /></View>
        <ComposeReview initialBookId={bookId} embedded />
      </Animated.View>
    </View>
  </Modal>;
}
