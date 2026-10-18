import type { AudioSource } from 'expo-audio';

type StudyTrack = { id: string; title: string; description: string; source: AudioSource };

// 自然音・ジャズはオンライン配信、集中BGM 1・2は同梱音源を使用する。
export const studyTracks: StudyTrack[] = [
  { id: 'nature-forest', title: '森', description: '自然音 · 森の音', source: { uri: 'https://dopabooks-auth--study-audio.expo.app/nature-forest.19600bcc68a9.mp3' } },
  { id: 'nature-campfire', title: '焚き火', description: '自然音 · 火のはぜる音', source: { uri: 'https://dopabooks-auth--study-audio.expo.app/nature-campfire.ef9fce8e9c16.mp3' } },
  { id: 'nature-rain', title: '雨', description: '自然音 · 雨の音', source: { uri: 'https://dopabooks-auth--study-audio.expo.app/nature-rain.21e3af270a58.mp3' } },
  { id: 'jazz-late-night', title: '遅い夜', description: 'ジャズ · 約82分', source: { uri: 'https://dopabooks-auth--study-audio.expo.app/jazz-late-night.4cac55c9e1f5.mp3' } },
  { id: 'jazz-stylish-night', title: 'おしゃれな夜', description: 'ジャズ · 約72分', source: { uri: 'https://dopabooks-auth--study-audio.expo.app/jazz-stylish-night.9365d273add2.mp3' } },
  { id: 'jazz-quiet-night', title: '静かな夜', description: 'ジャズ · 約68分', source: { uri: 'https://dopabooks-auth--study-audio.expo.app/jazz-quiet-night.dc6e2f18aaab.mp3' } },
  { id: 'bossa-nova', title: 'ボサノバ', description: '軽やかなリズムで勉強', source: null },
  { id: 'classical', title: 'クラシック', description: '落ち着いた旋律とともに', source: null },
  { id: 'bgm262', title: '集中BGM 1', description: 'BGM262 · 3分46秒', source: require('../../../assets/audio/study-bgm/BGM262_Mixdown.wav') },
  { id: 'bgm264', title: '集中BGM 2', description: 'BGM264 · 3分50秒', source: require('../../../assets/audio/study-bgm/BGM264_Mixdown.wav') },
];
