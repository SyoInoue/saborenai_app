# X API セットアップ手順

> **このドキュメントは開発者が手動で行う作業の手順書です。**
> Claude Codeでは自動化できません。

## 1. X Developer Portal でアプリ作成

### 1.1 Developer アカウント申請

1. https://developer.x.com/en/portal/dashboard にアクセス
2. Xアカウントでログイン
3. Free プランで申請（MVP十分）
   - Free tier: 1,500 tweets/月, 1アプリ
4. 利用目的記入例:
   - "Building a habit tracking app that posts accountability tweets on behalf of users who miss their daily goals. Users explicitly authorize posting through OAuth 2.0."

### 1.2 アプリ作成

1. Dashboard → 「+ Add App」
2. App name: `Sabo-Renai Habit App`
3. メモするキー:
   - **Client ID** (OAuth 2.0)
   - **Client Secret** (OAuth 2.0)

### 1.3 OAuth 2.0 設定

App Settings → User authentication settings → Edit:

| 項目 | 値 |
|------|-----|
| App permissions | **Read and write** |
| Type of App | **Native App** (Public client) |
| Callback URI | `saboapp://oauth/callback` |
| Website URL | `https://example.com`（仮） |

### 1.4 重要な注意事項

- Free tier制限: 月1,500ツイート（全ユーザー合計）、1アプリ
- Rate limit: 50 requests / 15 min (POST /2/tweets)
- 画像アップロード (`media/upload`) はv1.1。Free tierでアクセス不可の場合Basic ($100/月) が必要
- ユーザー増加時はBasic移行を検討

## 2. Supabase 環境変数に設定

```bash
supabase secrets set X_CLIENT_ID=your_client_id
supabase secrets set X_CLIENT_SECRET=your_client_secret
supabase secrets set EXPO_PUSH_ACCESS_TOKEN=your_expo_push_token
```

## 3. OAuth 2.0 PKCE 技術詳細

### 3.1 認証URL

```
https://twitter.com/i/oauth2/authorize
  ?response_type=code
  &client_id={CLIENT_ID}
  &redirect_uri=saboapp://oauth/callback
  &scope=tweet.read%20tweet.write%20users.read%20offline.access
  &state={random_state}
  &code_challenge={code_challenge}
  &code_challenge_method=S256
```

### 3.2 Token交換

```
POST https://api.twitter.com/2/oauth2/token
Content-Type: application/x-www-form-urlencoded

grant_type=authorization_code&code={code}&redirect_uri=saboapp://oauth/callback&client_id={CLIENT_ID}&code_verifier={code_verifier}
```

### 3.3 Token リフレッシュ

```
POST https://api.twitter.com/2/oauth2/token
Content-Type: application/x-www-form-urlencoded

grant_type=refresh_token&refresh_token={refresh_token}&client_id={CLIENT_ID}
```

### 3.4 ツイート投稿

```json
POST https://api.twitter.com/2/tweets
Authorization: Bearer {access_token}

{"text": "私はサボりました。だらしのない人間です。 #サボれない習慣化アプリ"}
```

### 3.5 画像付きツイート

```
Step 1: POST https://upload.twitter.com/1.1/media/upload.json (multipart, media_data=base64)
Step 2: POST https://api.twitter.com/2/tweets (text + media.media_ids)
```

## 4. テスト方法

- テスト用Xアカウントを別途作成推奨
- 習慣の期限を数分後に設定 → 未完了 → ペナルティ確認
- テスト後はツイート手動削除

## 5. App Store審査の注意点

- 審査用テストXアカウントを用意
- ペナルティ投稿に「ユーザーの明示的同意」があることを審査メモに記載
- オンボーディング同意画面のスクリーンショットを添付
