# 故事工坊防呆、節點挑選器與全鏈路驗證升級規格書 (Story Studio Upgrade Spec)

本文檔為 **《Medieval》（medieval-mercenary-management-rpg）** 專案中 **「故事工坊（Story Studio）」** 的系統升級與重構規格書。  
旨在徹底解決現行工坊中「純文字手動輸入容易出錯」、「缺乏深層邏輯斷鏈檢驗」、「流程圖無異常視覺警示」等編輯痛點，建立一個具備強大防呆、全自動驗證與直觀引導的視覺化劇本創作工具。

---

## 📌 一、 現行問題與升級目標

### 1\. 現行核心痛點

1. **手動字串輸入無防呆**：`SCHEDULE_NODE`、`TRIGGER_RAID`（守城勝負跳轉）、`CREATE_SUBJUGATION_NODE`（討伐勝負跳轉）以及條件中的 `Fact`（線索）名稱皆為純文字框，極易因手誤拼錯（如 `dragom` vs `dragon`）或留空 `""` 導致遊戲中斷鏈與死循環。  
2. **驗證機制過於單薄**：目前 `StoryStudioStore.getValidationErrors()` 僅檢查「ID 是否為空」與「ID 是否重複」，無法攔截斷鏈、死循環、未定義線索或無效資產 ID。  
3. **流程圖缺乏異常標註**：`StoryStudioGraph.ts` 遇到不存在的目標節點時僅靜默略過，創作者無法從圖形上發現「斷鏈」或「不可達孤島節點」。  
4. **生命週期清理缺乏引導**：配置守城戰（`TRIGGER_RAID`）或地圖討伐時，未在 UI 上引導勝負出口與地圖節點清理邏輯。

### 2\. 升級核心目標

* **UI 零手誤**：所有指向「現有節點」與「已知線索」的欄位全面替換為下拉挑選器或智慧補全。  
* **靜態全鏈路深度診斷**：存檔前全自動掃描斷鏈、孤島、線索依賴、死循環與無效資產。  
* **視覺化直觀警示**：流程圖即時繪製斷鏈紅線、孤島黃色角標與結算出口。

---

## 🛠️ 二、 模組一：節點下拉挑選器與 UI 表單重構

### 影響檔案：`src/tools/story-studio/StoryStudioForm.ts`

### 1\. 核心實作：動態節點下拉選單產生器

在 `StoryStudioForm.ts` 中新增輔助方法，根據當前編輯中的故事動態產生節點下拉選項：

/\*\* 產生當前故事中所有可用節點的下拉選單選項 \*/

