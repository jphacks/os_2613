# iPhoneのBluesky認証

公式 `@atproto/oauth-client-expo` を利用する。PKCE・DPoP・セッション更新はSDKに任せ、パスワードをアプリで受け取らない。AsyncStorageには復元用のDIDだけを保存する。

Web版は従来どおり `oauth.web.ts`。iOS/Androidは `oauth.ts` を利用する。`EXPO_PUBLIC_ATPROTO_NATIVE_CLIENT_ID` は公開情報であり秘密鍵ではない。EASのbaseプロファイルとローカル環境で同じ値を使う。

メタデータはExpo Hostingの認証専用サイトへ静的JSONとして配置する。本体のAPI・本棚・感想データをここへ配置しない。更新は `node scripts/export-oauth-metadata.mjs <公開JSON URL>` の出力をEAS Hostingへデプロイする。`application_type` は native、コールバックは公開ドメインを逆順にしたスキームに `/auth/callback` を付ける。`app.config.js` で同じスキームを追加する。

SDK・MMKV・NitroとURLスキームを追加したため、既存の開発ビルドでは使えない。新しいiPhone用ビルドをインストールする。認証画面を閉じた場合はキャンセルとして扱う。端末内の認証セッションはSDKが管理し、ログアウト時に失効させる。

確認項目：サインイン完了後の名前設定、アプリ再起動後の復元、キャンセル、ログアウト、投稿許可の追加。実際のBluesky認証と実機確認は利用者が行う。
