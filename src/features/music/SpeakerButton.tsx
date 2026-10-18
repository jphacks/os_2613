import { Pressable } from 'react-native';
import { AppIcon } from '@/shared/AppIcon';
import { colors } from '@/shared/theme';
export function SpeakerButton({ enabled, onToggle, disabled = false }: { enabled: boolean; disabled?: boolean; onToggle: () => void }) {
  return <Pressable accessibilityRole="switch" accessibilityLabel="BGMのオン・オフ" accessibilityState={{ checked: enabled, disabled }} disabled={disabled} onPress={onToggle} style={{ opacity: disabled ? .4 : 1, width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 20, backgroundColor: colors.button }}><AppIcon name={enabled ? 'volume_up' : 'volume_off'} /></Pressable>;
}
