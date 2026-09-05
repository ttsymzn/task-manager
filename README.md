# task-manager

ターミナル風の見た目のタスク管理Webアプリ。GitHub Pages(静的ホスティング)+ Supabase(データベース・認証)構成。
メール/パスワードでログインすれば、どの端末からでも同じタスク・スニペットにアクセスできます。

## 1. Supabaseプロジェクトを作成する

1. https://supabase.com で新規プロジェクトを作成
2. 左メニュー「SQL Editor」を開き、[`supabase/schema.sql`](supabase/schema.sql) の内容をすべて貼り付けて実行
   - `tasks` テーブル・`snippets` テーブル、Row Level Security、Realtimeの設定が作成されます
3. 左メニュー「Authentication」→「Providers」で Email が有効になっていることを確認
   - 個人利用でメール確認を省略したい場合は「Authentication」→「Providers」→「Email」→「Confirm email」をオフにすると、サインアップ後すぐログインできます
4. 左メニュー「Authentication」→「URL Configuration」で以下を設定
   - **Site URL**: `https://<ユーザー名>.github.io/<リポジトリ名>/`
   - **Redirect URLs**: 同じURLを追加
   - ※ これを設定しないと確認メールのリンクが正しく機能しません
5. 左メニュー「Project Settings」→「API」から以下をコピー
   - `Project URL`（例: `https://xxxxxxxx.supabase.co`）
   - `anon public` キー

## 2. アプリに認証情報を設定する

[`docs/config.js`](docs/config.js) を編集し、取得した値を貼り付けます。

```js
window.SUPABASE_URL = 'https://xxxxxxxx.supabase.co';
window.SUPABASE_ANON_KEY = 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';
```

**注意**: `SUPABASE_URL` はパスなしのベースURLのみを設定してください（`/rest/v1/` などを末尾に付けないでください）。

`anon public` キーは公開されて問題ないキーです(実際のアクセス制御はRLSポリシーで行われます)。

## 3. ローカルで動作確認する

`docs/` フォルダを任意の静的サーバーで配信して開いてください。例:

```bash
npx serve docs
```

## 4. GitHubにpushしてPagesを有効化する

1. GitHubで新しいリポジトリを作成(公開リポジトリ。無料プランではPagesの公開範囲を非公開にはできません)
2. このフォルダをそのリポジトリにpush
3. リポジトリの Settings → Pages で、Source を「Deploy from a branch」、Branch を `master`(または`main`) / `docs` フォルダに設定
4. 数分後、`https://<ユーザー名>.github.io/<リポジトリ名>/` でアクセス可能になります

## 5. 既存タスクの移行

以前ローカルサーバー版で使っていたタスクは `tasks_backup.csv`(このリポジトリの外、作業フォルダ直下)にエクスポート済みです。個人のタスク内容なのでリポジトリには含めていません。
Supabase設定後、アプリ画面右上の `csv import` ボタンからこのファイルを読み込めば、同じ内容を一括で登録できます。

## スマホでアプリとして使う(PWA)

このアプリはPWA(Progressive Web App)化されているため、ブラウザから「ホーム画面に追加」するとアイコン付きのアプリのように使えます。

- **iPhone(Safari)**: サイトを開き、共有ボタン → 「ホーム画面に追加」
- **Android(Chrome)**: サイトを開き、メニュー(⋮) → 「アプリをインストール」または「ホーム画面に追加」

ホーム画面から起動するとアドレスバーのないアプリ画面(standalone表示)になり、静的ファイルはオフラインでもキャッシュから表示されます(タスクデータの読み書きにはネット接続とSupabaseへのアクセスが必要です)。

スマホ向けUIとして、画面下部に操作ボタンが表示されます:

| ボタン | 動作 |
|--------|------|
| ▲ / ▼ | タスク間のカーソル移動 |
| edit / 保存 | タスクの編集開始・保存 |
| arch | アーカイブ切り替え |
| del | 削除（確認あり） |
| / / Esc | 検索を開く・編集や検索をキャンセル |

## 注意事項

- GitHub Pagesの公開URLは誰でもアクセスできますが、ログインしなければタスクは見えません。ただし新規登録(サインアップ)自体は誰でも行える状態です。第三者に使われたくない場合は、Supabaseの「Authentication」→「Providers」→「Email」でサインアップを無効化する、あるいは招待制にするなどの追加設定を検討してください。
- タスクデータ・テキストスパンディングのスニペット設定はどちらもSupabaseに保存され、全端末で同期されます。
