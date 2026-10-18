import type { AudioSource } from 'expo-audio';

type StudyTrack = { id: string; title: string; description: string; source: AudioSource };

// 音源の準備後、null を静的な require('../../../assets/audio/study-bgm/曲名.wav') に置き換える。
// 未配置ファイルを require すると、教材を開く前にアプリのビルドが止まるため空にしておく。
export const studyTracks: StudyTrack[] = [
  { id: 'bossa-nova', title: 'ボサノバ', description: '軽やかなリズムで勉強', source: null },
  { id: 'nature', title: '自然', description: '自然の音でひと息', source: null },
  { id: 'classical', title: 'クラシック', description: '落ち着いた旋律とともに', source: null },
];
