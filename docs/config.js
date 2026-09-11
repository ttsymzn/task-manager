// Supabase プロジェクトの認証情報をここに設定してください。
// Supabaseダッシュボード > Project Settings > API から取得できます。
// anon public key は「公開して良い」キーです(実際のアクセス制御はRLSポリシーで行われます)。
window.SUPABASE_URL = 'https://reseucxlakqlezkhyurr.supabase.co';
window.SUPABASE_ANON_KEY = 'sb_publishable_NjmbX9eTVdH9blKPDfGbGQ_6mLnxUwN';

// =========================================================
// Google Tasks 連携の設定
// =========================================================
// Google Cloud Console (https://console.cloud.google.com/) で以下を設定してください:
//   1. プロジェクトを作成 (または既存のプロジェクトを選択)
//   2. 「APIとサービス」>「ライブラリ」で「Google Tasks API」を有効化
//   3. 「APIとサービス」>「認証情報」>「+ 認証情報を作成」>「OAuthクライアントID」
//      - アプリケーションの種類: ウェブアプリケーション
//      - 承認済みのJavaScript生成元: このアプリのURL (例: https://yourdomain.github.io)
//      - ローカル開発の場合は http://localhost や http://127.0.0.1 も追加
//   4. 作成されたクライアントIDをここに貼り付けてください
window.GOOGLE_CLIENT_ID = '697621119828-5d26mt2ofhsv9ros2qh4qujls1sqafje.apps.googleusercontent.com'; // 例: '1234567890-xxxxxxxxxxxx.apps.googleusercontent.com'