private getNodeSelectOptions(currentStory: NarrativeStory, currentSelfId?: string, emptyLabel \= '-- 請選擇目標節點 \--'): { value: string; label: string }\[\] {

  const options \= \[{ value: '', label: emptyLabel }\];

  for (const n of currentStory.nodes) {

    if (currentSelfId && n.id \=== currentSelfId) continue; // 排除自身（除非特定自排程需求）

    const typeLabel \= n.channel ? \`\[${n.channel}\]\` : '';

    options.push({

      value: n.id,

      label: \`${n.title || '未命名'} (${n.id}) ${typeLabel}\`

    });

  }

  return options;

}

### 2\. 表單欄位改造清單

#### (1) `SCHEDULE_NODE`（排程節點效果）

* **現狀**：`${input('目標故事節點 ID', 'nodeId', effect.nodeId)}`  
* **改造後**：  
    
  case 'SCHEDULE\_NODE': {  
    
    const nodeOptions \= this.getNodeSelectOptions(this.currentStory, node.id, '-- 選擇要排程喚醒的目標節點 \--');  
    
    return \`  
    
      ${this.select('目標故事節點', 'nodeId', effect.nodeId || '', nodeOptions)}  
    
      ${this.input('等待天數 (0=立即, 1\~N天)', 'delayDays', effect.delayDays ?? 0, 'number')}  
    
    \`;  
    
  }

#### (2) `TRIGGER_RAID`（領地守城戰役效果）

* **現狀**：純文字輸入 `successNodeId` 與 `failNodeId`。  
* **改造後**：  
    
  case 'TRIGGER\_RAID': {  
    
    const nodeOptions \= this.getNodeSelectOptions(this.currentStory, node.id);  
    
    // ... 前置梯隊與攻城設定 ...  
    
    return \`  
    
      \<\!-- 梯隊設定保持現有 UI \--\>  
    
      \<div style="margin-top: 10px; display: flex; gap: 8px;"\>  
    
        \<div style="flex: 1;"\>  
    
          ${this.select('🛡️ 守城大捷跳轉節點', 'successNodeId', effect.successNodeId || '', nodeOptions)}  
    
        \</div\>  
    
        \<div style="flex: 1;"\>  
    
          ${this.select('💀 城防失守跳轉節點', 'failNodeId', effect.failNodeId || '', nodeOptions)}  
    
        \</div\>  
    
      \</div\>  
    
    \`;  
    
  }

#### (3) `CREATE_SUBJUGATION_NODE`（動態討伐據點效果）

* **現狀**：純文字輸入 `victoryNodeId`、`defeatNodeId` 與 `journeyNodeIds`。  
* **改造後**：  
    
  case 'CREATE\_SUBJUGATION\_NODE': {  
    
    const nodeOptions \= this.getNodeSelectOptions(this.currentStory, node.id);  
    
    const d \= effect.definition;  
    
    return \`  
    
      ${this.select('選擇已創作的討伐據點範本', 'definition.templateId', d.templateId || '', templateOptions)}  
    
      ${this.input('據點名稱 (自訂或沿用範本)', 'definition.name', d.name)}  
    
      \<div style="display:flex; gap:8px;"\>  
    
        \<div style="flex:1.5;"\>${this.select('🏆 勝利觸發節點', 'definition.victoryNodeId', d.victoryNodeId || '', nodeOptions)}\</div\>  
    
        \<div style="flex:1;"\>${this.input('戰勝延遲天數', 'definition.victoryDelayDays', d.victoryDelayDays ?? 0, 'number')}\</div\>  
    
      \</div\>  
    
      \<div style="display:flex; gap:8px;"\>  
    
        \<div style="flex:1.5;"\>${this.select('💀 失敗觸發節點', 'definition.defeatNodeId', d.defeatNodeId || '', nodeOptions)}\</div\>  
    
        \<div style="flex:1;"\>${this.input('戰敗延遲天數', 'definition.defeatDelayDays', d.defeatDelayDays ?? 0, 'number')}\</div\>  
    
      \</div\>  
    
    \`;  
    
  }

#### (4) `Fact`（線索與事實）智慧候選清單

* 在條件 `FACT_EXISTS`、`FACT_MISSING`、`DAYS_SINCE_FACT` 與效果 `SET_FACT` 的輸入框旁，掛載 HTML5 `<datalist>`，自動收集當前劇本與全域已定義的所有 Fact 標籤，提供自動補全。

---

## 🔍 三、 模組二：全鏈路深度靜態分析與驗證引擎

### 影響檔案：`src/tools/story-studio/StoryStudioStore.ts`

將目前的簡易檢查全面升級為多層級驗證引擎，回傳 `ValidationReport`：

export interface ValidationIssue {

  type: 'ERROR' | 'WARNING';

  storyId: string;

  nodeId?: string;

  field?: string;

  message: string;

}

export class StoryStudioStore {

  // ...

  public validateAllStories(): ValidationIssue\[\] {

    const issues: ValidationIssue\[\] \= \[\];

    const allStoryIds \= new Set\<string\>();

    const validFactionIds \= new Set(\['f\_vormund', 'f\_lothgar', 'f\_nord', 'f\_valis', 'f\_free\_cities', 'f\_silver\_covenant'\]);

    const validBuildingIds \= new Set(\['farmland', 'lumberMill', 'quarry', 'huntingGround', 'forge', 'defense', 'tavern', 'alchemyLab', 'guardPost'\]);

    for (const story of this.stories) {

      if (\!story.id) issues.push({ type: 'ERROR', storyId: story.id, message: '存在未命名 ID 的故事。' });

      if (allStoryIds.has(story.id)) issues.push({ type: 'ERROR', storyId: story.id, message: \`故事 ID 重複：「${story.id}」。\` });

      allStoryIds.add(story.id);

      const nodes \= new Map\<string, NarrativeNode\>();

      const factsProduced \= new Set\<string\>();

      const factsRequired: { fact: string; nodeId: string }\[\] \= \[\];

      for (const node of story.nodes) {

        if (\!node.id) issues.push({ type: 'ERROR', storyId: story.id, message: \`故事【${story.title}】中有未設定 ID 的節點。\` });

        if (nodes.has(node.id)) issues.push({ type: 'ERROR', storyId: story.id, nodeId: node.id, message: \`節點 ID 重複：「${node.id}」。\` });

        nodes.set(node.id, node);

        // 收集產出的 Fact

        for (const eff of node.completionEffects || \[\]) {

          if (eff.type \=== 'SET\_FACT' && eff.fact) factsProduced.add(eff.fact);

          if (eff.type \=== 'CHANGE\_FACTION\_FAVOR' && \!validFactionIds.has(eff.factionId)) {

            issues.push({ type: 'WARNING', storyId: story.id, nodeId: node.id, message: \`使用了未定義的派系 ID：「${eff.factionId}」。\` });

          }

          if (eff.type \=== 'REDUCE\_BUILDING\_LEVEL' && \!validBuildingIds.has(eff.buildingId)) {

            issues.push({ type: 'WARNING', storyId: story.id, nodeId: node.id, message: \`使用了未定義的建築 ID：「${eff.buildingId}」。\` });

          }

        }

        for (const ch of node.choices || \[\]) {

          for (const eff of ch.effects || \[\]) {

            if (eff.type \=== 'SET\_FACT' && eff.fact) factsProduced.add(eff.fact);

          }

        }

        // 收集要求的 Fact

        for (const cond of node.conditions || \[\]) {

          if ((cond.type \=== 'FACT\_EXISTS' || cond.type \=== 'DAYS\_SINCE\_FACT') && cond.fact) {

            factsRequired.push({ fact: cond.fact, nodeId: node.id });

          }

        }

      }

      // 2\. 檢驗線索閉環 (Fact Closure)

      for (const req of factsRequired) {

        if (\!factsProduced.has(req.fact)) {

          issues.push({

            type: 'WARNING',

            storyId: story.id,

            nodeId: req.nodeId,

            message: \`條件需要線索「${req.fact}」，但本劇本中無任何節點產生此線索（若非跨劇本線索請檢查拼寫）。\`

          });

        }

      }

      // 3\. 檢驗斷鏈 (Broken Links)

      for (const \[nid, node\] of nodes.entries()) {

        const checkTarget \= (targetId: string | undefined, contextDesc: string) \=\> {

          if (targetId \=== '') {

            issues.push({ type: 'ERROR', storyId: story.id, nodeId: nid, message: \`${contextDesc} 不得為空字串。\` });

          } else if (targetId && \!nodes.has(targetId)) {

            issues.push({ type: 'ERROR', storyId: story.id, nodeId: nid, message: \`${contextDesc} 指向不存在的節點：「${targetId}」。\` });

          }

        };

        for (const eff of node.completionEffects || \[\]) {

          if (eff.type \=== 'SCHEDULE\_NODE') checkTarget(eff.nodeId, '排程後續節點');

          if (eff.type \=== 'TRIGGER\_RAID') {

            checkTarget(eff.successNodeId, '守城大捷跳轉節點');

            checkTarget(eff.failNodeId, '城防失守跳轉節點');

          }

          if (eff.type \=== 'CREATE\_SUBJUGATION\_NODE') {

            checkTarget(eff.definition.victoryNodeId, '討伐勝利跳轉節點');

            checkTarget(eff.definition.defeatNodeId, '討伐失敗跳轉節點');

            for (const jId of eff.definition.journeyNodeIds || \[\]) {

              checkTarget(jId, '討伐途中事件節點');

            }

          }

        }

        for (const ch of node.choices || \[\]) {

          if ((\!ch.effects || ch.effects.length \=== 0\) && \!ch.resultText) {

            issues.push({

              type: 'WARNING',

              storyId: story.id,

              nodeId: nid,

              message: \`決策選項「${ch.text || '未命名'}」沒有設定任何效果或反饋文字。\`

            });

          }

          for (const eff of ch.effects || \[\]) {

            if (eff.type \=== 'SCHEDULE\_NODE') checkTarget(eff.nodeId, \`選項「${ch.text}」的排程節點\`);

            if (eff.type \=== 'TRIGGER\_RAID') {

              checkTarget(eff.successNodeId, \`選項「${ch.text}」的守城大捷節點\`);

              checkTarget(eff.failNodeId, \`選項「${ch.text}」的城防失守節點\`);

            }

            if (eff.type \=== 'CREATE\_SUBJUGATION\_NODE') {

              checkTarget(eff.definition.victoryNodeId, \`選項「${ch.text}」的討伐勝利節點\`);

              checkTarget(eff.definition.defeatNodeId, \`選項「${ch.text}」的討伐失敗節點\`);

            }

          }

        }

      }

    }

    return issues;

  }

}

---

## 📊 四、 模組三：流程圖（Graph）異常標註與視覺警示

### 影響檔案：`src/tools/story-studio/StoryStudioGraph.ts`

1. **斷鏈與無效引用標註**：  
   * 若發現目標節點 ID 為空或不存在，在來源節點右側渲染 **紅色警告徽章（`⚠️ 斷鏈`）**。  
2. **不可達孤島節點標註**：  
   * 入度為 0 且無前置條件的非起始節點，以 **黃色虛線邊框** 標註為「孤島節點」。  
3. **戰役與討伐連線色標規範**：  
   * **守城/討伐勝利**：繪製 **綠色實線箭頭 (\#22c55e)**，標註 `[勝]`。  
   * **城防/討伐失敗**：繪製 **紅色實線箭頭 (\#ef4444)**，標註 `[敗]`。  
   * **排程時間連線**：繪製 **藍色虛線箭頭 (\#3b82f6)**，標註 `[延遲 N 天]`。

---

## 🛡️ 五、 模組四：戰役與據點生命週期防呆引導

1. **守城戰役（`TRIGGER_RAID`）防呆**：  
   * 提示創作者「守城勝負節點受 `isRaidTargetNode` 保護，戰役結束後系統會自動標記本節點完成，請務必配置勝負跳轉目標」。  
2. **討伐據點（`CREATE_SUBJUGATION_NODE`）防呆**：  
   * 預設勾選 `removeOnVictory: true`。  
   * 若失敗節點未包含 `REMOVE_MAP_NODE` 效果，在驗證報告中給予建議提醒。

---

## 📋 六、 實作查核清單（Checklist）

- [ ] **Step 1: UI 表單下拉化** (`StoryStudioForm.ts`)  
- [ ] **Step 2: 深度靜態驗證升級** (`StoryStudioStore.ts`)  
- [ ] **Step 3: 流程圖可視化增強** (`StoryStudioGraph.ts`)  
- [ ] **Step 4: 測試與驗證**

