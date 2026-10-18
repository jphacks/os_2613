import { Image } from 'expo-image';
import { colors } from './theme';
const icons = {
  close: require('../../assets/icons/material/close.svg'),
  arrow_back: require('../../assets/icons/material/arrow_back.svg'),
  settings: require('../../assets/icons/material/settings.svg'),
  music_note: require('../../assets/icons/material/music_note.svg'),
  format_size: require('../../assets/icons/material/format_size.svg'),
  zoom_in: require('../../assets/icons/material/zoom_in.svg'),
  refresh: require('../../assets/icons/material/refresh.svg'),
  search: require('../../assets/icons/material/search.svg'),
  play_arrow: require('../../assets/icons/material/play_arrow.svg'),
  pause: require('../../assets/icons/material/pause.svg'),
  info: require('../../assets/icons/material/info.svg'),
  menu: require('../../assets/icons/material/menu.svg'),
} as const;

/** Google Material Symbols Rounded. Shared across web and native. */
export function AppIcon({ name, size = 24, color = colors.accent }: { name: keyof typeof icons; size?: number; color?: string }) {
  return <Image source={icons[name]} tintColor={color} contentFit="contain" style={{ width: size, height: size }} accessibilityElementsHidden />;
}
