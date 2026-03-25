# 点呼アプリ 構築マニュアル

> **業務記録・点呼記録簿 PWA** の構築手順を再現可能な形で記録したドキュメント

---

## 目次

1. [概要・背景](#1-概要背景)
2. [技術スタック](#2-技術スタック)
3. [ディレクトリ構成](#3-ディレクトリ構成)
4. [Step 1: フロントエンド構築](#4-step-1-フロントエンド構築)
5. [Step 2: PWA化](#5-step-2-pwa化)
6. [Step 3: Google Apps Script バックエンド](#6-step-3-google-apps-script-バックエンド)
7. [Step 4: GitHub Pages デプロイ](#7-step-4-github-pages-デプロイ)
8. [Step 5: カスタムドメイン設定](#8-step-5-カスタムドメイン設定)
9. [運用・保守](#9-運用保守)
10. [トラブルシューティング](#10-トラブルシューティング)

---

## 1. 概要・背景

### 目的
2025年4月より軽貨物ドライバーにも義務化された **自主点呼記録** を、スマホから簡単に入力・管理するためのWebアプリ。

### 要件
- スマホ（Android / iPhone）で使える
- ホーム画面に追加してネイティブアプリのように使える（PWA）
- オフラインでも動作する
- データはGoogleスプレッドシートに自動保存される
- 月次の点呼記録簿をPDF出力できる

### 採用したアーキテクチャ
```
┌─────────────────┐     fetch()      ┌─────────────────┐
│  静的HTML/JS/CSS │  ────────────>   │  Google Apps     │
│  (GitHub Pages)  │  <────────────   │  Script (GAS)    │
│                  │     JSON         │                  │
│  + Service Worker│                  │  → Spreadsheet   │
│  + localStorage  │                  │    に読み書き     │
└─────────────────┘                  └─────────────────┘
```

**選定理由:**
- サーバー費用ゼロ（GitHub Pages + GAS、どちらも無料）
- ビルドツール不要（HTML/CSS/JSをそのままデプロイ）
- Googleスプレッドシートなので管理者が目視確認しやすい

---

## 2. 技術スタック

| 項目 | 技術 | 理由 |
|:-----|:-----|:-----|
| フロントエンド | HTML + CSS + Vanilla JS | ビルド不要、軽量、PWA対応が容易 |
| バックエンド | Google Apps Script | 無料、スプレッドシート直結、Webアプリとしてデプロイ可能 |
| データベース | Google Spreadsheet | 管理者が目視・Excel出力できる |
| ホスティング | GitHub Pages | 無料、Git pushでデプロイ、カスタムドメイン対応 |
| オフライン | Service Worker + localStorage | PWA標準、ネットワーク不要で入力可能 |
| 印刷/PDF | `window.print()` + 印刷プレビューページ | ブラウザ標準機能、追加ライブラリ不要 |

---

## 3. ディレクトリ構成

```
business-check-app/
├── index.html          # メイン画面（3タブ: 日次記録・月次一覧・設定）
├── app.js              # アプリケーションロジック（約900行）
├── style.css           # スタイルシート
├── sw.js               # Service Worker（オフライン対応）
├── manifest.json       # PWAマニフェスト
├── print.html          # 印刷プレビューページ
├── guide.html          # 使い方ガイド（ユーザー向け）
├── CNAME               # カスタムドメイン設定
├── icons/
│   ├── icon-192.png    # PWAアイコン (192x192)
│   └── icon-512.png    # PWAアイコン (512x512)
└── gas/
    └── Code.gs         # Google Apps Script（スプレッドシート連携）
```

---

## 4. Step 1: フロントエンド構築

### 4.1 index.html — UIの骨格

3つのタブで構成:

| タブ | 内容 | 主なUI要素 |
|:-----|:-----|:-----------|
| 日次記録 | 日々の点呼入力 | カレンダーグリッド、トグルボタン、テキスト入力 |
| 月次一覧 | 月の記録一覧 | リスト表示、PDF出力ボタン |
| 設定 | 名前・車両番号等 | テキスト入力、バックアップ/復元 |

**ポイント:**
- `<meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">` でモバイル最適化
- `<meta name="apple-mobile-web-app-capable" content="yes">` でiOS PWA対応
- `<link rel="manifest" href="manifest.json">` でPWAマニフェストを読み込み

### 4.2 style.css — モバイルファーストのデザイン

**設計方針:**
- CSS変数（`:root`）でテーマカラーを一元管理
- `max-width: 480px` でスマホに最適化しつつ、タブレットでも崩れない
- `.tab-nav` と `.app-header` は `position: sticky` で常時表示
- トグルボタンは状態に応じて色が変わる（正常=青、警告=オレンジ、危険=赤）

```css
:root {
  --primary: #1a73e8;        /* メインカラー（Google Blue） */
  --danger: #d93025;         /* 危険・異常 */
  --success: #1e8e3e;        /* 正常・完了 */
  --before-color: #1a73e8;   /* 乗務前セクション */
  --after-color: #e8710a;    /* 乗務後セクション */
}
```

### 4.3 app.js — アプリケーションロジック

#### データ構造

```javascript
// ローカルストレージのキー
var STORAGE_KEY = 'mkt-check-records';   // 全記録
var SETTINGS_KEY = 'mkt-check-settings'; // ユーザー設定

// アプリケーション状態
var state = {
  year: 7,        // 令和年
  month: 4,       // 月
  day: 1,         // 日
  records: {},    // { "7-4-1": {beforeTime: "06:30", ...}, ... }
  settings: { name: '', vehicle: '', inspector: '' }
};
```

#### 主要機能一覧

| 機能 | 関数名 | 説明 |
|:-----|:-------|:-----|
| 初期化 | `init()` | 設定読み込み、日付設定、UI描画、イベント登録 |
| 日付カレンダー | `renderDayGrid()` | 7列グリッドで月のカレンダーを描画 |
| フォーム読み書き | `getFormData()` / `loadDayForm()` | UIからデータ取得 / データをUIに反映 |
| 部分保存 | `saveBeforeOnly()` / `saveAfterOnly()` | 乗務前/後のみ保存（上書き防止） |
| 最終保存 | `saveDay()` | バリデーション→ローカル保存→GASへ送信 |
| サーバー送信 | `sendToGAS()` | fetch()でGASエンドポイントにPOST |
| サーバー復元 | （restore-server-btn） | GASのGETエンドポイントからデータ取得 |
| PDF出力 | `exportPDF()` | HTML帳票生成→sessionStorage→print.html |
| 走行距離自動計算 | `updateDailyDistance()` | 修了距離 − 開始距離 = 1日走行距離 |
| 前日距離自動反映 | `autoFillPrevDistance()` | 前日の修了距離を当日の開始距離に自動入力 |
| 未入力警告 | （missing-banner） | 過去の未記録日をバナーで警告 |

#### トグルボタンの仕組み

HTML側:
```html
<button class="toggle-btn active" data-field="before-alcohol" data-value="有">有</button>
<button class="toggle-btn" data-field="before-alcohol" data-value="無">無</button>
```

JS側:
```javascript
// 値の取得
function getToggleValue(fieldName) {
  var btns = document.querySelectorAll('.toggle-btn[data-field="' + fieldName + '"]');
  for (var i = 0; i < btns.length; i++) {
    if (btns[i].classList.contains('active')) return btns[i].getAttribute('data-value');
  }
  return '';
}

// 値の設定
function setToggleValue(fieldName, value) {
  var btns = document.querySelectorAll('.toggle-btn[data-field="' + fieldName + '"]');
  for (var i = 0; i < btns.length; i++) {
    btns[i].classList.toggle('active', btns[i].getAttribute('data-value') === value);
  }
}
```

#### PDF出力の仕組み

1. `exportPDF()` がHTMLテーブルを文字列として生成
2. `sessionStorage.setItem('printHtml', html)` で一時保存
3. `location.href = './print.html'` でプレビューページに遷移
4. `print.html` が sessionStorage から HTML を取得して表示
5. ユーザーが「印刷 / PDF保存」ボタンを押すと `window.print()` が実行される

**なぜ sessionStorage + 別ページ方式か:**
- `window.print()` はページ全体を印刷するため、アプリUIを隠す必要がある
- Blob URL方式は Android PWA で動作しない
- `document.write` 方式はリロード時にデータが消える
- 別ページ方式なら「戻る」ボタンでアプリに戻れる

### 4.4 ドライバー認証（ホワイトリスト方式）

フロントエンド（app.js）とバックエンド（Code.gs）の両方でチェック:

```javascript
var ALLOWED_DRIVERS = [
  { name: '橋本且弥', vehicle: '6240' },
  { name: '清松竜也', vehicle: '6554' },
  { name: '森下富弘', vehicle: '7956' },
  { name: '山中伸一', vehicle: '6944' },
  { name: '清松賢弥', vehicle: '7735' }
];
```

- 設定タブで入力された名前＋車両番号の組み合わせが一致する場合のみ保存を許可
- 新しいドライバーを追加する場合は、app.js と Code.gs の両方に追記が必要

---

## 5. Step 2: PWA化

### 5.1 manifest.json

```json
{
  "name": "業務記録・点呼記録簿",
  "short_name": "点呼記録",
  "start_url": "./index.html",
  "display": "standalone",
  "background_color": "#f1f3f4",
  "theme_color": "#1a73e8",
  "icons": [
    { "src": "./icons/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any maskable" },
    { "src": "./icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any maskable" }
  ]
}
```

**ポイント:**
- `display: "standalone"` でURLバーなしのアプリモード
- `purpose: "any maskable"` でAndroidのアダプティブアイコンに対応
- アイコンは 192x192 と 512x512 の2サイズ必須

### 5.2 sw.js — Service Worker

```javascript
var CACHE_NAME = 'mkt-check-v20';  // ★バージョンを変えるとキャッシュが更新される
var URLS_TO_CACHE = [
  './', './index.html', './style.css', './app.js',
  './guide.html', './print.html',
  './manifest.json', './icons/icon-192.png', './icons/icon-512.png'
];
```

**キャッシュ戦略: ネットワーク優先（Network First）**
1. まずネットワークからfetch
2. 成功（200）→ キャッシュを更新 + レスポンスを返す
3. 失敗（オフライン）→ キャッシュから返す
4. キャッシュにもない → index.html をフォールバック

**バージョン更新の流れ:**
1. `CACHE_NAME` の数字を上げる（例: `v20` → `v21`）
2. git push → GitHub Pages にデプロイ
3. ユーザーが次にアプリを開くと、新しいSWがinstall → activate
4. 古いキャッシュが削除され、新しいファイルがキャッシュされる

### 5.3 ホーム画面追加の手順

**Android（Chrome）:**
1. アプリURLを開く
2. メニュー（︙）→「ホーム画面に追加」
3. アプリ名を確認して「追加」

**iPhone（Safari）:**
1. アプリURLを開く
2. 共有ボタン（□↑）→「ホーム画面に追加」
3. アプリ名を確認して「追加」

---

## 6. Step 3: Google Apps Script バックエンド

### 6.1 セットアップ手順

1. **Googleスプレッドシートを新規作成**
2. **スプレッドシートIDをコピー**（URLの `/d/XXXXX/edit` の `XXXXX` 部分）
3. **GASエディタを開く**: スプレッドシート → 拡張機能 → Apps Script
4. **Code.gs のコードを貼り付け**（`gas/Code.gs` の内容）
5. **`SPREADSHEET_ID` にスプレッドシートIDを設定**
6. **`ALLOWED_DRIVERS` にドライバーを登録**
7. **デプロイ**:
   - 「デプロイ」→「新しいデプロイ」
   - 種類: ウェブアプリ
   - 実行ユーザー: 自分
   - アクセス: 全員
8. **デプロイURLを取得**（`https://script.google.com/macros/s/XXXXX/exec` 形式）
9. **app.js の `GAS_URL` にデプロイURLを設定**

### 6.2 スプレッドシートの構造

GASが自動的にシートを作成・フォーマットする。

**シート名規則:** `{ドライバー名}_R{年}年{月}月`
- 例: `橋本且弥_R7年4月`

**列構成（A〜U、21列）:**

| 列 | A | B | C | D〜L（9列） | M〜U（9列） |
|:---|:--|:--|:--|:------------|:------------|
| 内容 | 月 | 日 | 曜 | 乗務前 自主点呼 | 乗務後 自主点呼 |

**乗務前（D〜L）の項目:**
| D | E | F | G | H | I | J | K | L |
|:--|:--|:--|:--|:--|:--|:--|:--|:--|
| 時間 | 開始走行距離 | 配達エリア | アルコール検知器 | 酒気帯び | 疾病・疲労等 | 日常点検 | 点呼執行者 | 備考 |

**乗務後（M〜U）の項目:**
| M | N | O | P | Q | R | S | T | U |
|:--|:--|:--|:--|:--|:--|:--|:--|:--|
| 時間 | 修了走行距離 | 1日の走行距離 | アルコール検知器 | 酒気帯び | 疾病・疲労等 | 車両の異常 | 点呼執行者 | 備考 |

### 6.3 APIの仕様

**POST（データ送信）:**
```javascript
// リクエスト
fetch(GAS_URL, {
  method: 'POST',
  body: JSON.stringify({
    name: '橋本且弥',
    vehicle: '6240',
    year: '7',
    month: '4',
    day: '15',
    beforeTime: '06:30',
    beforeDistance: '98000',
    deliveryArea: '久留米市',
    beforeAlcohol: '有',
    beforeDrinking: '無',
    beforeHealth: '良好',
    beforeInspection: '異常無',
    beforeInspector: '山田太郎',
    beforeNote: '',
    afterTime: '18:45',
    afterDistance: '98060',
    afterAlcohol: '有',
    afterDrinking: '無',
    afterHealth: '良好',
    afterVehicle: '異常無',
    afterInspector: '山田太郎',
    afterNote: ''
  })
});

// レスポンス
{ "status": "ok" }
// or
{ "status": "error", "message": "エラー内容" }
```

**GET（データ復元）:**
```javascript
// リクエスト
fetch(GAS_URL + '?name=橋本且弥&vehicle=6240&year=7&month=4');

// レスポンス
{
  "status": "ok",
  "records": {
    "7-4-1": { "beforeTime": "06:30", ... },
    "7-4-2": { "beforeTime": "07:00", ... }
  }
}
```

### 6.4 GASデプロイ更新時の注意

コードを変更したら **「新しいデプロイ」ではなく「デプロイを管理」→ 鉛筆アイコン → バージョン「新バージョン」→「デプロイ」** で更新する。URLが変わらないようにするため。

---

## 7. Step 4: GitHub Pages デプロイ

### 7.1 リポジトリ設定

1. GitHubリポジトリを作成（またはサブディレクトリとして管理）
2. Settings → Pages → Source を設定
   - Branch: `master`（または `main`）
   - フォルダ: `/business-check-app`（サブディレクトリの場合は別ブランチ or GitHub Actions）
3. Enforce HTTPS にチェック

### 7.2 デプロイの流れ

```bash
# コード変更後
git add business-check-app/
git commit -m "変更内容の説明"
git push origin master
```

- pushから数分でGitHub Pagesに反映される
- 反映確認: `https://{username}.github.io/{repo}/` または カスタムドメイン

---

## 8. Step 5: カスタムドメイン設定

### 8.1 CNAME ファイル

`business-check-app/CNAME` にドメインを記載:
```
tenko.hassii33.com
```

### 8.2 DNS設定

ドメインレジストラで以下のいずれかを設定:

**CNAME レコード（サブドメインの場合）:**
```
tenko  CNAME  {username}.github.io.
```

**A レコード（ルートドメインの場合）:**
```
@  A  185.199.108.153
@  A  185.199.109.153
@  A  185.199.110.153
@  A  185.199.111.153
```

### 8.3 HTTPS

GitHub Pages が自動的にLet's Encrypt証明書を発行する（初回は数分かかる場合あり）。

---

## 9. 運用・保守

### 9.1 コード変更時のチェックリスト

- [ ] `sw.js` の `CACHE_NAME` のバージョンを上げる（例: `v20` → `v21`）
- [ ] `URLS_TO_CACHE` に新しいファイルがあれば追加
- [ ] ドライバー追加時は `app.js` と `gas/Code.gs` の両方を更新
- [ ] GASコード変更時は GASエディタで再デプロイ（バージョン: 新バージョン）

### 9.2 データの永続性

| 層 | 保存場所 | 特徴 |
|:---|:---------|:-----|
| 1 | localStorage | 最速。アプリ終了しても保持。ブラウザデータ削除で消失 |
| 2 | sessionStorage | 印刷プレビュー用の一時データ。タブを閉じると消失 |
| 3 | Google Spreadsheet | サーバーバックアップ。「この日を保存」で送信される |
| 4 | JSON エクスポート | 手動バックアップ。設定タブからダウンロード |

### 9.3 ドライバーの追加方法

1. `app.js` の `ALLOWED_DRIVERS` に追加:
```javascript
{ name: '新しいドライバー名', vehicle: '車両番号' }
```

2. `gas/Code.gs` の `ALLOWED_DRIVERS` にも同じ内容を追加

3. app.js 変更 → git push（GitHub Pages に反映）
4. Code.gs 変更 → GASエディタで再デプロイ

---

## 10. トラブルシューティング

### アプリが更新されない（古い画面が表示される）

**原因:** Service Worker のキャッシュが残っている

**対処法（ユーザー側）:**
1. Android: 設定 → アプリ → Chrome → ストレージ → サイトのデータを削除
2. iPhone: 設定 → Safari → Webサイトデータ → 該当サイトを削除
3. 再度URLにアクセスしてホーム画面に追加し直す

**対処法（開発側）:**
- `sw.js` の `CACHE_NAME` バージョンを必ず上げてからデプロイする

### ボタンが押せない・反応しない

1. まず **キャッシュの問題を疑う**（上記の対処法を試す）
2. キャッシュクリア後も直らない場合のみ、コードの問題を調査する
3. 推測でアプローチを変えず、1つの仮説を検証してから次に進む

### データがスプレッドシートに反映されない

1. 設定タブの名前・車両番号が `ALLOWED_DRIVERS` と一致しているか確認
2. GASのデプロイURLが正しいか確認
3. GASエディタ → 実行ログでエラーを確認
4. スプレッドシートのシート名が正しい形式（`{名前}_R{年}年{月}月`）か確認

### PDF出力できない

1. 月次一覧タブでデータが表示されているか確認
2. プレビューページで「印刷 / PDF保存」を押して印刷ダイアログが出るか確認
3. Android: 印刷ダイアログで「PDF として保存」を選択
4. iPhone: 印刷プレビューをピンチアウトでPDF表示 → 共有で保存

---

## 付録: 同様のアプリを新規作成する場合のテンプレート

### 最小構成

```
my-app/
├── index.html      # UI
├── app.js          # ロジック
├── style.css       # スタイル
├── sw.js           # Service Worker
├── manifest.json   # PWAマニフェスト
├── CNAME           # カスタムドメイン
└── icons/
    ├── icon-192.png
    └── icon-512.png
```

### Service Worker テンプレート

```javascript
var CACHE_NAME = 'my-app-v1';
var URLS_TO_CACHE = ['./', './index.html', './style.css', './app.js', './manifest.json'];

self.addEventListener('install', function(e) {
  e.waitUntil(caches.open(CACHE_NAME).then(function(c) { return c.addAll(URLS_TO_CACHE); }));
  self.skipWaiting();
});

self.addEventListener('activate', function(e) {
  e.waitUntil(caches.keys().then(function(names) {
    return Promise.all(names.filter(function(n) { return n !== CACHE_NAME; }).map(function(n) { return caches.delete(n); }));
  }));
  self.clients.claim();
});

self.addEventListener('fetch', function(e) {
  e.respondWith(
    fetch(e.request).then(function(res) {
      if (res.status === 200) {
        var clone = res.clone();
        caches.open(CACHE_NAME).then(function(c) { c.put(e.request, clone); });
      }
      return res;
    }).catch(function() {
      return caches.match(e.request);
    })
  );
});
```

### GAS テンプレート（スプレッドシート連携）

```javascript
var SPREADSHEET_ID = 'ここにID';

function doPost(e) {
  try {
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var data = JSON.parse(e.postData.contents);
    // データ処理...
    return ContentService.createTextOutput(
      JSON.stringify({ status: 'ok' })
    ).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(
      JSON.stringify({ status: 'error', message: err.toString() })
    ).setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  // データ取得...
}
```

---

*最終更新: 2026-03-24*
*このマニュアルは business-check-app の実装に基づいて作成されています*
