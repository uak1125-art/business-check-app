// =====================================================
// 点呼記録簿 — Google Apps Script (Webアプリ)
// =====================================================
// 【セットアップ手順】
// 1. Googleスプレッドシートを新規作成
// 2. スプレッドシートのIDをコピー（URLの /d/XXXXX/edit の XXXXX 部分）
// 3. 下の SPREADSHEET_ID に貼り付け
// 4. GASエディタで「デプロイ」→「新しいデプロイ」
//    - 種類: ウェブアプリ
//    - 実行ユーザー: 自分
//    - アクセス: 全員
// 5. デプロイURLをアプリの設定画面に入力
// =====================================================

var SPREADSHEET_ID = 'ここにスプレッドシートIDを貼り付け';

var HEADERS = [
  '送信日時', '名前', '車両No', '令和年', '月', '日',
  '乗務前時間', '開始走行距離', '配達エリア',
  'アルコール検知器(前)', '酒気帯び(前)', '疾病・疲労(前)', '日常点検', '点呼執行者(前)', '備考(前)',
  '乗務後時間', '修了走行距離', '1日走行距離',
  'アルコール検知器(後)', '酒気帯び(後)', '疾病・疲労(後)', '車両の異常', '点呼執行者(後)', '備考(後)'
];

function doPost(e) {
  try {
    var sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getActiveSheet();
    var data = JSON.parse(e.postData.contents);

    // ヘッダーが未設定なら自動追加
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(HEADERS);
    }

    // 既存行を検索（名前 + 年 + 月 + 日 が一致する行を更新）
    var rows = sheet.getDataRange().getValues();
    var targetRow = -1;
    for (var i = 1; i < rows.length; i++) {
      if (rows[i][1] === data.name &&
          String(rows[i][3]) === String(data.year) &&
          String(rows[i][4]) === String(data.month) &&
          String(rows[i][5]) === String(data.day)) {
        targetRow = i + 1;
        break;
      }
    }

    // 1日走行距離を計算
    var beforeDist = parseInt(data.beforeDistance) || 0;
    var afterDist = parseInt(data.afterDistance) || 0;
    var dailyDist = (beforeDist > 0 && afterDist > 0 && afterDist >= beforeDist)
      ? (afterDist - beforeDist) : '';

    var rowData = [
      new Date(),
      data.name || '',
      data.vehicle || '',
      data.year,
      data.month,
      data.day,
      data.beforeTime || '',
      data.beforeDistance || '',
      data.deliveryArea || '',
      data.beforeAlcohol || '',
      data.beforeDrinking || '',
      data.beforeHealth || '',
      data.beforeInspection || '',
      data.beforeInspector || '',
      data.beforeNote || '',
      data.afterTime || '',
      data.afterDistance || '',
      dailyDist,
      data.afterAlcohol || '',
      data.afterDrinking || '',
      data.afterHealth || '',
      data.afterVehicle || '',
      data.afterInspector || '',
      data.afterNote || ''
    ];

    if (targetRow > 0) {
      sheet.getRange(targetRow, 1, 1, rowData.length).setValues([rowData]);
    } else {
      sheet.appendRow(rowData);
    }

    return ContentService.createTextOutput(
      JSON.stringify({ status: 'ok' })
    ).setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(
      JSON.stringify({ status: 'error', message: err.toString() })
    ).setMimeType(ContentService.MimeType.JSON);
  }
}
