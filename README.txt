MCI Trainer TW 多人同步 MVP v1.0

這一版支援：
- 教官建立 6 位數房間碼
- 手機瀏覽器加入同一場演練
- 指揮官
- 一次檢傷官
- 二次檢傷官
- 後送官
- 戰情中心
- 多裝置即時同步
- 救護車隨機派遣並立即到場
- 救護車多人載送規則

本機測試：
1. 安裝 Node.js 18 以上版本。
2. 在此資料夾開啟終端機。
3. 執行：npm install
4. 執行：npm start
5. 電腦開啟：http://localhost:3000

手機測試：
1. 手機與電腦連接同一個 Wi-Fi。
2. 查詢電腦區域網路 IP，例如 192.168.1.100。
3. 手機開啟：http://電腦IP:3000
4. 教官建立房間後，其他手機輸入 6 位數房間碼加入。

正式跨網路使用：
需要部署到可公開連線的伺服器，例如 Render、Railway、Fly.io 或自有主機。
此壓縮檔未包含正式雲端主機帳號與網域。


MCI Trainer TW｜雲端部署版

方案：Render 公開網址部署

準備項目：
1. GitHub 帳號
2. Render 帳號
3. 將這個專案上傳至一個 GitHub Repository

GitHub 上傳：
1. 在 GitHub 建立新的 Repository，例如 mci-trainer-tw。
2. 將本資料夾內所有檔案上傳到 Repository 根目錄。
3. 確認根目錄可看到：
   package.json
   server.js
   render.yaml
   public/index.html

Render 部署：
1. 登入 Render。
2. 選擇 New，接著選 Blueprint。
3. 連結剛剛建立的 GitHub Repository。
4. Render 會讀取 render.yaml。
5. 確認服務名稱與方案後開始部署。
6. 部署成功後，Render 會提供一組公開 HTTPS 網址。

完成後：
- 教官可用公開網址建立房間。
- 不同 Wi-Fi、行動網路及不同地點的手機都可加入。
- 不需要安裝 Node.js。
- 手機只需開啟網址並輸入房間碼。

重要限制：
- 目前房間資料保存在伺服器記憶體內。
- 雲端服務重新啟動或休眠後，房間與演練資料可能消失。
- 免費方案可能會休眠，首次開啟可能需要重新喚醒。
- 下一階段需加入 PostgreSQL 或其他資料庫，才能永久保存演練紀錄。
- 目前沒有帳號驗證，請先用於封閉測試，不要放入真實病患個資。

替代方式：
- Dockerfile 可用於 Railway、Fly.io、自有主機或其他支援 Docker 的平台。
