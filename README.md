# 工具基地：可驗證的積木世界原型

中央是一般 HTML / CSS 工具入口，背景是 Three.js 即時渲染。恐龍、積木地景、雲與圖示都由程式建立，不使用生成圖片充當 3D 場景。

## 本機開啟

已安裝 Node.js 的電腦，在此資料夾執行：

```powershell
node preview.mjs
```

用瀏覽器開啟 http://127.0.0.1:4173 。按 Ctrl+C 停止。無須 npm install，也無須外部 CDN。請透過 HTTP 預覽，不要直接雙擊 dist/index.html，瀏覽器會限制本機 ES module。

## 可驗證的內容

- 六個大方塊入口：滑鼠、觸控與鍵盤皆可操作。
- 搜尋名稱、中文用途與英文關鍵字；Ctrl / ⌘ + K 聚焦搜尋，Enter 或 Google 按鈕會另開 Google 查詢。
- 目前六個工具均為範例，點擊會明確顯示尚未串接。沒有真的轉檔、查詢或提交資料。
- 右下角積木恐龍：斜向前方原地跑，擺腿、擺臂、尾巴與身體起伏。
- 地景斜向恐龍後方循環，草原、沙漠、海岸、雪地與森林可立即切換。
- 右上角月亮 / 太陽切換白天、黑夜：場景光線、月亮星空與介面一起變化，並在同一瀏覽器記住選擇。
- 遠方移除方塊山；雲改為連續的柔邊輪廓。恐龍增加腹板、鼻孔、腳趾與組裝線條，仍採積木造型。
- 暫停 / 播放；設定可選均衡、精緻、輕量，以及每 30 秒自動輪換環境。
- 設定中的驗證資訊顯示實際 FPS、繪製呼叫與三角形數量；背景分頁會停止動畫。
- 系統要求減少動態時，預設停止動畫；無 WebGL2 時工具入口仍可操作。
- 手機改為兩欄，內容可垂直捲動；桌面維持三欄。

## 接上實際工具

編輯 dist/tools.js 的名稱、描述、關鍵字及 url。將 null 改為實際內部 HTTPS 網址後，方塊會成為另開分頁的真實連結。不要在前端檔案內放密碼或存取權杖。

## 檔案

- dist/index.html、dist/styles.css：語意結構、設定介面、積木卡片與響應式排版。
- dist/app.js：搜尋、視窗、場景控制及 3D 失敗時的替代狀態。
- dist/tools.js：可替換的工具目錄。
- dist/world.js：Three.js 場景、恐龍、環境循環、3D 圖示與畫質控制。
- dist/forest-world.js、snow-world.js、sun-world.js、day-life.js、tumbleweed.js、volumetric-fog.js：各環境與氛圍效果。
- dist/company-location.js、sky-model.js、sky-projection.js、sun-sky.js、moon-sky.js、moon-phase.js、sky-settings.*：公司所在地、日月天空與設定面板。
- dist/route-editor.*、route-curves.js、route-data.js、ufo-default-route.js：UFO 航線編輯與預設航線。
- dist/vendor/：固定版本 Three.js 0.180.0、SunCalc、Lucide 與各自授權。
- preview.mjs：只綁定本機的靜態預覽伺服器。
- scripts/：check-*.mjs 為驗證腳本，benchmark-sky-projection.mjs 為效能微基準。

## 驗證

```powershell
npm run verify
```

`npm run check` 對 dist/ 所有 JS 與 preview.mjs 做語法檢查；`npm run test` 執行 scripts/check-*.mjs。

## 天色與晨昏

設定公司所在地後，天色預設隨所在地的真實太陽高度連續變化：夜晚 → 黎明（粉橘）→ 白天 → 黃昏（橘紅）→ 夜晚。晨昏的時間由當天的日出日落自然決定，不使用固定時刻。即時模式與月亮、太陽預覽共用同一套天色計算，預覽某個時間點看到的天色，就是即時模式在該時間點的樣子。預覽播放在晨昏時會自動放慢，方便觀賞。

設定中的「天色隨所在地變化」可關閉；關閉後，或按右上角月亮／太陽按鈕，會改為手動切換日夜。未設定所在地時一律為手動。

## 原型範圍

這版用於驗證構圖、操作與 3D 動態，不是公司正式入口。尚未串接公司登入、權限、工具真實資料或後台管理。地景比概念生成圖簡化，不承諾逐像素還原；持續動畫的流暢度需再於同仁實際設備上評估。

正式公司內部部署時，可將 dist/ 部署至公司靜態網站服務，再接公司現有身分驗證。此原型的私人預覽存取不等於公司 SSO。

## 海岸場景

底部的「海岸」按鈕會切換為沙灘、棕櫚與平靜海面；黑夜模式也會套用到海岸。設定中的自動輪換會依序走訪草原、沙漠、海岸、雪地與森林。
