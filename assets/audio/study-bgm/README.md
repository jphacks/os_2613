# 教材の集中BGM

ボサノバ・自然・クラシックの音源をこのフォルダに配置します。
MP3限定ではありません。WAV・M4Aなども、利用する端末で再生できる形式なら使用できます。

## 音源の登録

1. 音源を配置します（例：`nature.wav`）。
2. `src/features/music/study-tracks.ts` の該当する `source: null` を次のように変更します。

```ts
source: require('../../../assets/audio/study-bgm/nature.wav')
```

ExpoがiOS・Android・Webへ音源を同梱できるよう、requireのパスは文字列で直接指定してください。
未配置ファイルを参照するとビルドできないため、音源追加前はnullにしています。
ファイル追加後は開発サーバーを再起動してください。

曲はループ再生されます。曲名・説明の変更や同じ種類の曲の追加も `study-tracks.ts` で行えます。
各項目のidは重複させないでください。音源そのものはまだ同梱していません。
