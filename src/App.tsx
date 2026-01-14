import {
  // createAmplifyAuthAdapter, // Amplify CLIで作成されたストレージへの接続時に使用するもの
  // 既存のバケットに接続するためには、このアダプターを使用せず、listLocations と getLocationCredentials を独自に実装する必要がある。
  createStorageBrowser,
  // StorageLocation, // StorageLocation 型は別の場所からインポート
} from '@aws-amplify/ui-react-storage/browser';
import '@aws-amplify/ui-react-storage/styles.css';
import './App.css';

import config from '../amplify_outputs.json';
import { Amplify } from 'aws-amplify';
import { Authenticator, Button } from '@aws-amplify/ui-react';
import { fetchAuthSession } from 'aws-amplify/auth'; // fetchAuthSession をインポート
import { StorageAccessLevel } from '@aws-amplify/core'; // StorageAccessLevel をインポート
import { Location } from '@aws-amplify/ui-react-storage/browser'; // StorageLocation -> Location に変更
// Amplifyの設定
Amplify.configure(config);

// ================================================================
// ここから getS3Locations 関数の定義
// ================================================================
async function getS3Locations(): Promise<{ items: StorageLocation[]; nextToken: string | undefined }> {
  // --- ★★★ 既存のバケット名に置き換えてください！ ★★★ ---
  const existingBucketName = 'genai-test-bucket-966330410768'; // 例: 'your-unique-existing-s3-bucket-name'
  const basePrefix = ''; // ルートから表示する場合は空文字列。
                         // 特定のフォルダ配下のみを表示したい場合は例: 'users/' または 'private/uploads/' など。

  console.log(`[getS3Locations] Configuring S3 locations for bucket: ${existingBucketName}/${basePrefix}`);

  return {
    items: [
      {
        id: 'external-data',          // このロケーションの一意なID
        bucket: existingBucketName,   // 既存の S3 バケット名
        prefix: basePrefix,           // S3 バケット内の起点となるパス (プレフィックス)
        type: 'PREFIX',               // 表示するタイプ。通常は 'PREFIX' (フォルダ)
        displayName: 'My External S3 Data', // UI 上に表示される名前
        level: 'private' as StorageAccessLevel, // S3パス構築時のアクセスレベル。
                                                 // `private`, `protected`, `public` のいずれか。
                                                 // IAM ロールと S3 バケットポリシーの設定に合わせることが重要です。
                                                 // `private` にすると、StorageBrowser は `private/{identityId}/` のパス構造を前提とすることがあります。
                                                 // もし `basePrefix` が S3 ルートからのフルパス（例: `my-folder/sub-folder/`）を意図している場合、
                                                 // `level` の挙動に注意し、IAMポリシーで適切にパスを許可してください。
                                                 // 今回のように空文字の場合、`private/ap-northeast-1:xxxxxxid/` のようなパスが自動生成される可能性があります。
                                                 // 実際のバケットポリシーや IAM ポリシーと StorageBrowser の S3 パス解決の挙動をよくテストしてください。
        permissions: ['delete', 'get', 'list', 'write'], // このロケーションでユーザーに許可する S3 操作
      },
      // 必要に応じて、追加のバケットやフォルダをここに定義できます
      // {
      //   id: 'another-folder',
      //   bucket: existingBucketName,
      //   prefix: 'another-path/',
      //   type: 'PREFIX',
      //   displayName: 'Project Files',
      //   level: 'public' as StorageAccessLevel,
      //   permissions: ['get', 'list'],
      // },
    ],
    nextToken: undefined, // ページングに使用。今回は不要
  };
}

// ================================================================
// ここから getLocationCredentials 関数の定義
// ================================================================
async function getLocationCredentials(
  input: Location
): Promise<GetCredentialsOutput> {
  try {
    console.log('[getLocationCredentials] Fetching credentials for:', input.bucket, input.prefix);
    const session = await fetchAuthSession();
    if (!session.credentials) {
      throw new Error('No credentials found for authenticated user. Please ensure the user is logged in.');
    }

    // @aws-amplify/ui-react-storage/browser から LocationCredentials 型をインポートするように修正
    import { LocationCredentials } from '@aws-amplify/ui-react-storage/browser'; // ここにインポートを追加

    // Amplify Auth から取得した認証済みユーザーの一時クレデンシャルをそのまま返します。
    // このクレデンシャルは、ユーザーの IAM ロールに紐付けられた権限に基づいて S3 にアクセスします。
    return {
      credentials: { // StorageBrowserが期待する形式に合わせる
        accessKeyId: session.credentials.accessKeyId,
        secretAccessKey: session.credentials.secretAccessKey,
        sessionToken: session.credentials.sessionToken || '',
      },
      expiration: session.credentials.expiration || new Date(Date.now() + 3600 * 1000),
    } as LocationCredentials; // 型アサーションで明示的に指定
  } catch (error) {
    console.error('[getLocationCredentials] Error fetching credentials:', error);
    throw error;
  }
}

// ================================================================
// ここから StorageBrowser のインスタンス化の修正
// ================================================================
// const { StorageBrowser } = createStorageBrowser({
//   config: createAmplifyAuthAdapter(),
// }); // 元コード
const { StorageBrowser } = createStorageBrowser({
  config: {
    listLocations: getS3Locations, // 自作の関数を割り当て
    getLocationCredentials: getLocationCredentials, // 自作の関数を割り当て
    // 認証状態の変化を Storage Browser に通知するリスナー。
    // 認証後に StorageBrowser がコンテンツをロードするために重要です。
    registerAuthListener: (_callback) => {
      // Amplify の Hub を利用して認証イベントをリッスンし、コールバック関数 (StorageBrowser のリフレッシュ) を呼び出す実装が推奨されます。
      // 例:
      // const authListener = Amplify.Hub.listen('auth', ({ payload: { event } }) => {
      //   if (event === 'signedIn' || event === 'signedOut' || event === 'sessionExpired') {
      //     console.log(`[registerAuthListener] Auth event: ${event}, calling callback.`);
      //     callback(); // StorageBrowser に認証状態の変化を通知し、必要に応じてUIを更新させる
      //   }
      // });
      // return () => Amplify.Hub.remove('auth', authListener); // クリーンアップ関数
      
      // 今回はAuthenticatorが認証状態を先に管理しているので、簡易的に空の関数としますが、
      // 厳密にはHubリスナーを実装してログイン/ログアウト時にrefreshをかけるべきです。
      console.warn("[registerAuthListener] Using placeholder. Implement real Amplify Hub listener for production.");
      return () => {}; 
    },
    // --- ★★★ S3 バケットが存在するAWSリージョンに置き換えてください！ ★★★ ---
    region: 'ap-northeast-1', // 例: 'us-east-1'
  },
});

function App() {
  return (
    <Authenticator>
      {({ signOut, user }) => (
        <>
          <div className="header">
            <h1>{`Hello ${user?.username}`}</h1>
            <Button onClick={signOut}>Sign out</Button>
          </div>
          <StorageBrowser />
        </>
      )}
    </Authenticator>
  );
}

export default App;
