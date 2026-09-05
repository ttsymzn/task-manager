# task-manager

ターミナル風の見た目のタスク管理Webアプリ。GitHub Pages(静的ホスティング)+ Supabase(データベース・認証)構成。
メール/パスワードでログインすれば、どの端末からでも同じタスクにアクセスできます。

## 1. Supabaseプロジェクトを作成する

1. https://supabase.com で新規プロジェクトを作成
2. 左メニュー「SQL Editor」を開き、[`supabase/schema.sql`](supabase/schema.sql) の内容をすべて貼り付けて実行
   - `tasks` テーブル、Row Level Security(自分の行しか読み書きできない設定)、複数端末同期用のRealtime設定が作成されます
3. 左メニュー「Authentication」→「Providers」で Email が有効になっていることを確認
   - 個人利用でメール確認を省略したい場合は「Authentication」→「Providers」→「Email」→「Confirm email」をオフにすると、サインアップ後すぐログインできます
4. 左メニュー「Project Settings」→「API」から以下をコピー
   - `Project URL`
   - `anon public` キー

## 2. アプリに認証情報を設定する

[`docs/config.js`](docs/config.js) を編集し、取得した値を貼り付けます。

```js
window.SUPABASE_URL = 'https://xxxxxxxx.supabase.co';
window.SUPABASE_ANON_KEY = 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';
```

`anon public` キーは公開されて問題ないキーです(実際のアクセス制御はRLSポリシーで行われます)。

## 3. ローカルで動作確認する

`docs/` フォルダを任意の静的サーバーで配信して開いてください。例:

```bash
npx serve docs
```

## 4. GitHubにpushしてPagesを有効化する

1. GitHubで新しいリポジトリを作成(公開リポジトリ。無料プランではPagesの公開範囲を非公開にはできません)
2. このフォルダをそのリポジトリにpush
3. リポジトリの Settings → Pages で、Source を「Deploy from a branch」、Branch を `main` / `docs` フォルダに設定
4. 数分後、`https://<ユーザー名>.github.io/<リポジトリ名>/` でアクセス可能になります

## 5. 既存タスクの移行

以前ローカルサーバー版で使っていたタスクは `tasks_backup.csv`(このリポジトリの外、作業フォルダ直下)にエクスポート済みです。個人のタスク内容なのでリポジトリには含めていません。
Supabase設定後、アプリ画面右上の `csv import` ボタンからこのファイルを読み込めば、同じ内容を一括で登録できます。

## スマホでアプリとして使う(PWA)

このアプリはPWA(Progressive Web App)化されているため、ブラウザから「ホーム画面に追加」するとアイコン付きのアプリのように使えます。

- **iPhone(Safari)**: サイトを開き、共有ボタン → 「ホーム画面に追加」
- **Android(Chrome)**: サイトを開き、メニュー(⋮) → 「アプリをインストール」または「ホーム画面に追加」

ホーム画面から起動するとアドレスバーのないアプリ画面(standalone表示)になり、静的ファイルはオフラインでもキャッシュから表示されます(タスクデータの読み書きにはネット接続とSupabaseへのアクセスが必要です)。

## 注意事項

- GitHub Pagesの公開URLは誰でもアクセスできますが、ログインしなければタスクは見えません。ただし新規登録(サインアップ)自体は誰でも行える状態です。第三者に使われたくない場合は、Supabaseの「Authentication」→「Providers」→「Email」でサインアップを無効化する、あるいは招待制にするなどの追加設定を検討してください。
- テキストスパンディングのスニペット設定は端末のブラウザ(localStorage)に保存されるため、端末ごとに個別設定になります。タスクデータのみSupabaseで同期されます。
