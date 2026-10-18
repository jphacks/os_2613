# ドパBOOKs ブランド画像

アプリ・Web・発表資料などで使うロゴ画像です。選定した5枚を元のPNGのまま保存しています。

| ファイル | 内容 |
| --- | --- |
| `logo-white-on-green.png` | 緑背景・白のシンボル＋文字 |
| `wordmark-white-on-green.png` | 緑背景・白の文字のみ（横長） |
| `symbol-white-on-green.png` | 緑背景・白のシンボルのみ |
| `logo-green-on-white.png` | 白背景・緑のシンボル＋文字 |
| `logo-green-on-cream.png` | クリーム背景・緑のシンボル＋文字 |

いずれも背景付きです。透明背景の画像ではありません。
縦横比を保ったまま拡大縮小し、用途に応じて選んでください。
ここへ保存するだけでは、アプリのアイコンや画面の画像は切り替わりません。

React Nativeでの使用例：

```tsx
<Image
  source={require('../../../assets/branding/logo-white-on-green.png')}
  style={{ width: 160, height: 160 }}
  resizeMode="contain"
/>
```

requireの相対パスは、呼び出すファイルの位置に合わせて調整してください。
