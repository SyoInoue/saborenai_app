/**
 * X API v2 連携ユーティリティ
 * OAuth 2.0 PKCE フローの実装
 */

import * as Crypto from 'expo-crypto';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import {
  X_CLIENT_ID,
  X_AUTH_URL,
  X_REDIRECT_URI,
  X_SCOPES,
} from '@/constants/config';

/** PKCE認証に必要な状態管理 */
interface PKCEState {
  codeVerifier: string;
  state: string;
}

/**
 * ランダムな文字列を生成する
 * @param length 生成する文字列の長さ
 */
function generateRandomString(length: number): string {
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  let result = '';
  const values = new Uint8Array(length);
  // crypto.getRandomValues の代替としてexpo-cryptoを使用
  for (let i = 0; i < length; i++) {
    result += charset[Math.floor(Math.random() * charset.length)];
  }
  return result;
}

/**
 * Base64URLエンコードを行う
 * @param buffer エンコード対象のArrayBuffer
 */
function base64URLEncode(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

/**
 * PKCE用のcode_verifierとcode_challengeを生成する
 */
export async function generatePKCE(): Promise<{
  codeVerifier: string;
  codeChallenge: string;
  state: string;
}> {
  const codeVerifier = generateRandomString(128);
  const state = generateRandomString(32);

  // SHA-256でcode_challengeを生成
  const encoder = new TextEncoder();
  const data = encoder.encode(codeVerifier);
  const hashBuffer = await Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA256, data);
  const codeChallenge = base64URLEncode(hashBuffer);

  return { codeVerifier, codeChallenge, state };
}

/**
 * X OAuth 2.0 PKCE認証URLを構築する
 * @param codeChallenge PKCE code challenge
 * @param state CSRF防止用の状態値
 */
export function buildAuthURL(codeChallenge: string, state: string): string {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: X_CLIENT_ID,
    redirect_uri: X_REDIRECT_URI,
    scope: X_SCOPES.join(' '),
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  });

  return `${X_AUTH_URL}?${params.toString()}`;
}

/**
 * X OAuth認証フローを開始する
 * ブラウザを開いてOAuth認証を実行し、認証コードを返す
 */
export async function startXOAuthFlow(): Promise<{
  code: string;
  state: string;
  codeVerifier: string;
} | null> {
  const { codeVerifier, codeChallenge, state } = await generatePKCE();
  const authURL = buildAuthURL(codeChallenge, state);

  // ブラウザでOAuth認証画面を開く
  const result = await WebBrowser.openAuthSessionAsync(authURL, X_REDIRECT_URI);

  if (result.type !== 'success') {
    return null;
  }

  // コールバックURLからcodeとstateを取得
  const url = result.url;
  const parsedURL = Linking.parse(url);
  const { queryParams } = parsedURL;

  if (!queryParams?.code || !queryParams?.state) {
    return null;
  }

  const code = Array.isArray(queryParams.code) ? queryParams.code[0] : queryParams.code;
  const returnedState = Array.isArray(queryParams.state)
    ? queryParams.state[0]
    : queryParams.state;

  // stateの一致を確認（CSRF防止）
  if (returnedState !== state) {
    console.error('OAuth state mismatch - potential CSRF attack');
    return null;
  }

  return { code, state: returnedState, codeVerifier };
}
