# UI 顯示控制規範 (UI Display Convention)

> **建立原因**：2026-08-02 發現儲存退出再讀檔後畫面空白的 Bug，根本原因是 CSS class 與 inline style 混用，導致 `style.display` 永久覆蓋 CSS class，造成視圖無法顯示。本文件規範所有視圖顯示/隱藏的正確做法。

---

## 核心規則：只用 CSS Class 控制視圖的顯示與隱藏

本專案所有 `.view`（全螢幕主視圖）與 `.facility-view`（建築室內視圖）的顯示狀態，**一律透過 CSS class 控制**，嚴禁使用 inline style 操作 `display` 屬性。

### CSS 已定義的規則（`index.html`）

```css
/* 全螢幕主視圖 */
.view         { display: none; }   /* 預設隱藏 */
.view.active  { display: flex; }   /* 加上 active → 顯示 */

/* 建築室內視圖 */
.facility-view        { display: none; }
.facility-view.active { display: flex; }
```

**結論：CSS 已定義好了，只需要 `classList.add('active')` / `classList.remove('active')` 即可控制顯示。**

---

## ✅ 正確做法

```typescript
// ✅ 顯示視圖：只加 active class
sceneView.classList.add('active');

// ✅ 隱藏視圖：只移除 active class
sceneView.classList.remove('active');

// ✅ 一次關閉多個視圖（clearAllUIOverlays 的正確寫法）
document.querySelectorAll('.view:not(#main-menu-view), .facility-view').forEach(v => {
  v.classList.remove('active');
  // ← 不需要任何 style.display 操作
});
```

---

## ❌ 禁止的做法

```typescript
// ❌ 禁止：用 inline style 隱藏 .view 或 .facility-view
el.style.display = 'none';

// ❌ 禁止：用 inline style 顯示 .view 或 .facility-view
el.style.display = 'flex';

// ❌ 禁止：用 style.display = '' 清除之前設的 inline style（這是 patch，不是解法）
el.style.display = '';

// ❌ 禁止：在 HTML 元素上直接寫 display 相關的 inline style
// <div id="view-forge" class="facility-view" style="display: none; ...">
```

### 為什麼 inline style 是禁忌？

CSS 的優先權順序：
```
Inline style > CSS class > CSS 繼承
```

一旦用 `style.display = 'none'` 隱藏元素，後來即使正確地加上 `.active` class，**inline style 仍然蓋過 CSS class，視圖不會顯示**。

---

## UI 元素類型速查

| 元素類型 | 代表 ID / Class | 控制方式 | 備註 |
|---|---|---|---|
| 全螢幕視圖 | `.view`（`#map-view`、`#scene-view`、`#wilderness-view`） | ✅ CSS class only | 只改 `.active` |
| 建築室內視圖 | `.facility-view`（`#view-base`、`#view-forge`...） | ✅ CSS class only | 只改 `.active` |
| 側邊抽屜 | `.side-panel-left`、`.side-panel-right` | ✅ CSS class only | 只改 `.active` |
| Modal 對話框 | `.modal-overlay` | ✅ CSS class only | 只改 `.active` |
| 按鈕可見性 | 例如 `btn-enter-base`、`btn-migrate` | ⚠️ 允許 `style.display` | 單一按鈕，無 CSS class 控制 |
| 特殊元素 | `top-bar`、`node-detail-panel` | ⚠️ 允許 `style.display` | 有特殊 layout 需求 |

---

## enterScene / clearAllUIOverlays 的正確架構

### `clearAllUIOverlays()` — 退出遊戲時呼叫

```typescript
clearAllUIOverlays(): void {
  // 只移除 active class，CSS 自動隱藏。不碰 style.display
  document.querySelectorAll(
    '.view:not(#main-menu-view), .facility-view, .modal-overlay, .side-panel-left, .side-panel-right'
  ).forEach(v => {
    v.classList.remove('active');
  });
}
```

> **特別注意**：`#main-menu-view` 必須排除在外，因為退出後需要顯示它。

### `returnToMap()` — 返回地圖時呼叫

```typescript
// ✅ 關閉建築視圖：只移除 active class
['view-base', 'view-hall', 'view-forge', ...].forEach(id => {
  document.getElementById(id)?.classList.remove('active');
  // ← 不加 style.display = 'none'
});

// ✅ 顯示地圖：只加 active class
document.getElementById('map-view')!.classList.add('active');
// ← 不加 style.display = ''
```

---

## transition 嵌套規範

`UIManager.playTransition(callback)` 會產生 500ms 黑幕動畫。**嚴禁在 `playTransition` 的 callback 內再呼叫另一個 `playTransition`**，否則會造成動畫衝突、場景空白。

| 函式 | 帶 Transition | 適用場合 |
|---|---|---|
| `enterScene(node)` | ❌ 不帶 | 已在 `playTransition` callback 內時使用 |
| `enterSceneWithTransition(node)` | ✅ 帶 | 事件監聽器直接呼叫時使用 |

```typescript
// ✅ 正確：callback 內呼叫不帶 transition 的版本
UIManager.playTransition(() => {
  enterScene(node);
});

// ✅ 正確：事件監聽器直接呼叫帶 transition 的版本
btn.addEventListener('click', () => {
  enterSceneWithTransition(node);
});

// ❌ 禁止：transition 嵌套（callback 內又呼叫帶 transition 的版本）
UIManager.playTransition(() => {
  enterSceneWithTransition(node);  // 內部又有 playTransition！
});
```

---

## HTML 規範

所有 `.view` 和 `.facility-view` 元素在 HTML 中應只有 class，樣式寫在 CSS 的對應 ID 規則中：

```html
<!-- ✅ 正確 -->
<div id="view-forge" class="facility-view">

<!-- ❌ 禁止：inline style 中含 display -->
<div id="view-forge" class="facility-view" style="display: none; flex-direction: column; ...">
```

如果某個 view 有特殊尺寸或外觀需求（例如 padding、z-index），一律在 CSS 的 `#view-forge` 規則中定義。

---

## 過去 Bug 案例記錄

### Bug：儲存退出後主選單空白（2026-08-02）

- **原因**：`clearAllUIOverlays()` 對 `.view`（含 `#main-menu-view`）設定 `style.display = 'none'`，退出後加回 `active` class 但被 inline style 覆蓋
- **修復**：selector 改為 `.view:not(#main-menu-view)`，移除 inline style 操作

### Bug：讀取存檔後場景畫面空白（2026-08-02）

- **原因①（主因）**：`clearAllUIOverlays()` 設定 `style.display = 'none'` 殘留在 DOM，讀檔時 `classList.add('active')` 被蓋過
- **原因②**：`enterScene()` 自帶 `playTransition`，造成 transition 雙重嵌套
- **修復**：統一移除所有 view 的 inline style 操作；`enterScene` 分為帶/不帶 transition 兩個版本

### Bug：退出建築後街道建築按鈕無法點擊（2026-08-02）

- **原因**：FacilityController.ts 的 .btn-exit-facility 退出事件使用 style.display = 'none' 關閉建築視圖，造成 inline style 殘留。之後雖 classList.remove('active') 被呼叫，但 inline style 讓元素「邏輯隱藏」卻仍以 pointer-events:auto 攔截點擊。下次進入建築時，classList.add('active') 也被 inline style 蓋過，建築無法顯示。
- **修復**：移除 style.display = 'none'，只保留 classList.remove('active')。
