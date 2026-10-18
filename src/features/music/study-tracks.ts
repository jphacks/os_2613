import type { AudioSource } from 'expo-audio';

type StudyTrack = { id: string; title: string; description: string; source: AudioSource };

// Expoが端末へ音源を同梱できるよう、requireのパスは静的に指定する。
export const studyTracks: StudyTrack[] = [
  { id: 'bgm262', title: '集中BGM 1', description: 'BGM262 · 3分46秒', source: require('../../../assets/audio/study-bgm/BGM262_Mixdown.wav') },
  { id: 'bgm264', title: '集中BGM 2', description: 'BGM264 · 3分50秒', source: require('../../../assets/audio/study-bgm/BGM264_Mixdown.wav') },
];
