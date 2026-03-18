# picopocco.com カスタムドメイン設定 経緯ログ

## 概要
Firebase Hosting に `picopocco.com`（お名前.comで取得済み）を紐づける作業。
DNS設定は正しいにも関わらず、Firebase側のドメイン検証が通らない問題が発生中。

## 環境
- **Firebase プロジェクト**: `picopocco-blog`
- **Firebase Hosting URL**: https://picopocco-blog.web.app （正常稼働中）
- **ドメイン**: `picopocco.com`（お名前.comで取得）
- **現在のDNS**: Cloudflare（無料プラン）
- **日時**: 2026-03-17

---

## 時系列

### 1. Firebase Hosting カスタムドメイン追加（最初の試行）
- Firebase Console → Hosting → 「カスタムドメインを追加」→ `picopocco.com`
- Firebaseが要求したDNSレコード:
  - **A**: `picopocco.com` → `199.36.158.100`
  - **TXT**: `picopocco.com` → `hosting-site=picopocco-blog`

### 2. お名前.com で DNS設定
- お名前.comのDNSレコード設定画面で上記2レコードを追加
- 既存のAレコード（`150.95.255.38` — 旧サーバー）が残っていた
- ネームサーバーは `01.dnsv.jp` 〜 `04.dnsv.jp`（お名前.com標準）

### 3. DNS反映確認
```bash
# Google DNS (8.8.8.8) から確認 → 全て正しく反映
dig picopocco.com A +short @8.8.8.8
# → 199.36.158.100

dig picopocco.com TXT +short @8.8.8.8
# → "hosting-site=picopocco-blog"
```

### 4. Firebase検証失敗（繰り返し）
- Firebase Consoleで「確認」ボタンを押すたびに以下のエラー:
  > **Hosting による picopocco.com の DNS リクエストが失敗しました。DNS プロバイダにお問い合わせください。**
- 「クイックセットアップ」「詳細設定」どちらのモードでも同じ結果
- ドメインを削除→再追加しても同じ
- 1時間以上待っても変わらず

### 5. SSL証明書の状態
```bash
echo | openssl s_client -connect picopocco.com:443 -servername picopocco.com 2>/dev/null | openssl x509 -noout -subject
# → subject=CN=firebaseapp.com
# picopocco.com 用の証明書が発行されていない
```

### 6. サイト自体の応答
```bash
curl -sk https://picopocco.com | head -3
# → <title>Site Not Found</title>
# Firebaseの「カスタムドメイン未設定」ページが表示される
# → トラフィック自体はFirebaseに到達している
```

### 7. www サブドメインでも試行
- Firebase Consoleで `www.picopocco.com` を追加
- お名前.comで CNAME: `www` → `picopocco-blog.web.app` を設定
- 結果: 同じく検証失敗

### 8. Cloudflare に DNS を移行
- **目的**: お名前.comのDNSサーバー（dnsv.jp）とFirebase検証の相性が悪い可能性を排除
- Cloudflareアカウント作成（無料プラン）
- `picopocco.com` を追加、DNSレコードをインポート
- お名前.comでネームサーバーを変更:
  - `lisa.ns.cloudflare.com`
  - `morgan.ns.cloudflare.com`
- Cloudflare SSL/TLS: **Full** に設定
- DNSレコード（Proxy OFF = DNS only）:
  - A: `picopocco.com` → `199.36.158.100`
  - CNAME: `www` → `picopocco-blog.web.app`
  - TXT: `picopocco.com` → `hosting-site=picopocco-blog`
- Cloudflare のステータスが「Active」になったことを確認

### 9. Cloudflare経由でも Firebase検証失敗
- Cloudflare Active後にFirebase Consoleで「確認」→ 同じエラー
- ドメイン削除→10分待機→再追加 でも同じ

### 10. Cloudflare プロキシ方式を試行
- **目的**: Firebase のドメイン検証を回避してCloudflare側でSSLを処理
- Aレコードを削除 → CNAME `picopocco.com` → `picopocco-blog.web.app`（Proxied オレンジ雲）に変更
- 結果:
  - HTTPS自体は通る（Cloudflareが証明書を提供）
  - しかしFirebaseが「Site Not Found」を返す
  - Firebaseはドメイン検証が完了していないとサイトを配信しない
  - Hostヘッダーを `picopocco-blog.web.app` に書き換えると403 Forbidden

### 11. 現在の状態（2026-03-17 18:30頃）
**Cloudflare DNS設定:**
- A: `picopocco.com` → `199.36.158.100`（DNS only グレー雲）
- CNAME: `www` → `picopocco-blog.web.app`（DNS only グレー雲）
- TXT: `picopocco.com` → `hosting-site=picopocco-blog`

**Firebase Console:**
- `picopocco.com` が「設定が必要です」のステータスで登録済み
- 検証ボタンを押すと毎回「DNSリクエストが失敗しました」エラー

**方針:**
- 24時間触らずにFirebaseのバックグラウンド検証を待つ
- 何度も削除・再追加すると検証タイマーがリセットされる可能性があるため

---

## 検証済みの事実

| 項目 | 状態 |
|------|------|
| DNS Aレコード (Google DNS 8.8.8.8) | ✅ `199.36.158.100` |
| DNS Aレコード (Cloudflare DNS 1.1.1.1) | ✅ `199.36.158.100` |
| DNS TXTレコード (Google DNS) | ✅ `hosting-site=picopocco-blog` |
| DNS TXTレコード (Cloudflare DNS) | ✅ `hosting-site=picopocco-blog` |
| ネームサーバー | ✅ Cloudflare (`lisa.ns.cloudflare.com`, `morgan.ns.cloudflare.com`) |
| CAA レコード | なし（ブロック要因なし） |
| Firebase Hosting 本体 | ✅ `picopocco-blog.web.app` 正常稼働 |
| Firebase → picopocco.com へのトラフィック | ✅ 到達している（Site Not Foundページを返す） |
| Firebase ドメイン検証 | ❌ 「DNSリクエストが失敗しました」 |
| SSL証明書 | ❌ `firebaseapp.com` のまま（picopocco.com用未発行） |

---

## 考えられる原因

1. **Firebase検証エンジンのバグ/キャッシュ** — DNS自体は全てのパブリックDNSで正しく解決されるため、Firebase側の問題の可能性が高い
2. **お名前.com → Cloudflare へのNS変更の伝播遅延** — 一部のDNSリゾルバでまだ古いNS情報がキャッシュされている可能性
3. **頻繁な削除・再追加によるレート制限** — Firebase側で検証リトライがリセットされている可能性

---

## 未試行のアプローチ

1. **24時間放置して自動検証を待つ**（現在実行中）
2. **Firebase サポートに問い合わせ**
3. **gcloud CLI から直接ドメインを追加**（`gcloud beta firebase hosting sites update-domain` 等）
4. **別のFirebaseプロジェクトで試す**
5. **Cloudflare Workers でHostヘッダーを書き換えてプロキシ**（Firebaseのドメイン検証を完全回避）
