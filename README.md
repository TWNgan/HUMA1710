# HUMA1710 Midterm 衝刺站（Modules 2 & 3）

👉 **網站：https://twngan.github.io/HUMA1710/**（單一 HTML 檔，可離線使用，手機都用得）

HKUST HUMA1710 *The Art of Thinking in the Hong Kong Context* 期中考溫習網站：

- 📚 **筆記**（繁體中文＋英文關鍵詞）：語理分析、問題分類、語言的陷阱（李天命 6 陷阱／講者 4 陷阱＋謬誤）、Copi: Language、定義、意義判準、兩個基要的方法學區分
- ✍️ **練習**：約 700 條 MC + True/False，即時對答案＋解釋；答錯會間隔再出（spaced retrieval）
- ⏱️ **模擬考**：計時、同真考試一樣格式
- 🃏 **閃卡**（Leitner boxes）、❌ **錯題本**、⚡ **速記表**、🔀 **易混淆對照**、🎙️ **課堂補充**（考試提示）
- 進度只儲存喺你自己部機嘅瀏覽器（localStorage）

設計根據學習科學研究：practice testing（retrieval practice）同 distributed practice 係 Dunlosky et al. (2013) 評為最高效用嘅兩種方法；練習題型同考試一致（Adesope et al., 2017）。

## 結構

```
index.html                 ← GitHub Pages 入口（build 出嚟嘅單一檔案）
HUMA1710_Midterm_Study.html← 同一個檔案（離線用）
notes/                     ← 各章筆記（Markdown）
study-site/
  build.js                 ← node build.js：notes + data + content → index.html
  src/                     ← template / styles / app.js
  data/                    ← mc.js（MC 題）、cards.js（閃卡）、lecture_q_*.json（課堂題）
  content/                 ← 讀書方法、速記表、易混淆、課堂補充
```

重新 build：`cd study-site && npm install && node build.js`

> 課程原始材料（lecture notes、readings、錄音）屬版權材料，冇放入此 repo。
