# JSON スキーマ仕様

## 診断アプリ (type: "diagnostic")

```json
{
  "type": "diagnostic",
  "title": "アプリ名",
  "description": "説明文（任意）",
  "icon": "🔍",
  "questions": [
    {
      "text": "質問文",
      "options": [
        { "label": "選択肢テキスト", "score": 0 }
      ]
    }
  ],
  "results": [
    {
      "maxScore": 5,
      "label": "結果ラベル",
      "color": "#34c98b",
      "description": "結果の説明文"
    }
  ]
}
```

### フィールド説明

| フィールド | 必須 | 説明 |
|---|---|---|
| `type` | ✅ | `"diagnostic"` 固定 |
| `title` | ✅ | アプリ名 |
| `description` | - | ヘッダー説明文 |
| `icon` | - | 絵文字アイコン |
| `questions[].text` | ✅ | 質問文 |
| `questions[].options[].label` | ✅ | 選択肢テキスト |
| `questions[].options[].score` | ✅ | 加算スコア（数値） |
| `results[].maxScore` | ✅ | このレベルの最大スコア |
| `results[].label` | ✅ | 結果ラベル |
| `results[].color` | - | カラーコード |
| `results[].description` | - | 結果の説明文 |

---

## 記録アプリ (type: "record")

```json
{
  "type": "record",
  "title": "アプリ名",
  "description": "説明文（任意）",
  "icon": "📝",
  "fields": [
    { "key": "フィールドキー", "label": "ラベル", "type": "text", "required": true }
  ]
}
```

### フィールドタイプ一覧

| type | 説明 | 追加オプション |
|---|---|---|
| `text` | テキスト入力 | `placeholder` |
| `number` | 数値入力 | `min`, `max`, `step` |
| `date` | 日付ピッカー | — |
| `select` | ドロップダウン | `options: string[]` |
| `radio` | ラジオボタン | `options: string[]` |
| `checkbox` | チェックボックス（複数選択） | `options: string[]` |
| `textarea` | 複数行テキスト | `placeholder` |
| `range` | スライダー | `min`, `max` |

### 共通オプション

| フィールド | 必須 | 説明 |
|---|---|---|
| `key` | ✅ | 一意のキー（英数字） |
| `label` | ✅ | フォームラベル |
| `type` | ✅ | フィールドタイプ |
| `required` | - | バリデーション |
| `hint` | - | ヘルプテキスト |
