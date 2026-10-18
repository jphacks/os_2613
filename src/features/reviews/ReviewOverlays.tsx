import { ReviewCard } from './ui';
import type { Review } from './model.mjs';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { NavigationButton } from '@/shared/NavigationButton';
import { colors } from '@/shared/theme';
import BookReviews from './BookReviews';
import { ProfilePanel } from './ProfilePanel';
export type ReviewPerson = { did: string; name: string; handle: string; avatar?: string };
export function ReviewOverlays({ bookId, person, post, close }: { bookId?: string | null; person?: ReviewPerson | null; post?: Review | null; close: () => void }) {
  if (!bookId && !person && !post) return null;
  return <Modal transparent visible animationType="fade" onRequestClose={close}><View style={s.backdrop}>
    <Pressable accessibilityRole="button" accessibilityLabel="閉じる" style={StyleSheet.absoluteFill} onPress={close} />
    <View style={s.sheet}>{post ? <><View style={s.close}><NavigationButton close onPress={close} label="閉じる" /></View><ScrollView><ReviewCard review={post} expanded beforeNavigate={close} /></ScrollView></> : bookId ? <BookReviews bookId={bookId} close={close} /> : <><View style={s.close}><NavigationButton close onPress={close} label="閉じる" /></View><ProfilePanel actor={person!} /></>}</View>
  </View></Modal>;
}
const s = StyleSheet.create({ backdrop: { flex: 1, backgroundColor: 'rgba(41,46,41,0.22)', justifyContent: 'center', alignItems: 'center', padding: 16 }, sheet: { width: '100%', maxWidth: 720, height: '88%', maxHeight: 850, backgroundColor: colors.surface, borderRadius: 22, overflow: 'hidden' }, close: { flexDirection: 'row', justifyContent: 'flex-end', padding: 10 } });
