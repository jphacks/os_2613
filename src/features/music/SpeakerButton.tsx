import { Pressable } from 'react-native';
import { AppIcon } from '@/shared/AppIcon';
import { colors } from '@/shared/theme';
export function SpeakerButton({ enabled, onToggle, disabled = false }: { enabled: boolean; disabled?: boolean; onToggle: () => void }) {
  return <Pressable accessibilityRole="switch" accessibilityLabel="BGMのオン・オフ" aria-checked={enabled} accessibilityState={{ checked: enabled, disabled }} disabled={disabled} hitSlop={6} onPress={onToggle} style={{ opacity: disabled ? .4 : 1, width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 20, backgroundColor: colors.button }}><AppIcon name={enabled ? 'volume_up' : 'volume_off'} /></Pressable>;
}
