# 开发会话日志 (Development Session Log)

**概述**: 本文档记录每次开发会话的内容、投入的“Prompt轮数/精力”以及具体的技术产出。

---

## 2026-02-27 01:20 - UI/UX精细化与Bokeh样式精修 (v12.1.61 / s1.5.39)

### Tasks Completed:
1. **Wiki Bokeh AI 输出样式精修**: 优化了搜索结果中的回答排版，将正文颜色设为灰色 (#888)，而标题与加粗内容设为纯白色 (#fff)，显著提升了视觉层次感。
2. **Toast 消息标准化**: 弹出位置移动至右上角，并采用顶部向下的滑动动画，符合现代交互习惯。
3. **品牌色一致性 (Kine Green)**: 全局统一 AI 相关组件色值为标准 Kine Green (#00A650)。
4. **Wiki 编辑器逻辑增强**: “保存修改”按钮现已完美集成自动保存草稿功能，确保内容更新与本地持久化同步执行。
5. **AI 场景提示词管理升级**: 支持在管理后台在线编辑“工单智能解析”场景的 System Prompt，后端逻辑改为优先读取数据库。
6. **版本发布准备**: 递增版本至 Client v12.1.61, Server v1.5.39。

### Technical Output:
- **Modified**: `client/src/components/KinefinityWiki.tsx`, `client/src/components/Knowledge/WikiEditorModal.tsx`, `client/src/components/Admin/AdminSettings.tsx`, `server/service/ai_service.js`, `client/package.json`, `server/package.json`

---

## 2026-02-27 01:00 - UI/UX Refinement & Deployment (v12.1.59 / s1.5.37)
- **Deployment**: v12.1.59 / s1.5.37 via `mini` (Verified)

---

## 2026-02-26 10:30 - Wiki Import 评论区清理 & Bokeh 术语映射 (v12.1.53 / s1.5.31)

### Tasks Completed:
1. **评论区清理 (Article 756)**:
   - 在 `removeContentTitle` 增加 HTML 阶段分层截断：强信号(热门评论/免责声明) 5% 阈值，普通信号(相关推荐) 20% 阈值。
   - 新增"文章来源"版权行移除。
   - 直接清理 Article 756 数据库内容（从 5826→466 字节）。
2. **Bokeh 术语映射**:
   - Layout 提示词增加 Eagle=猎影 专有名词翻译对照表。
   - 增加内容清洁规则（自动移除评论区、免责声明等）。

### Technical Output:
- **Modified**: `server/service/routes/knowledge.js`, `client/package.json`, `server/package.json`
- **Deployment**: v12.1.53 / s1.5.31 via `./scripts/deploy.sh`

---

## 2026-02-26 09:00 - Wiki Import Deep Fix & UI Optimization (v12.1.51 / s1.5.29)

### Tasks Completed:
1. **Wiki Import Deep Fix**: 
   - Fixed `removeContentTitle` scoping issue in `knowledge.js`.
   - Enhanced HTML cleaning: breadcrumbs, navigation (Previous/Next), and generic noise removal.
   - Refined AI prompts for translation and formatting to prevent full HTML page returns.
   - Fixed `aiService.generate` method name mismatch.
2. **UI Optimization**: 
   - Redesigned TopBar version display: changed from single horizontal row to dual-row vertical layout for better readability on narrow viewports.
3. **Internal Release**: 
   - Incremented versions: Client `12.1.51`, Server `1.5.29`.
   - Updated deployment infrastructure and verified on Article 750.

### Technical Output:
- **Modified**: `server/service/routes/knowledge.js`, `client/src/App.tsx`, `client/package.json`, `server/package.json`
- **Deployment**: Local build confirmed; Remote deployment via `./scripts/deploy.sh`.

---

## 2026-02-25 17:00 - Knowledge Import H1 Removal & DOCX Progress Fix

### Tasks Completed:
1. **H1 Tag Removal Fix**: Fixed `knowledge.js` line 988 to use `cleanedContent` (with all H1 tags removed) instead of `chapter.content` when saving web import content. The `removeAllH1()` function was correctly implemented but not properly used.
2. **DOCX Upload Progress Bar**: Fixed `KnowledgeGenerator.tsx` lines 264-267, changing step id from incorrect `'fetch'` to correct `'upload'` for DOCX mode, enabling proper progress bar state updates.

### Technical Output:
- **Modified**: `server/service/routes/knowledge.js` (line 988), `client/src/components/KnowledgeGenerator.tsx` (lines 264-267)
- **Deployment**: Successfully deployed via `./scripts/deploy.sh`

---

## 2026-02-25 15:30 - Knowledge Web Import Robustness & Content Extraction Enhancement

### Tasks Completed:
1. **Web Import Failure Handling**: Added content length validation (minimum 100 characters) in `knowledge.js`. Returns 400 error with user-friendly message suggesting Jina Reader mode when content extraction fails.
2. **Content Extraction Enhancement**: Refactored `extractWebContent()` function with 30+ CSS selectors to filter out sidebars, QR codes, banners, ads, recommendations, and other non-content elements.
3. **Image Deduplication**: Implemented image URL deduplication using Set tracking, plus filtering of non-content images (logos, icons, avatars, loading placeholders).
4. **Wiki Navigation Fix**: Modified `KinefinityWiki.tsx` to clear selected article state when URL has navigation parameters (line/model/category), preventing auto-restoration of last viewed article.

### Technical Output:
- **Modified**: `server/service/routes/knowledge.js`, `client/src/components/KinefinityWiki.tsx`
- **Release**: Client v12.1.43, Server v1.5.21

---

## 2026-02-24 16:20 - Knowledge Import Optimization & Web Scraping (v1.3.4)

### Tasks Completed:
1. **Web Scraping Engine**: Implemented automatic chapter splitting based on H1/H2 tags for both Turbo (Markdown) and Standard (HTML) modes in `knowledge.js`. 
2. **Title Extraction**: Enhanced title recognition logic to prioritize Markdown headers and metadata, ensuring imported articles have accurate titles.
3. **Import UI Refinement**:
   - Fixed product model selection text color (Gray -> White) for better contrast.
   - Dynamically adjusted progress step labels (e.g., hiding "Upload File" for URL imports).
   - Updated "Complete" button color to **Kine Green (#00A650)**.
4. **Content Cleaning**: Added logic to strip hardcoded white backgrounds from imported HTML content, ensuring better theme integration.

### Technical Output:
- **Modified**: `client/src/components/KnowledgeGenerator.tsx`, `server/service/routes/knowledge.js`
- **Release**: Client v12.1.32, Server v1.5.26

---

## 2026-02-24 13:50 - Detail State Persistence & Navigation Restoration

### Tasks Completed:
1. **State Persistence**: Created `useDetailStore.ts` using Zustand `persist` middleware. Connected `expandedSection` and `showAllContacts` to it, keyed by `accountId`.
2. **Navigation Restoration**: Reverted internal `navigate` to `window.open` for article and ticket cards in Wiki and Detail pages to satisfy multi-tasking requirements.
3. **Wiki UI Refinement**: Adjusted search input width to be narrower and increased search history tab label width to 240px.

### Technical Output:
- **Modified**: `client/src/components/CustomerDetailPage.tsx`, `client/src/components/KinefinityWiki.tsx`, `client/src/package.json`, `package.json`
- **New**: `client/src/store/useDetailStore.ts`

---

## 2026-02-24 13:20 - Detail Page Layout & Navigation Standardization

### Tasks Completed:
1. **Black Screen Resolution**: Corrected a layout conflict where detail pages (`InquiryTicketDetailPage.tsx`, `DealerRepairDetailPage.tsx`, `RMATicketDetailPage.tsx`) used `height: 100vh` and a solid black background inside a flex container. Changed to `flex: 1` and `background: transparent` to inherit from `MainLayout`.
2. **Standardized SPA Navigation**: Replaced `window.open` calls in `KinefinityWiki.tsx` with standard `navigate`, ensuring authentication and application state are maintained consistently without triggering full-tab reloads or state drifts.
3. **Machine Asset Linkage**: Restored the missing interaction on the Customer Detail Page's asset list. Clicking a `ProductCard` now navigates to the Tech Hub (Wiki) filtered by the device's serial number.

### Technical Output:
- **Modified**: `client/src/components/CustomerDetailPage.tsx`, `client/src/components/KinefinityWiki.tsx`, `client/src/components/InquiryTickets/InquiryTicketDetailPage.tsx`, `client/src/components/RMATickets/RMATicketDetailPage.tsx`, `client/src/components/DealerRepairs/DealerRepairDetailPage.tsx`

---

## 2026-02-24 13:03 - UI Responsive Grid & SVC Logic Contextualization

### Tasks Completed:
1. **Responsive Grid Layout**: Refactored `CustomerDetailPage.tsx` styling for stats grid and list containers to use `repeat(auto-fill, minmax(280px, 1fr))`, ensuring mobile-first compatibility and preventing horizontal scroll issues.
2. **Multi-language Hardcoding Cleanup**: Wrapped all dashboard statistics and device category strings with `tc()` helper. Fixed TS2345 errors related to i18next parameter typing for default strings.
3. **SVC Ticket Context Logic**: Modified data processing in `CustomerDetailPage.tsx` to pass context-aware names to `TicketCard`.
   - When on Dealer page: Shows End Customer Name/Contact.
   - When on Customer page: Shows Processor Dealer Name/Contact.
4. **Contact API Bugfix**: Fixed `is_primary` logic in `server/service/routes/contacts.js` to ensure exclusive primary status per account (toggling one clears others).
5. **Product UI Redesign**: Rewrote `ProductCard.tsx` with a new horizontal Pill-style layout, utilizing `var(--glass-bg)` and distinct border colors based on product family for better visual hierarchy vs. tickets.

### Technical Output:
- **Modified**: `client/src/components/CustomerDetailPage.tsx`, `client/src/components/ProductCard.tsx`, `client/src/components/TicketCard.tsx`, `server/service/routes/contacts.js`, `package.json` (v12.1.30)

---

## 2026-02-24 10:30 - Wiki State Persistence & UI Formatting

### Tasks Completed:
1. **Search History Alignment**: Modified `KinefinityWiki.tsx` to align the dynamic search history dropdown to the right (`right: 0`) instead of the default left to fit neatly below the floating search input.
2. **Ticket List Search Expansion**: Updated the `searchOpen` initialization across `InquiryTicketListPage`, `RMATicketListPage`, and `DealerRepairListPage` to interpret active URL parameters and maintain an expanded standard text-box UI instead of defaulting back to a collapsed magnifying glass icon.
3. **Wiki Global State Management**: Architected a new front-end service `client/src/store/useWikiStore.ts` utilizing Zustand and LocalStorage middleware.
4. **Wiki Refactoring**: Replaced legacy `useState` instances representing user context (activeSearch, query keywords, product tab focus) with calls to the global store, enabling seamless route persistence without modifying URL schemas.
5. **Quality Assurance**: Added automated test scripts executing in NodeJS (`client/src/store/useWikiStore.test.ts`) to validate state mutations mathematically.

6. **Deployment**: Incremented software version to `12.1.29`, fixed TypeScript build blockers (bypass strict i18next key typing), and successfully deployed to the remote server using `deploy.sh`.

### Technical Output:
- **Created**: `client/src/store/useWikiStore.ts`, `client/src/store/useWikiStore.test.ts`
- **Modified**: `client/src/components/KinefinityWiki.tsx`, `client/src/components/InquiryTickets/InquiryTicketListPage.tsx`, `client/src/components/RMATickets/RMATicketListPage.tsx`, `client/src/components/DealerRepairs/DealerRepairListPage.tsx`, `client/package.json`

---

## 2026-02-24 10:15 - Bokeh UI Refinement & Accounts Save Concurrency Lock

### Tasks Completed:
1. **AI Chat Bubbles UI**: Fixed the rendering of assistant messages by removing the green border (`1px solid rgba(0, 191, 165, 0.2)`) and stripped out inline widths (`width: 100%`) in `ReactMarkdown`'s `<p>` tag renderer to ensure ordered and unordered lists (`<ol>`, `<ul>`) do not unexpectedly indent.
2. **Kinefinity Wiki Results Cards**: Removed the dot separator between category and product line in `ArticleCard`. Reverted the `Customer / Dealer | Contact` separator back to `·` on `TicketCard`. Implemented `t()` translation mapping for `TicketCard` statuses.
3. **Customer Form Dialog**: Discovered a critical `SQLITE_BUSY` transaction locking bug in the React CRM Management interfaces. When editing contacts and switching the `is_primary` user, calling `Promise.all(axios.post)` triggered SQLite database lock exceptions. Converted saving loops to synchronous `for...of` iteration arrays.
4. **CRM Form UI**: Increased the CSS width of the `KinefinityWiki` search field dynamically, enforced `minHeight: 600px` on `CustomerFormModal` wrapper to prevent height jitter when switching between "Basic Info" and "Contacts" tabs, and added primary contact selection tips below the contact table.

### Technical Output:
- **Modified**: `client/src/components/Bokeh/BokehPanel.tsx`, `client/src/components/KinefinityWiki.tsx`, `client/src/components/CustomerManagement.tsx`, `client/src/components/DealerManagement.tsx`, `client/src/components/CustomerFormModal.tsx`

---

## 会话: 2026-02-24 (Bokeh Search Fallback & Display Formality Fix)

### 任务: 添加 FTS `LIKE` 降级兜底、注入 `contact_name` 上下文及重构卡片去重连接符
- **状态**: ✅ 已完成
- **技术产出**:
    - **Search Fallback**: 在 `ai_service.js` 修复 `knowledge_articles_fts` 虚拟表名称，并在命中为空时强制调用 `LIKE` 执行兜底，彻底解决“端口定义”无法命中的 Bug。
    - **Prompt Injection**: 将检索出的 `contact_name` 加入了推给大模型的 Context 信息区块中，修复了此前后台查出了联系人姓名但没有喂给 AI 的断链问题。
    - **Format Cleanup**:移除了 `KinefinityWiki.tsx` 内对于 SVC工单中强加的 "经销商:" 前缀。将普通与维修单的去重合并符从小圆点 `·` 改为垂直线 `|`。
    - **Release**: 版本号自增至 `12.1.28`，并完成在 `mini` 远端的自动部署。

---

## 会话: 2026-02-24 (Bokeh Search & Interaction Depth Optimization)

### 任务: 知识库宽泛检索优化、新标签页交互转换及数据去重显示
- **状态**: ✅ 已完成
- **技术产出**:
    - **RAG**: 在 `ai_service.js` 中引入分词处理与 `OR` 检索策略，替代原有严格模式，提升 AI 上下文关联度。
    - **Interaction**: 更新 `BokehPanel.tsx` 交互逻辑，采用 `window.open` 实现平滑外链跳转，清理冗余 `TicketDetailDialog` 组件。
    - **UI**: 重构 `TicketCard` 名称渲染逻辑，针对 SVC 与普通工单实施条件渲染与去重标识。
    - **Ops**: 自动化版本迭代并完成远程同步。

---

## 会话: 2026-02-24 (Bokeh UI & Search Quality Optimization)

### 任务: Bokeh UI 视觉打磨、搜索逻辑修复及 SVC 工单数据富化
- **状态**: ✅ 已完成
- **技术产出**:
    - **UI**: 更新 `BokehPanel.tsx` 视觉样式，用户气泡改为 Kine Green (`#4CAF50`)，助手气泡采用深灰色半透明方案。
    - **搜索**: 修复 `bokeh.js` 与 `ai_service.js` 中的 SQL 拼接 Bug，统一引入 `1=1` 前缀。
    - **数据**: 在工单搜索中集成 `dealer_id` 富化，修正 SVC- 工单的经销商展示逻辑，并在 `TicketCard` 增加 "经销商:" 标识。
    - **AI**: 增强链接生成约束，禁止编造 Slug。

---

## 会话: 2026-02-24 (Knowledge Importer Improvements)

### 任务: 修复 URL 导入报错、支持产品型号多选及进度面板重构
- **状态**: ✅ 已完成
- **技术细节**:
    - **URL 导入逻辑修复**: 在 `knowledge.js` 中重构了 `import/url` 路由。通过预定义关键变量（`articleTitle`, `summary`, `sourceReference`）并标准化 Turbo (Jina) 与 Standard 模式的分支输出，彻底消除了由于 `extractedContent` 作用域限制导致的 `ReferenceError` 导入失败问题。
    - **产品型号多选实现**: 将 `KnowledgeGenerator.tsx` 中的单选下拉框替换为自研的多选标签组组件。利用 `productModels` 数组存储状态，并提供平滑的选中/取消点击交互，支持了单一文章跨多个产品机型的批量关联同步。
    - **进度弹窗 UI 重构**: 遵循 macOS26 极简设计原则，将原本处于 Grid 布局中的多个碎片化信息图标重塑为一段叙述性文字描述。通过文字加粗与关键信息变色（Kine Yellow），让导入过程中的元数据一目了然，显著提升了品牌感。
- **版本**: Client v12.1.25 (已同步)

---

## 会话: 2026-02-24 (Wiki & Bokeh UI Polish)

### 任务: Wiki 来源过滤、工单卡片修复及 Bokeh 视觉增强
- **状态**: ✅ 已完成
- **技术细节**:
    - **Wiki 参考来源过滤**: 在 `KinefinityWiki.tsx` 的 `ArticleSection` 组件中，为 `referenceArticles` 添加了 `source_type === 'knowledge'` 的过滤条件。此举移除了搜索关联中干扰的工单卡片，使 Wiki 界面回归纯净的知识库属性。
    - **UI 细节优化**:
        - 修改了 Wiki 的 “Show More” 按钮颜色为淡灰色 (`#888`)。
        - 将操作菜单从 “操作首选项” 重命名为 “操作”。
    - **工单卡片健壮性修复**: 在 `TicketCard` 组件中引入了 `isValid` 检测逻辑，拦截了字符串形式的 `"null"` 和 `"undefined"`。现在支持在只有 `customerName` 或 `contactName` 时优雅展示，避免了视觉上的逻辑真空。
    - **Bokeh Chat 视觉打磨**:
        - **配色对齐**: 调整 `BokehPanel.tsx` 中的用户气泡颜色为 **Kine Yellow** (`#FFD700`)，并将文本设为黑色，显著提升了品牌识别度并增强了对比度。
        - **引用图标优化**: 重构了 `TicketLink.tsx` 与 `ArticleCard.tsx`。Wiki 文章引用统一使用 `BookOpen` 图标，工单引用则根据类型自动匹配 `MessageCircleQuestion` (Inquiry), `RefreshCw` (RMA), `Wrench` (Dealer Repair) 或 `Ticket` (Default)。
    - **文档系统瘦身**:
        - **日志整合**: 彻底清理了 `docs` 目录。将 `1_Backlog.md` 的增量内容合并至 `log_backlog.md`，统一了开发任务的流水线追踪。
        - **冗余清理**: 删除了 `fix_logs` 文件夹及过期的实施全景图 (`FULL_DEPLOYMENT_RECAP.md`) 等 4 个文件，降低了文档库的熵值。
- **版本**: Client v12.1.26 (已发版)

---

## 会话: 2026-02-23 (UI Polish & System Fixes)

### 任务: Toast 通知集成、样式对齐与接口解耦
- **状态**: ✅ 已完成
- **技术细节**:
    - **Toast 系统实装**: 在 `AdminSettings.tsx` 中集成了 `useToast` 钩子。通过 `showToast(msg, type)` 替代了阻塞式的 `window.alert`，覆盖了“保存成功”、“删除成功”及“校验失败”等核心反馈场景。
    - **Bokeh 开关样式重塑**: 在 `KnowledgeGenerator.tsx` 中，将 `bokehOptimize` 激活时的背景由 `linear-gradient` 调整为 `rgba(255,215,0,0.12)`，边框调整为 `rgba(255,215,0,0.4)`，确保了与 “A/B/C/D” 分类 Tab 的选中视觉一致性。
    - **公共接口鉴权解耦**: 识别出 `DailyWordBadge` 加载失败的根源在于 `/api/v1/system/public-settings` 接口受到 `authenticate` 保护。将其调整为免鉴权访问，允许客户端在未登录或应用初期安全获取系统名称及展示建议。
- **版本**: Client v12.1.11 (已同步)

---

## 会话: 2026-02-23 (Wiki Search Tab UI Redesign)

### 任务: Wiki 搜索 Tab 重构与 UI 统一化
- **状态**: ✅ 已完成
- **技术细节**:
    - **统一 Tab 面板**: 在 `KinefinityWiki.tsx` 中彻底重构了顶部导航布局，将独立的搜索栏整合到产品族类 Tab (A/B/C/D) 同一行，实现空间的高效利用。
    - **动态搜索 Tab**: 新增 Search Tab 组件。当触发查询时该 Tab 动态出现并高亮。内置下拉式的搜索历史（最多10条近期去重查询，使用 localStorage 存储，支持外部点击自动收起）。
    - **上下文恢复**: 用户手动关闭搜索（点击 x）或切换产品线时，系统基于 `lastProductLine` 记忆自动平滑回退，无需走多余的面包屑导航结构，彻底避免嵌套过深。
    - **多语言与样式对齐**: 新增 `wiki.search.history` 在全语种（zh, en, de, ja）的词条配置；统一了知识生成器 `KnowledgeGenerator` 弹窗的最大宽度与 Bokeh 功能图标颜色，并弱化了 AI 回答面板外框，与暗黑基调原生融合。
    - **构建与测试**: 修复由于大规模迁移视图引发的 JSX 错误拼接块（移除冗余代码）与未使用属性残留，验证 TypeScript 零报错体系。
- **版本**: Client v12.1.7 (已发版)

---

### 任务: 知识库体验深度优化与 UI 规范化
- **状态**: ✅ 已完成
- **技术细节**:
    - **同义词翻译修复**: 纠正了 `SynonymManager.tsx` 中 `useTranslation` 钩子的错误引用（误用了 `react-i18next`），统一切换至本地 `useLanguage` 钩子，解决了同义词管理界面翻译键值解析失效的问题。
    - **左侧路由精简**: 从 `App.tsx` 中移除了独立的 “知识库” 侧边栏入口及相关二级路由，将入口统一收敛至 Wiki 系统的管理菜单中，降低导航负载。
    - **弹窗化改造**: 将 `KnowledgeGenerator.tsx` 从页面重构为 `Modal` 组件。通过 `isOpen`/`onClose` 状态控制，利用 `Fixed` 布局与 `backdrop-filter` 实现了 macOS26 风格的高级毛玻璃弹窗效果。
    - **品牌配色规范化**: 遵循 `Service_PRD.md` 的规范，将 `KnowledgeGenerator` 中所有标志性的 “Kine Green” (`#4CAF50`) 以及相关高亮底色全部替换为 “Kine Yellow” (`#FFD700`)，保持了服务系统视觉语言的高度统一性。
- **版本**: Client v12.1.0 (已发布)

---


## 会话: 2026-02-22 (Wiki Turbo Scraper: Jina Reader Integration)

### 任务: 集成 Jina Reader 提升网页抓取还原度
- **状态**: ✅ 已完成
- **技术细节**:
    - **Jina 转发逻辑**: 后端增加 `turbo` 开关，通过 `r.jina.ai` 获取 Markdown，绕开 Axios 直连的 403 封锁。
    - **图片多模态抓取**: 统一 `saveImageLocally` 逻辑，支持同时从 HTML `img` 和 Markdown 语法中提取并本地化图片（转 WebP）。
    - **前端 UI 面板**: 增加开关组件并关联后端 `turbo` 字段。


## 会话: 2026-02-22 (Wiki Table of Contents UI Polishing)

### 任务: 修复 DOCX 层级渲染与分类底色
- **状态**: ✅ 已完成
- **技术细节**:
    - **修复正则切分**: 移除了 `parseChapterNumber` 中对标题前缀冒号的强制依赖（如 `XXX: 1.1`）。改写为更宽松且精准的非贪婪捕获正则，适配了诸如 `1. 基本说明` 格式，解决了子章节被归类到 `-1` 组的问题。
    - **修复重复序号拼接**: 移除了前端将 `chapterNum` 与已经包含主章节号的 `sectionNum` 再次拼接的冗余逻辑，彻底修复了 UI 渲染 `1.1.1` 这种画蛇添足的显示 Bug。
    - **折叠骨架空文章过滤**: 在 KinefinityWiki 组件的 `articlesInChapter.map` 内部加入 `.filter(article => parseChapterNumber(article.title).section !== null)` 保护逻辑，隐藏掉用于支撑大目录框架但不带真正内容的冗余父级文章（如原“第三章”空壳），使得苹果级折叠效果彻底干净利落。
    - **分类底色移除**: 清除了平铺页面里 `A 类操作手册` 所带的实验性绿色高亮背景，复原为了暗黑底色的悬浮高亮灰度按钮，保证视觉的严谨与统一。
- **版本**: Client v12.0.9 (已上线)

---

## 会话: 2026-02-22 (Knowledge Base Bug Fixes & URL Import Authorization)

### 任务: 修复 DOCX 层级渲染与 URL 抓取授权
- **状态**: ✅ 已完成
- **技术细节**:
    - **DOCX 导入正则增强**: 修改了 `KinefinityWiki.tsx` 中的 `parseChapterNumber` 函数，确保能够正确截取类似 `3.1.2` 的长分节信息。同时增强了 `buildChapterTree` 处理逻辑，实现子章节正确地嵌套在父章节底下展示。
    - **UI 修改**: 移除了在 `showManualTocModal` 中的残留缩进左横线样式，对齐了苹果设计的内敛交互。
    - **本地服务脱钩解耦**: `server/index.js` 移除了强制依赖 `/Volumes/fileserver` 物理盘的写法。改为读取 `STORAGE_PATH` 环境变量或妥协 fallback 至 `./data/DiskA`。解决了开发者启动项目的崩溃死循环。
    - **修复 403 Forbidden 权限阻塞**: 在 `server/index.js` `authenticate` 中加入了漏取的 `user_type` 字段，并在 `knowledge.js` 放开了对于 `user_type` = `Employee` 的身份认证限制。这解除了在 Knowledge Generator 输入 HTTP URL 时的非授权阻止。
    - **网络架构发现**: 探测了 `https://kinefinity.com` 的反爬虫特性（SSL_ERROR_SYSCALL 拒绝握手），确定目前的 Axios/curl 等 Node HTTP 库无法直穿 TLS WAF。
- **版本**: Root v1.5.22 / Client v12.0.6 (待构建发版)

---

## 会话: 2026-02-22 (Merge Conflict Resolution & Deployment)

### 任务: 解决合并冲突与线上部署
- **状态**: ✅ 已完成
- **技术细节**:
    - **处理 Git 合并冲突**: 解决了知识库重构与搜索增强特性之间的合并冲突。排查并清除了 `translations.ts` 中的多余的 `wiki.*` 和 `browser.*` 多语言键值重复定义。
    - **TypeScript 修复**: 恢复了因重置丢失的 `setWikiViewContext`；修复了 `TipTapEditor.tsx` 组件内 implicit `any` 导致的编译报错；补齐了缺失的依赖 (如 `@tiptap/react` 等)。
    - **部署模式切换**: 鉴于线上服务器拉取 GitHub 请求出现高延迟，采用本地编译打包然后 Rsync 分发的 Fast Deploy 脚本 (`deploy.sh`) 成功强制同步代码并上线。
- **版本**: Root v1.5.22 / Client v12.0.6

---

## 会话: 2026-02-21 (Synonym Manager & Search Leniency)

### 任务: 同义词字典管理与工单搜索宽泛化
- **状态**: ✅ 已完成
- **技术细节**:
    - **数据库层**: 创建 `018_search_synonyms.sql` 迁移，支持行业专属同义词（如 录音/拾音/麦克风 等）。
    - **后端服务**: `synonyms.js` 提供 CRUD 接口并维护进程内 `synonymMap` 高速缓存，通过 `expandWithSynonyms` 实时查询扩展。
    - **前端 UI 面板**: 实现独立 `SynonymManager.tsx`，支持颜色分类和 Inline 编辑，嵌入 Wiki 主页面以统一入口。
    - **停用词扩展**: 结合前端 `extractKeywords` 及后端 `splitSearchKeywords` 移除了常见的中文疑问及口语修饰（常见、问题、请问等共计17个）。
    - **工单搜索 OR 匹配**: `bokeh.js` 的 FTS5 引擎行为重写：应用同义词扩展并改用 `OR` 横向模糊匹配，大幅缓解工单搜不到的问题。
    - **UI 一致性**: 重构了 Wiki 工单搜索结果下落区的 "展开更多" 结构，向 AI 面板风格看齐。
- **发版**: 本次所有代码变更均已同步上线 mini 生产环境。

---
## 会话: 2026-02-21 (Search Quality & RMA Card Styling)

### 任务: 提升 Wiki 搜索召回率 & RMA 工单特征色
- **状态**: ✅ 已完成
- **技术细节**:
    - **后端搜索重构**: `knowledge.js` 新增 `splitSearchKeywords` 函数，将整串 LIKE 匹配拆为多关键词 AND 匹配。中文停用词（的、相关、如何等）自动剥离。
    - **前端关键词优化**: `extractKeywords` 增加中文核心词提取（≥2 字符），与英文术语合并去重。
    - **RMA 卡片修复**: 升级 `isTicket` 正则 `/([A-Z]+-)*[A-Z]?\d{4}-\d{4}/`，支持 `RMA-C-` 等多段前缀。
    - **效果**: 搜索"音频的相关设置"从 0 → 4 篇召回，AI 给出基于知识库的结构化回答。
- **版本**: v12.0.4 (e208fab)

---

## 会话: 2026-02-21 (Global Schema Alignment)

### 任务: 将全栈 `customer_id` 对齐为 `account_id`
- **状态**: ✅ 已完成
- **技术细节**:
    - **数据库视图重构**: 更新了所有核心工单视图，移除 `customer_id` 物理列名，统一暴露 `account_id`。
    - **后端逻辑清理**: 移除了 `inquiry-tickets.js` 和 `rma-tickets.js` 中的旧字段 fallback 逻辑，确保 `POST` 载荷只识别新字段。
    - **iOS 模型对齐**: 完成 `Issue.swift` 的重命名与 `CodingKeys` 同步。
    - **前端组件重构**: 
        - 修复了 `DealerRepairDetailPage` 等详情页的重复字段干扰。
        - 彻底重塑 `CustomerContextSidebar` 接口，移除遗留 Prop。
        - 修正了 5+ 处由于属性名变更导致的 TS 类型报错。
    - **文档同步**: 同步更新 `Service_API.md` 和 `Service_DataModel.md` 的示例 Block。
- **版本**: Root v1.5.21 / Client v12.0.5

---

## 会话: 2026-02-21 (Search Indexing & FTS5 Fix)

### 任务: 修复 Wiki 搜索无法召回工单的问题 (Legacy Field & FTS5 Syntax)
- **状态**: ✅ 已完成
- **根本原因分析**:
    - **Schema 不一致**: 后端 `bokeh.js` 代码已重构使用 `account_id`，但 `ticket_search_index` 索引表及全量同步脚本仍在使用旧的 `customer_id` 字段，导致 SQL 报错。
    - **FTS5 匹配失效**: `bokeh.js` 中通配符 `*` 被错误包裹在双引号内 (`"HDMI*"`)，导致针对非空格分割的混合中英文前缀匹配失败。
    - **富化逻辑报错**: 在结果富化阶段，代码仍尝试从 `rma_tickets` 表读取不存在的 `customer_name` 列（实为 `reporter_name`），导致搜索接口返回 500。
- **技术细节**:
    - **Schema 统一**: 对 `011_ticket_search_index.sql` 进行重构，将 `customer_id` 物理更名为 `account_id`，同步修正外键引用。
    - **FTS5 语法修正**: 将 `safeQuery` 构建逻辑调整为 `*` 在引号外 (`"word"*`)。
    - **全量索引重建**: 清理线上 FTS 缓存，重新灌入 43 条工单记录，覆盖 Inquiry/RMA/DealerRepair。
    - **健壮性增强**: 为 `bokeh.js` 富化逻辑添加了 `try-catch` 保护和字段 fallback。
- **验证**:
    - ✅ “HDMI”搜索成功召回 `K2601-0019` 等工单。
    - ✅ “音频”搜索成功召回 `RMA-C-2601-0002` 工单。
- **版本**: Root v1.5.21 / Client v12.0.4

---

## 会话: 2026-02-21 (Search & UI Regression Fixes v12.0.1)

### 任务: 核心搜索范围扩容、SQL 容错与 Wiki 顶栏 UI 恢复
- **状态**: ✅ 已完成
- **技术细节**:
    - **搜索过滤层级解除 (Backend)**: 在 `bokeh.js` 与 SQL 视图层级彻底移除了 `closed_at IS NOT NULL` 与 `status` 过滤条件。使得处于任何状态的工单（特别是处理中的故障案例）均能被 FTS5 并入检索流。针对非搜索态导致的空 `whereClause` 加入了 `1=1` 兜底，解决了 500 崩溃错误。
    - **跨模块 UI 穿透 (Frontend)**: 优化 `App.tsx` 顶栏渲染门禁，成功将 `DailyWordBadge`（每日一词）的有效期扩展至 `/tech-hub/wiki` 路径，解决了 Wiki 模块下该勋章缺失的功能性回归。
    - **状态同步与交互标准化 (Frontend)**: 重构 `handleSearchBackClick` 方法，实现对 `showSearchResults`、`setIsSearchMode` 及查询参数的全量重置，并利用 `window.open` 取代子应用内的 `navigate` 跳转，保证了工单/文章的独立查阅能力不破坏当前导航树。
- **版本**: Root v1.5.21 / Client v12.0.1

---

## 会话: 2026-02-21 (Wiki UI & Interaction Optimization)

### 任务: 导航交互优化与视觉样式对齐
- **状态**: ✅ 已完成
- **技术细节**:
    - **导航流重塑**: 将 Wiki 主页中所有文章卡片和工单卡片的 `onClick` 逻辑从单页应用内部跳转（`navigate`）升级为通过原生 `window.open` 打开独立浏览器 TAB。有效保持了用户的搜索上下文。
    - **引用卡片化组件**: 在渲染 AI 回答时，针对 Markdown 的 `a` 标签进行了组件化重叠。当检测到链接文本为引用格式（如包含 `[]`）时，自动渲染出一个 `inline-flex` 的小型圆角背景卡片，并带有品牌绿色彩和 `Lucide` 类型图标（工单或文档）。
    - **UI 视觉统一**: 优化了“最近浏览”顶部的折叠逻辑。使用了与“关键词搜索”区块完全一致的 `background: rgba(255,255,255,0.05)` 的方框按钮，从而摒弃了原本简陋的纯图标模式。
- **版本**: Root v1.5.21 / Client v11.8.12

---

## 会话: 2026-02-21 (Search Experience Enhancements)

### 任务: 核心工单搜索增强与 UI 解耦合重构（6大项）
- **状态**: ✅ 已完成
- **技术细节**:
    - **短查询处理 (Backend)**: 原有 FTS5 `trigram` 索引因依赖至少 3 字符，无法检索类似"端口"或"拍摄"等双字或单字短查询。在 `bokeh.js` 的 `search-tickets` 搜索中针对 `<3` 长度的关键词加入了自动的 `LIKE @likeQuery` 向下兼顾方案。
    - **返回字段填充 (Backend)**: 调整后端 SQL 语句，使其能在搜索后对属于 `inquiry_tickets` 和 `rma_tickets` 类型的条目，联表检索并返回对应的 `customer_name` 和 `contact_name`。
    - **前端加载生命周期 (Frontend)**: 重构了 `KinefinityWiki.tsx` 在处理全站模糊检索动作时的 Loading 阻塞问题。将文章与关联工单分开处理，文章优先展示渲染，而工单采取独立的 `isTicketSearching` 异步拉取。确保工单卡片区拥有完善的 `Spinner` 及 `Empty` 三态保障。
    - **UI 精简与对齐 (Frontend)**: 在侧边栏的对话参考中清除了二级标题（文章/工单 N 篇），改为混合的无缝拼接信息流，且设定初始展示极限为3条并在右侧提供直接展开选项。TicketCard 接收展示了后台补充的客户名称以丰富上下文。
    - **AI 关联提效**: 原有的 AI 仅通过阅读文档（Articles）作答，本次更新通过在 Prompt 系统消息内强力注入相关的 Ticket 对象（原标题、描述与解决方案），进一步使 AI 能依据前人的真实故障回复给出处理意见。

---

## 会话: 2026-02-21 (Wiki Regression Hotfixes)

### 任务: 修复发版后的功能性回归与版本号规范执行
- **状态**: ✅ 已完成
- **技术细节**:
    - **Backend 500 Error (AI Dialog & Search)**: 
        - **根本原因**: 前置部署启用了系统设置对应的数据库表 `ai_providers` 以管理 AI 配置，但初始化数据未写入有效的 `api_key`（为 NULL）。代码中原逻辑覆盖了走 `.env` 环境变量的策略。此外，生产环境的 `authenticate` 仍旧关联了废弃的 `departments` 表发生 LEFT JOIN 错误。
        - **修复**: 在 `service/ai_service.js` 的 `_getActiveProvider` 方法内，如果查到的 provider 无明确的 `api_key`，强制向后 fallback 到 `process.env.AI_API_KEY`；精简 `server/index.js` 的 `authenticate` 纯净读取 `users`。
    - **Frontend Rendering Regression**:
        - **根本原因**: 重构期间误将 `KinefinityWiki.tsx` 主视图区（包括A/B/C/D产品族列表与最近文章）包裹进了 `showSearchResults` 条件，致使非搜索态下内容整体隐匿。
        - **修复**: 拆除不合理的门控逻辑，重写 `!isSearchMode` 视图。
    - **Deployment Standard**: 
        - 遵照用户指示的《协作规范》，严格在补丁修复后（哪怕非强功能迭代）全面 bump `package.json`（Root->v1.5.18, Client->v11.8.9），并实施强制的客户端远端重新 `build` 与 `scp` / `rsync` 投递，以确立生产环境验证标识。

---

## 会话: 2026-02-21 (Knowledge Base Search Optimization)

### 任务: 修复知识库搜索与编译问题
- **状态**: ✅ 已完成
- **技术细节**:
    - **折叠面板**: 修复 `!showKeywordPanel` 导致 DOM 卸载的问题，改为仅控制内容区域和样式的折叠展开。
    - **关键字提取**: 重新实现 `extractKeywords`，通过细化正则保留如 Edge 8K、fps 等复合和技术短语，提升向后端（`/api/v1/bokeh/search-tickets` FTS5）查询的准确性。
    - **编译异常**: 
        - 内联重写了由版本更新遗失的 `ArticleCard` 和 `TicketCard` 组件。
        - 修复 `useBokehContext` 变量名称变更相关的 TypeScript 类型错误。
        - 针对四个语种（zh, en, de, ja）在 `translations.ts` 末尾节点补充了关联 `wiki.*` 与 `common.*` 等翻译缺失键值。

---

## 会话: 2026-02-21 (Git Sync)

### 任务: 执行 Git Pull 并同步远程更改
- **状态**: ✅ 已完成
- **技术细节**:
    - **问题**: 初次执行 `git pull` 时遇到 `SSL_ERROR_SYSCALL` (LibreSSL)。
    - **对策**: 使用 `git fetch origin` 验证连接并先行拉取对象，随后使用 `git pull --no-rebase --no-edit` 强制执行合并策略。
    - **合并内容**:
        - `client/src/components/KinefinityWiki.tsx`: 远程版本更新。
        - `client/package.json`: 版本号或依赖项更新。

---

## 会话: 2026-02-21 (Knowledge Base Document Sync)

### 任务: 知识库模块全栈文档同步
- **状态**: ✅ 已完成
- **背景**: 
    - 知识库模块已上线自动化导入 (DOCX/PDF) 和混合搜索逻辑，但文档严重滞后。
    - `Service_DataModel.md` 缺少 10+ 个核心字段。
    - `Service_API.md` 缺少文件导入相关的 `multipart/form-data` 接口。

- **变更内容**:
    - **Service_PRD.md**:
        - **分类**: 对齐 A/B/C/D 产品族群与具体型号。
        - **流程**: 详细描述 DOCX 导入的“自动切分”与“标题预警”逻辑。
        - **搜索**: 定义混合搜索（Keywords + AI Semantic）的执行路径。
    - **Service_DataModel.md**:
        - **新增**: `chapter_number`, `source_type`, `format_status`, `formatted_content` 等。
        - **优化**: 将 `product_models` 从 TEXT 改为 JSON，对齐代码中的机型列表逻辑。
    - **Service_API.md**:
        - **新增**: `POST /api/v1/knowledge/import/pdf` 和 `docx`。
        - **更新**: `GET /api/v1/knowledge/audit` 及其统计接口的数据结构。
    - **Service_UserScenarios.md**:
        - **新增**: 自动化导入（PDF/DOCX）的操作流程场景描述。

- **验证**:
    - ✅ 4 份核心文档均已提升版本并对齐最新代码实现。
    - ✅ 用户已审核通过所有变更。

- **文件修改清单**:
    - `docs/Service_PRD.md`
    - `docs/Service_DataModel.md`
    - `docs/Service_API.md`
    - `docs/Service_UserScenarios.md`
    - `docs/1_Backlog.md`
    - `docs/2_PromptLog.md`
    - `docs/4_DevLog.md`

---

## 会话: 2026-02-11 (UI Refinements & Dealer API Fix)

### 任务: 客户档案 UI 优化与经销商列表修复
- **状态**: ✅ 已完成
- **背景**:
    - 用户反馈经销商列表为空，原因为后台 API 过滤逻辑错误。
    - 列表页状态（分页/筛选）在进入详情页后丢失，需实现状态持久化。
    - UI 需微调以符合新的视觉规范（Low-key Kine Button）。

- **变更内容**:
    - **API (Backend)**:
        - 修复 `server/index.js` 中 `GET /api/v1/customers` 的 SQL 拼接逻辑，确保 `account_type='Dealer'` 时正确过滤。
    - **Frontend (Store)**:
        - 新增 `useRouteMemoryStore.ts` (Zustand) 用于存储路由查询参数。
        - 更新 `InquiryTicketDetailPage`, `RMATicketDetailPage`, `DealerRepairDetailPage` 使用 `getRoute()` 实现智能回退。
    - **Styles**:
        - `index.css`: 新增 `.btn-kine-lowkey`, `.tab-active-lowkey`。
        - `CustomerManagement.tsx`: 应用样式，并将 Tab 名称中文化。

- **技术决策**:
    > **决策**: 使用 **Zustand** 实现简单的路由记忆存储。
    > - **原因**: 相比复杂的 URL 状态同步库，Zustand 轻量且足以处理这种“列表 ->详情 -> 返回”的单一层级状态恢复需求。
    > - **实现**: `setRoute(path, query)` 在离开列表时调用，`getRoute(path)` 在返回时调用。

- **验证**:
    - ✅ 经销商列表正确加载（8条记录）。
    - ✅ 详情页返回按钮能够恢复之前的搜索词和页码。
    - ✅ UI 样式符合“低调奢华”的要求。

- **文件修改清单**:
    - `server/index.js` (API Fix)
    - `client/src/store/useRouteMemoryStore.ts` (New Store)
    - `client/src/index.css` (Style Update)
    - `client/src/components/CustomerManagement.tsx` (UI Update)
    - `client/src/components/*/*TicketDetailPage.tsx` (Nav Logic)

---

## 会话: 2026-02-10 (Files Module Refactoring & Backup System)

### 任务: Files 路由模块化拆分与数据库自动备份系统实现
- **状态**: ✅ 已完成
- **背景**: 
    - `server/index.js` 文件过大（>2500行），包含大量文件管理逻辑，维护困难。
    - 系统缺乏自动备份机制，存在数据丢失风险。
    - 需要支持动态配置备份频率和保留策略。

- **变更内容**:
    - **Backend (Router Refactoring)**:
        - **新模块**: `server/files/routes.js`
        - **功能**: 完整封装了 `list`, `upload`, `rename`, `copy`, `move`, `delete` 以及批量操作。
        - **权限**: 迁移并优化了 `resolvePath`, `hasPermission` 和 `checkInternalUser` 中间件。
        - **解耦**: `server/index.js` 成功精简，通过 `app.use('/api', filesRouter)` 挂载，保持前端 API 路径稳定性。

    - **Backend (System Backup Service)**:
        - **新服务**: `server/service/backup_service.js` (BackupService 类)
        - **SQLite Hot Backup**: 使用 `db.backup(destination)` 实现“在线热备份”，确保备份时数据库可读写，无锁表风险。
        - **自动调度**: 集成 `node-schedule`，支持通过数据库配置 `backup_frequency` (分钟) 动态调整频率。
        - **自愈与重载**: 提供 `reload()` 方法，当管理员修改设置时，服务无需重启即可应用新策略。
        - **策略性清理**: 自动扫描 `DiskA/.backups/db` 目录，删除超过 `backup_retention_days` 的旧备份文件。

    - **Database & Settings**:
        - **Schema**: 向 `system_settings` 表新增 3 个字段：`backup_enabled`, `backup_frequency`, `backup_retention_days`。
        - **Migration**: 在 `index.js` 启动逻辑中添加 `TRY-ALTER` 机制，确保不同环境下的 Schema 自动对齐。
        - **API**: 更新 `/api/admin/settings` 使其支持备份策略的读取与保存，新增 `/api/admin/backup/now` 手动触发接口。

- **技术决策**:
    > **决策**: 采用 **SQLite Online Backup API**。
    > - **原因**: 相比简单的文件复制 (fs.copy)，`db.backup()` 能够保证在备份过程中即使有写入操作，备份文件依然具备一致性，且不会阻塞主进程。
    > - **实现**: `backupService.trigger()` -> `db.backup(destPath)` -> `fs.removeOldBackups()`。

- **验证**:
    - ✅ `server/index.js` 代码量显著减少，逻辑清晰。
    - ✅ 模拟手动修改设置，确认 `BackupService` 热重载生效。
    - ✅ 调用手动备份接口，确认 `DiskA/.backups/db` 成功生成备份文件，格式为 `longhorn-YYYY-MM-DD-HH-mm-ss.db`。
    - ✅ 自动清理逻辑验证：手动将保留天数设为 0，确认旧文件被正确移除。

- **文件修改清单**:
    - `server/files/routes.js` (新增，文件管理模块)
    - `server/service/backup_service.js` (新增，备份核心逻辑)
    - `server/index.js` (精简，集成备份服务，添加数据库迁移)
    - `server/service/routes/settings.js` (更新，支持备份配置及触发)
    - `docs/` 系列文档 (同步更新)

---

## 会话: 2026-02-07 (Knowledge Base DOCX Import)

### 任务: 知识库DOCX→MD导入功能完整实现
- **状态**: ✅ 已完成
- **背景**: 
    - 从PDF书签导入方案转向DOCX→MD首选路径
    - 实现MAVO Edge 6K操作手册完整导入（73章节、9表格、39图片）
    - 修复WIKI导航树的三个关键问题

- **变更内容**:
    - **Backend (DOCX→MD转换器)**:
        - **新增脚本**: `server/scripts/docx_to_markdown.py`
        - **功能**: 使用`python-docx`直接读取DOCX结构
        - **表格提取**: 完整保留表格结构，转换为Markdown格式
        - **图片优化**: 自动提取图片并转WebP（质量85，压缩80%+）
        - **章节识别**: 基于Heading样式识别章节层级（Heading 1/2/3 → # ## ###）
    
    - **Backend (MD导入器修复)**:
        - **文件**: `server/scripts/import_from_markdown.py`
        - **修复**: 摘要生成逻辑，正确移除图片Markdown语法
        - **修复前**: `re.sub(r'[#*\[\]!]', '', content)` → 遗留"Image(/path)"纯文本
        - **修复后**: `re.sub(r'!\[.*?\]\([^)]*\)', '', content)` → 完整移除图片语法
    
    - **Frontend (WIKI导航树修复)**:
        - **文件**: `client/src/components/KinefinityWiki.tsx`
        - **问题1 - 双重"操作手册"嵌套**:
            - 原因: `buildChapterTree`内部创建未分类节点 + 外层又创建父节点
            - 修复: 删除未分类节点逻辑（第136-143行），只返回纯章节节点
        - **问题2 - 章节名称识别错误**:
            - 原因: 正则`/:\s*(\d+)(?:\.(\d+))?\s+(.+)/`无法匹配"1."格式
            - 修复: 改用`/:\s*(\d+)(?:\.(\d+))?(?:\.\d+)*[.\s]+(.+)/`支持点号或空格
            - 验证:
                - "MAVO Edge 6K: 1. 基本说明" → chapter=1, section=null, cleanTitle="基本说明" ✅
                - "MAVO Edge 6K: 1.1 端口说明" → chapter=1, section=1, cleanTitle="端口说明" ✅
        - **问题3 - 图片无法显示**:
            - 原因1: 图片文件未同步到远程服务器
            - 原因2: 错误使用直接IP访问`http://47.116.145.147:3000`而非Cloudflare地址
            - 修复: 
                - 同步图片: `rsync img_*.webp mini:/path/to/knowledge_images/`（39张，2.1MB）
                - 使用正确地址: `https://opware.kineraw.com`
    
    - **运维规范修正**:
        - **错误操作**: 使用`killall node`导致PM2 daemon被杀掉
        - **正确方式**: `ssh -t mini "/bin/zsh -l -c 'pm2 restart longhorn'"`
        - **正确地址**: Cloudflare Tunnel (`https://opware.kineraw.com`) 而非直接IP

- **最终效果**:
    - ✅ 73个章节（100%准确率）
    - ✅ 9个表格完整提取
    - ✅ 39张图片（WebP优化，9.9MB→2.1MB）
    - ✅ 四级树状结构正确：
        ```
        📱 MAVO Edge 6K
          └─ 📖 操作手册
              ├─ 📗 第1章：基本说明 (4)
              ├─ 📗 第2章：快速指南 (14)
              └─ 📗 第3章：高级操作和设置 (57)
        ```

- **技术架构决策**:
    > **决策**: DOCX→MD为知识库导入首选路径
    > - **原因**: 章节准确率100%，表格质量95%+，图片位置精确
    > - **实现**: `python-docx` + `mammoth` + WebP优化 + Markdown渲染
    > - **对比**: 
    >   - PDF书签方案: 章节100%（依赖书签），表格80-90%（pdfplumber识别），图片85%（按页码匹配）
    >   - DOCX方案: 章节100%（原生支持），表格95%（完整结构），图片80%（浮动位置）

- **验证**:
    - ✅ DOCX转MD成功（73个章节，完整表格和图片）
    - ✅ 数据库导入成功（73条Manual记录）
    - ✅ 图片同步到远程服务器（39张WebP）
    - ✅ WIKI导航树显示正确（无双重嵌套）
    - ✅ 章节标题正确识别（"第1章：基本说明"而非"端口说明"）
    - ✅ 图片正常显示（HTTP 200）
    - ✅ 前端编译零错误（TypeScript验证通过）
    - ✅ 服务重启成功（PM2 online）

- **文件修改清单**:
    - `server/scripts/docx_to_markdown.py` (新增)
    - `server/scripts/import_from_markdown.py` (修复摘要生成)
    - `client/src/components/KinefinityWiki.tsx` (修复三个问题)
    - `server/data/knowledge_images/` (39张WebP图片)
    - `server/longhorn.db` (73条Manual记录)
    - `docs/4_DevLog.md` (本记录)

---

## 会话: 2026-02-03 (Creation 2.0 & Media Attachments)

### 任务: Robust Creation Flow & Attachment Display
- **状态**: ✅ 已完成
- **变更内容**:
    - **Frontend (Creation 2.0)**:
        - **Unified Modal**: 实现 `TicketCreationModal`，使用 Zustand 管理显隐及类型切换。
        - **Draft Persistence**: 通过 `zustand/middleware` 的 `persist` 将草稿自动存入 LocalStorage。
        - **Media Upload**: 集成 `react-dropzone`，实现多文件拖拽上传、预览及删除。
    - **Frontend (Detail Pages)**:
        - 在三种工单详情页添加了 "Attachments" 列表，支持图片预览、视频播放/下载及 PDF 图标区分。
    - **Backend**:
        - **Schema**: 引入 `service_attachments` 表，关联文件路径、MIME 类型与工单 ID。
        - **Upload Logic**: `multer` 配置支持 `public/uploads/service` 存储，实现 `multipart/form-data` 解析。
- **验证**:
    - ✅ 刷新页面后草稿可正常恢复。
    - ✅ 详情页实时显示上传成功的附件。
    - ✅ 修复了所有详情页的 `ImageIcon` 未使用 lint 警告。

---

## 会话: 2026-02-02 (Service Module Foundation)

### 任务: Service Data / Creation Fix / App Rail Navigation
- **状态**: ✅ 已完成
- **变更内容**:
    - **Git Fix**:
        - 解决 `UserInterfaceState.xcuserstate` 导致的 git pull 冲突。
        - 策略: `git restore --staged` -> `git rm --cached` -> 更新 `.gitignore`。
    - **App Rail Navigation**:
        - **Refactor**: 实现了垂直侧边导航栏 (`AppRail.tsx`)，取代原有的顶部 Tab 导航 (`TopModuleNav.tsx`)。
        - **Architecture**: 分离 "Service" 和 "Files" 为两个独立的业务域上下文。
        - **Context Aware**: TopBar 现在根据当前模块动态渲染内容 (Files 模式显示统计/每日一词，Service 模式隐藏)。
    - **Service Data Seeding**:
        - **Script**: 创建 `server/seeds/02_service_data.js`。
        - **Logic**: 强制重置 `_migrations` 表 (`DROP TABLE`) 以确保 Schema 完整性，随后插入 5 条 Service Record 和 5 条 Issue 测试数据。
    - **Creation Fixes**:
        - **IssueCreatePage**: 修复 API 端点 (`/api/issues` -> `/api/v1/issues`)。
        - **ServiceRecordCreatePage**: 新增 `problem_category` 字段，确保数据完整性。
        - **Localization**: 更新 `translations.ts`，补充了大量 Service 相关的缺失翻译 Key。

- **验证**:
    - ✅ 导航切换流畅且上下文正确。
    - ✅ 数据库成功填充 10 条测试数据。
    - ✅ 手动创建工单和服务记录流程验证通过。

### 技术架构总结 (Foundation Architecture)
> **决策**: 采用 **Context-Driven Navigation**。
> - **原因**: "Service" 和 "Files" 是两个完全不同的业务域，共享同一个 Sidebar 会导致混乱。
> - **实现**: `AppRail` 作为顶级导航，切换 `activeModule` ('files' | 'service')。
> - **影响**: 下游组件 (Sidebar, TopBar) 均只需监听 `activeModule` 即可自动适配，无需复杂的条件判断。

### 会话: 2026-02-02 (Service Schema Fix)

### 任务: Fix Creation Logic & Schema Alignment
- **状态**: ✅ 已完成
- **问题**:
    - "Internal Server Error" when creating issues.
    - `issues` table has `description` column, but frontend/backend code was using `problem_description`.
    - Seed data missing `issue_source` (NOT NULL constraint).
- **变更内容**:
    - **BackEnd**: Patched `server/service/routes/issues.js` to map `problem_description` payload to `description` column.
    - **FrontEnd**: Updated `IssueCreatePage.tsx` payload.
    - **Seeding**: Rewrote `02_service_data.js` with realistic PRD cases and correct schema fields.
- **验证**:
### 会话: 2026-02-03 (Bugfix & UI Polish)

### 任务: Debug Empty Ticket List & Logo Update
- **状态**: ✅ 已完成
- **问题**:
    - **Empty List**: Inquiry/RMA lists returned 0 items (initially 404, then 500 potential).
    - **Logo**: User requested "Kine Yellow" Horseshoe logo instead of 'L'.
- **变更内容**:
    - **Backend**:
        - `server/index.js`: Explicitly registered `/api/v1/inquiry-tickets` etc.
        - `inquiry-tickets.js`: 
            - Fixed `ReferenceError` (missing `created_from` declaration).
            - Fixed SQL Column Mismatches: `h.name` -> `h.username`, `p.name` -> `p.model_name`.
            - Added debug checkpoints.
    - **Frontend**:
        - `AppRail.tsx`: Implemented CSS Mask for SVG-like coloring of PNG logo (`mask: url(/kine_logo.png)`).
- **验证**:
    - Backend logs confirmed execution flow passed all checkpoints.
    - Logo renders in correct theme color.

---


## 会话: 2026-01-28 PM (Daily Word Data Quality Fix)

### 任务: 每日一词数据质量修复与跨端功能恢复
- **状态**: ✅ 已完成
- **问题描述**:
    - Web端每日一词功能失效，显示"No words loaded. Try refreshing."
    - iOS端显示错误的meaning格式："An intermediate concept: Labour"、"A common elementary word: Line"
    - 数据库中存在大量错误格式的词汇数据

- **根本原因分析**:
    - 早期的词汇生成脚本（`mass_vocab_injector.py`）使用了错误的模板
    - meaning字段被填充为模板化的完整句子（如"A common elementary word: X"），而不是简洁的释义
    - 这些错误数据污染了词汇库，导致用户体验异常

- **解决方案**:
    1. **数据库清理**:
        - 编写SQL查询识别所有错误格式的数据：
          ```sql
          SELECT word, meaning FROM vocabulary 
          WHERE meaning LIKE 'An %concept:%' 
             OR meaning LIKE 'A %concept:%' 
             OR meaning LIKE 'A common%';
          ```
        - 执行批量删除操作：
          ```sql
          DELETE FROM vocabulary 
          WHERE meaning LIKE 'An %concept:%' 
             OR meaning LIKE 'A %concept:%' 
             OR meaning LIKE 'A %word:%' 
             OR meaning LIKE 'A common%';
          ```
        - 删除统计：113条错误数据（1条"A common"格式 + 112条"concept"格式）
        - 清理后数据统计：
          - 德语（de）：215条
          - 英语（en）：232条
          - 日语（ja）：204条
          - 中文（zh）：236条
          - **总计：887条正确格式的词汇**

    2. **服务器重启**:
        - 使用SSH连接到生产服务器
        - 执行 `pm2 restart longhorn` 重启所有worker进程
        - 确认8个cluster worker全部成功重启（restart次数递增）

    3. **API验证**:
        - 测试批量词汇API：`/api/vocabulary/batch?language=en&level=Intermediate&count=3`
        - 验证返回数据格式正确：
          - "Hollow" → meaning: "Empty inside" ✅
          - "Decision" → meaning: "A choice that you make about something" ✅
          - "Experience" → meaning: "Knowledge or skill from doing something" ✅
          - "Process" → meaning: "A series of actions that you take in order to achieve a result" ✅

    4. **iOS模拟器管理**:
        - 原有模拟器设备（31786A39）消失，重新查找可用设备
        - 识别到运行中的iPhone Air模拟器（76F0A6D9-655C-445D-9472-3A752B03367B）
        - 在该模拟器上重新安装Longhorn应用
        - 启动应用（PID: 85715）
        - 打开模拟器窗口供用户测试

    5. **Web端部署**:
        - 使用标准部署脚本：`./scripts/deploy.sh`
        - 同步服务器和客户端代码到远程服务器
        - 在远程服务器上执行前端构建：
          - 构建版本：11.3.0 (commit: 1e4bd5d)
          - 构建时间：约2.63秒
          - 输出大小：主bundle 1469.66 kB (gzipped: 442.22 kB)
        - PM2重载服务进程（零停机部署）

- **技术细节**:
    - **数据格式规范**：
      - ❌ 错误："An intermediate concept: Labour"
      - ✅ 正确："Work, especially physical work"
      - meaning字段应该是简洁的释义或定义，不应包含元信息（如词汇级别、类别等）
    
    - **防止复发机制**：
      - 服务器的自动播种功能已在之前的会话中禁用（注释掉`server/index.js`中的seeding逻辑）
      - 防止错误的种子数据在服务器重启时被重新导入
      - 未来需要更新词汇数据时，必须先验证种子文件的数据质量

    - **模拟器设备管理问题**：
      - Xcode模拟器设备可能因系统清理或其他操作而消失
      - 应该使用 `xcrun simctl list devices available` 动态查找可用设备
      - 不应硬编码特定的设备UUID

- **验证与测试**:
    - ✅ 数据库清理完成，错误数据全部删除
    - ✅ API返回正确格式的词汇数据
    - ✅ 服务器成功重启，8个worker进程正常运行
    - ✅ iOS模拟器成功启动并运行应用
    - ✅ Web端成功部署到生产环境
    - ⏳ 待用户测试：iOS端点击"New Batch"刷新词汇，Web端硬刷新页面

- **用户操作建议**:
    1. **iOS端**：打开每日一词功能，点击更多菜单中的"New Batch"按钮，强制刷新词汇批次
    2. **Web端**：在浏览器中访问 https://opware.kineraw.com，使用 Cmd+Shift+R 硬刷新页面清除缓存
    3. 验证meaning字段显示正确的简洁释义，而非"An X concept: Y"格式

- **文件修改清单**:
    - `server/longhorn.db` (远程数据库，删除113条记录)
    - `docs/2_PromptLog.md` (新增会话记录)
    - `docs/4_DevLog.md` (新增技术产出记录)

---

## 会话: 2026-01-28 (Daily Word UX Refinement)

### 任务: 每日一词 UI 改进 - 更多菜单整合
- **状态**: ✅ 已完成
- **变更内容**:
    - **iOS 端** (`ios/LonghornApp/Views/Components/DailyWordBadge.swift`):
        - 移除了 `trailingToolbar` 中的独立关闭按钮（`xmark.circle.fill`）。
        - 重构更多菜单结构，将所有次要操作整合至 `Menu` 组件：
          - **New Batch (Refresh)**: 刷新词库，带触感反馈。
          - **Level 选择**: 如有多个等级时显示，checkmark 标记当前选中项。
          - **Close**: 使用 `Button(role: .destructive)` 实现红色警告样式。
        - 简化布局：仅保留一个 `ellipsis.circle` 更多菜单按钮。
        
    - **Web 端** (`client/src/components/DailyWord.tsx`):
        - 新增 `MoreVertical` 图标按钮，创建下拉菜单组件。
        - 菜单包含三个部分：
          - **Level 选择**: 如有多个等级时显示，选中项显示黄色背景和 checkmark。
          - **New Batch**: 蓝色主题色按钮，带 `RefreshCw` 图标。
          - **Close**: 红色警告样式（`#ff453a`），带 `X` 图标。
        - 移除底部控制栏中的 `Level Selector` 和 `New Batch` 按钮。
        - 底部仅保留 **Prev** 和 **Next** 两个导航按钮。
        - 实现菜单外部点击自动关闭：
          - 使用 `useRef` + `useEffect` 监听 `mousedown` 事件。
          - 点击菜单外部时 `setShowMoreMenu(false)`。
        - 优化交互动画：
          - 悬停时背景变深。
          - Level 选中项高亮显示。
          
    - **部署**:
        - Git commit: `5191625` - "feat(daily-word): 改进每日一词 UI 交互体验"。
        - 生产服务器 `git fetch` + `merge` 成功。
        - PM2 重启：8 个 cluster worker 全部 online。
        
    - **测试**:
        - iOS 模拟器：iPhone 17 Pro (iOS 26.1) 编译并启动成功（PID: 99729）。
        - Web 端：部署至生产环境 `https://opware.kineraw.com`。

- **技术决策**:
    - **iOS**: 使用 SwiftUI 原生 `Menu` 组件，避免自定义下拉菜单的复杂度。
    - **Web**: 使用 `position: absolute` 实现下拉菜单，保持与 iOS 的视觉一致性。
    - **状态管理**: Web 端使用 `useState` + `useRef` 管理菜单显示状态和关闭逻辑。
    - **一致性**: 两端采用相同的交互模式，提升用户体验的连贯性。

- **文件修改清单**:
    - `ios/LonghornApp/Views/Components/DailyWordBadge.swift` (38行新增, 42行删除)
    - `client/src/components/DailyWord.tsx` (213行新增, 104行删除)

- **验证**:
    - ✅ iOS 模拟器编译通过，无错误。
    - ✅ 生产服务器部署成功，服务正常运行。
    - ✅ Git 提交并推送至 GitHub。
    - ✅ 文档已更新（Backlog, PromptLog, PRD, DevLog）。

---

## 会话: 2026-01-28 (Daily Word UX Refinement)

### 任务: 每日一词 UI 改进 - 更多菜单整合
- **状态**: ✅ 已完成
- **变更内容**:
    - **iOS 端** (`ios/LonghornApp/Views/Components/DailyWordBadge.swift`):
        - 移除了 `trailingToolbar` 中的独立关闭按钮（`xmark.circle.fill`）。
        - 重构更多菜单结构，将所有次要操作整合至 `Menu` 组件：
          - **New Batch (Refresh)**: 刷新词库，带触感反馈。
          - **Level 选择**: 如有多个等级时显示，checkmark 标记当前选中项。
          - **Close**: 使用 `Button(role: .destructive)` 实现红色警告样式。
        - 简化布局：仅保留一个 `ellipsis.circle` 更多菜单按钮。
        
    - **Web 端** (`client/src/components/DailyWord.tsx`):
        - 新增 `MoreVertical` 图标按钮，创建下拉菜单组件。
        - 菜单包含三个部分：
          - **Level 选择**: 如有多个等级时显示，选中项显示黄色背景和 checkmark。
          - **New Batch**: 蓝色主题色按钮，带 `RefreshCw` 图标。
          - **Close**: 红色警告样式（`#ff453a`），带 `X` 图标。
        - 移除底部控制栏中的 `Level Selector` 和 `New Batch` 按钮。
        - 底部仅保留 **Prev** 和 **Next** 两个导航按钮。
        - 实现菜单外部点击自动关闭：
          - 使用 `useRef` + `useEffect` 监听 `mousedown` 事件。
          - 点击菜单外部时 `setShowMoreMenu(false)`。
        - 优化交互动画：
          - 悬停时背景变深。
          - Level 选中项高亮显示。
          
    - **部署**:
        - Git commit: `5191625` - "feat(daily-word): 改进每日一词 UI 交互体验"。
        - 生产服务器 `git fetch` + `merge` 成功。
        - PM2 重启：8 个 cluster worker 全部 online。
        
    - **测试**:
        - iOS 模拟器：iPhone 17 Pro (iOS 26.1) 编译并启动成功（PID: 99729）。
        - Web 端：部署至生产环境 `https://opware.kineraw.com`。

- **技术决策**:
    - **iOS**: 使用 SwiftUI 原生 `Menu` 组件，避免自定义下拉菜单的复杂度。
    - **Web**: 使用 `position: absolute` 实现下拉菜单，保持与 iOS 的视觉一致性。
    - **状态管理**: Web 端使用 `useState` + `useRef` 管理菜单显示状态和关闭逻辑。
    - **一致性**: 两端采用相同的交互模式，提升用户体验的连贯性。

- **文件修改清单**:
    - `ios/LonghornApp/Views/Components/DailyWordBadge.swift` (38行新增, 42行删除)
    - `client/src/components/DailyWord.tsx` (213行新增, 104行删除)

- **验证**:
    - ✅ iOS 模拟器编译通过，无错误。
    - ✅ 生产服务器部署成功，服务正常运行。
    - ✅ Git 提交并推送至 GitHub。
    - ✅ 文档已更新（Backlog, PromptLog, PRD, DevLog）。

---

## 会话: 2026-01-28 (Data Quality Restoration)

### 任务: Data Quality & Silent Refresh (Final Fix)
- **状态**: ✅ 已完成
- **问题诊断**:
    - 用户反馈 "Basic German word: Wasser" 等占位符定义，且缺少图片。
    - 数据库分析发现约 3800 条残留的垃圾数据 (Garbage Data) 及 2000+ 条带后缀的重复数据 (e.g. `Wasser (1)`).
    - 前端 Web 每日一词在切换语言时出现不必要的 Loading 闪烁。
- **变更内容**:
    - **Data Cleanup (Fix V5)**:
        - 编写 `fix_vocab_v5.py`，采用激进的 Regex 策略 (`r'Vocabulary:|Word:|德语基础'`)。
        - **清理结果**: 删除了 3800+ 条无效数据，保留 4346 条高质量数据 (含 Emoji)。
        - **Reseed**: 执行服务器端 `reseed_vocab.js`，彻底重置数据库。
    - **Web Ops**:
        - **Silent Refresh**: 重构 `useDailyWordStore.ts`，引入 `cache` 机制。切换语言时优先展示缓存内容，静默更新，消除 Loading 态。
        - **Bug Fix**: 修复 `DailyWord.tsx` 中 "Retry" 按钮的 TypeScript 类型错误。
        - **Safety**: 前端增加 Regex Mask `word.replace(/\s*\(\d+\)$/, '')` 作为最后一道防线。
- **验证**:
    - "Tasche" (包) 从 20+ 条垃圾重复项缩减为 1 条正确项。
    - 界面切换流畅，无闪烁。

    - **UI Polish**:
        - **Web**: 重构 Daily Word 弹窗布局为 **Flex Column + Sticky Footer**。
        - **Detail**: 将内容区域设为 `flex: 1, overflow-y: auto`，底部操作栏设为 `flex-shrink: 0`。彻底解决了小屏设备上底部按钮被内容挤出屏幕或被遮挡的问题。
        - **Web**: 在更多菜单中增加 "Reset Cache" 按钮。
    - **iOS Enhancements**:
        - **Settings**: 增加 "Clear Vocabulary Cache" 功能，调用 `DailyWordService.clearCache`。
        - **Service**: 实现了 `clearCache` 方法，清除所有 `UserDefaults` key 并重置状态为 English/Advanced。
        - **Refactor**: 重构 `DailyWordService` 网络层，使用统一的 `APIClient` 替代原生 `URLSession`。此举解决了 `nw_connection` 日志噪音问题，并统一了超时配置和错误处理。

    - **Bug Fixes (Upload/List)**:
        - **FileItem Model**: 修复了 `uploader` 字段解析错误的问题 (Key `uploader` mismatch with `uploader_name`)，现在能正确解析上传者信息。
        - **UploadService**: 将分片上传逻辑迁移至 `APIClient`，解决了因混合使用 `URLSession.shared` 导致的网络不稳定和连接警告问题。

---

## 会话: 2026-01-27 (Data Quality Issue)

### 任务: Data Quality & First Run Optimization
- **状态**: ✅ 已完成
- **变更内容**:
    - **Ops**: 创建了 `docs/COLLABORATION.md`，规范多人协作与发版流程。
    - **Data Quality**:
        - 重构 `mass_vocab_injector.py`，引入随机模板系统 (Template System)，解决了例句千篇一律 ("We need to consider...") 的问题。
        - 重新生成了 `vocabulary_seed.json`，包含更自然的句式。
        - 远程清理了生产环境数据库中的旧例句 (Clean Up)。
    - **Zero Latency (First Run)**:
        - 将 iOS 调试环境默认 API 地址修改为 `localhost:3001` (Dev)，确保开发者在本地运行时能立即获取最新生成的词库，而无需等待线上部署。
        - (注: 生产环境配置已回滚至 `kineraw.com`)。
    - **Fixes**:
        - 修复了 iOS Bundle ID 冲突 (`com.kinefinity.longhorn` -> `.jihua`)。
- **验证**:
    - 本地服务器重启后自动吸入新 Seed。
    - iOS 模拟器下拉刷新即显示多变例句。

---

## 会话: 2026-01-24

### 任务: Daily Word 性能与体验优化 (Batch Fetch & UI Polish)
- **状态**: ✅ 已完成
- **变更内容**:
    - **性能优化 (Batch Fetching)**:
        - **服务端**: 新增 `/api/vocabulary/batch` 接口，支持一次性拉取 10-50 个随机词汇。
        - **iOS端**: 重构 `DailyWordService.swift`，弃用循环请求，改为调用批量 API，通过单次网络交互完成更新（100个词仅需~1秒）。
    - **体验优化 (感知与降噪)**:
        - **移除干扰**: 去掉了底部遮挡内容的 Overlay 进度条。
        - **轻量反馈**: 仅保留导航栏右上角的加载动画 (Spinner) 和数字跳动，实现“更新于无形”。
    - **文档整合**:
        - 将 Walkthrough 内容整合进 DevLog，确保文档来源唯一且语言统一。
    - **自动化流程**:
        - **建立框架**: 创建了 `.agent/workflows/pmlog.md` 工作流，标准化文档更新程序，确保每次会话后自动同步 `task.md` 至 `DevLog`。
    - **Bug修复**:
        - **数据健壮性**: 修复了 `WordEntry` JSON 解码逻辑，针对数据库中可能存在的 NULL 字段 (`meaning`, `meaning_zh`) 增加了安全处理，防止批量更新失败。
    - **紧急修复 (Hotfix 2026-01-24 Night)**:
        - **服务端 502/404 修复**:
            - 修复了 `server/index.js` 合并代码时引入的 `SyntaxError` (缺少闭合括号)。
            - 修正了 Batch API 的 SQL 查询 (`SELECT *` instead of `data`)。
            - **解决了路由遮蔽 (Route Shadowing)**: 发现并清理了占用 4000 端口的**僵尸进程** (Zombie Process PID 57006)，并将 Batch API 路由移至代码顶层，确保优先级。
            - 验证: 本地 Curl 测试通过，Git Push 触发远程自动部署成功。
    - **Language Cache Fix**:
        - 修复了 `DailyWordService` 切换语言时未清除旧缓存的 Bug，解决“选德语却显示英语”的问题。
    - **UI Layout Fix**:
        - 修复了 Daily Word Sheet 头部 "Library Count" 和 "Close Button" 在 Pill 样式下内容溢出 (Overflow) 的问题，增加了 `.fixedSize()` 约束。
    - **Web Auto-Refresh Fix**:
        - 优化了网页版自动刷新逻辑 (Smart Polling)。
        - 策略: 保持 5秒 轮询，但增加 `compare` 深度对比。
        - 效果: 只有当通过 API 拉取到的文件列表发生了实际变化时，才会触发 React 重新渲染，彻底消除了无意义的闪烁 (Flickering)。
    - **Web Daily Word Enhancements**:
        - **Revert**: 恢复 iOS Bundle ID 为 `com.kinefinity.longhorn`。
        - **State Decoupling**: 将“每日一词”的学习目标语言 (`targetLang`) 与 APP 界面语言 (`appLanguage`) 解耦，支持独立选择。
        - **UI Enhancement**: 在每日一词弹窗中增加语言切换器 (EN/DE/JA/ZH)。
        - **Logic Update**: "Next Word" 按钮现在会根据当前选择的目标语言获取新词。
    - **Header UI Polish**:
        - **Fix**: 移除了 Daily Word Sheet 右上角关闭按钮的额外背景 (`xmark.circle.fill` -> `xmark`)，解决了 "Pill inside a Pill" 的视觉干扰，使统计数据与关闭按钮在同一个胶囊容器内更加协调。
    - **Example Audio**:
        - **Feature**: 为 iOS 每日一词的例句增加朗读功能。
        - **Impl**: `DailyWordService` 新增 `speak(text: String)` 方法；UI 在例句旁增加扬声器图标按钮。
        - **Impl**: `DailyWordService` 新增 `speak(text: String)` 方法；UI 在例句旁增加扬声器图标按钮。
        - **Refine**: 限制例句显示数量为 2 条；调大例句朗读图标 (16pt -> 22pt) 并加深颜色。
    - **Web Fixes**:
        - **Visibility**: 修复了网页版每日一词在数据加载失败或为空时直接消失的问题 (移除了 `return null`)，现在会显示占位符或错误提示。
        - **Limit**: 限制网页版例句显示数量为 2 条。
        - **UI Parity**: 网页版语言选择器样式升级为 iOS 风格的分段控制器 (Segmented Control)，支持高亮选中状态。
    - **Verification**:
        - **Strict Limit**: 再次确认 iOS (`.prefix(2)`) 和 Web (`.slice(0, 2)`) 均已实施严格例句数量限制。
    - **Server Strategy**:
        - **Smart Seeding**: 修改服务器启动逻辑，从单纯的 "Empty Check" 改为 "Sync Check"。
        - **Mechanism**: 每次启动时读取 `seeds/vocabulary_seed.json`，检查数据库中不存在的新词并自动插入。
        - **Benefit**: 想要更新线上词库，只需在本地更新 seed JSON 并部署，服务器重启时会自动吸入新词，无需手动操作 SQL。

## 会话: 2026-01-23

### 任务: 实现 iOS 相册式交互 (Implementing iOS Photos-like Interactions)
- **JIRA/Issue**: N/A
- **状态**: ✅ 已完成
- **预估耗时 (Effort)**: ~25 轮对话
- **变更内容**:
    - **Settings Refactor**:
        - 重构 `SettingsView` 采用分组 `Section` 布局，提升可读性。
        - 实现了 `Reset Preferences` 功能，使用 `.confirmationDialog` 替代 `.alert` 以符合 iOS 规范。
        - 统一了 Toast 提示风格，重置成功显示 `.prominent` 样式。
    - **Daily Word Prep**:
        - **Data Source**: Permanently stores fetched words in `UserDefaults` (`longhorn_daily_word_library_en`).
        - **Smart Refresh**: On launch, checks if library < 100 words; triggers silent batch update (+10-50 words).
## 会话: 2026-01-27
### 任务: Client Update: iOS Daily Word Sync
- **Feature**: Synchronized iOS Daily Word with Web "Batch Mode" (100 words).
- **Logic**: Updated `DailyWordService.swift` to fetch/store batches of 100 random words.
- **Migration**: Implemented automatic migration from legacy "cumulative" cache to new "batch" cache for seamless user transition.
- **UI**: Updated `DailyWordBadge` to show `Index/100` progress. Added "New Batch" refresh button.
- **Localization**: Added Chinese translations for new UI elements.
## Client Update: Daily Word Refinement (Phase 2)
- **UI Optimization**: Replaced cluttered bottom controls with a top-bar **Options Menu**.
- **Layout**: Forced examples to show maximum 2 items to prevent scrolling fatigue.
- **Content**: Expanded `vocabulary_seed.json` with:
    - **English**: Added `Elementary`, `Intermediate` levels.
    - **Chinese**: Added `Classical` (文言文), `Poetry` (诗词) categories.
- **Localization**: Updated `Localizable.xcstrings` throughout.
- **Data**: Verified seed data injection logic. Use server restart to apply.
## Client Update: Daily Word Refinement (Phase 3)
- **Auto-Fill Logic**: `DailyWordService.swift` now automatically detects if a batch is deficient (<100 words) and silently fetches the exact difference from the server to ensure a full batch.
    - Resolves "Migration Gap" (e.g., 54/100 -> Auto -> 100/100).
- **UI Logic**: Moved "Index/Total" counter from the main toolbar into the "Options Menu" (Title) to reduce visual clutter.
- **Content**:
    - **English**: Added `Common Phrases` category.
    - **Localization**: Added translation for "Common Phrases" and "Progress".
- **Models**: Updated `DailyWordLanguage` enum to expose new levels for English and Chinese.

## Client Update: Daily Word Refinement (Phase 4)
- **Content**: Expanded `vocabulary_seed.json` with ~200 new items (Elementary/Intermediate/Classical/Poetry) via `expand_vocab.py`.
- **UX**: Implemented `ToastManager` feedback for manual refresh actions (Start/Success/Fail).
- **Server**: Verified DB injection. Note: Server restart required to load new seeds.

## Client Update: Mass Expansion (Phase 5)
- **Data**: Injected ~1200+ new items via `mass_vocab_injector.py` to ensure "3 Full Refreshes" capacity.
    - **English**: Elementary (411), Intermediate (486), Common Phrases (739).
    - **Chinese**: Classical (606), Poetry (606).
- **Verification**: Ran `analyze_vocab.py` to confirm all target categories > 300.
- **Hotfix**: Fixed server-side seeding logic to correctly respect `level` differences.
- **Hotfix**: Resolved iOS compiler errors iteratively via CLI analysis:
    - **DailyWordBadge.swift**: Fixed extraneous braces, ToolbarContent types, and non-optional binding logic.
    - **FileDownloader.swift**: Addressed strict concurrency violations (removed `@MainActor` from class, used `nonisolated` delegates).
    - **DailyWordService.swift**: Removed redundant nil-coalescing (`?? 0`) on non-optional ID.

## Client Update: Data & Audio Fixes (Phase 7)
- **Audio Bug**: Fixed stale audio state by:
    1.  Adding `didSet` observer to `currentIndex` in `DailyWordService`.
    2.  Passing explicit text `service.speak(text: word.word)` in `DailyWordBadge`.
- **Mass Expansion (DE/JA)**:
    - Updated `mass_vocab_injector.py` to support German (A1-C1) and Japanese (N5-N2).
    - **Verified Counts**: All funded levels now > 300 words (previously < 50 for some).
    - German A1-C1: ~360-400 each.
    - Japanese N5-N2: ~360-400 each.

## Infinite Engine (Phase 8: Prep)
- **Hunger Index (Monitor)**: Implemented `/api/admin/vocab-health` endpoint.
    - **Logic**: Aggregates vocabulary by Language/Level.
    - **Thresholds**: Marks <100 as "Critical", <300 as "Low".
    - **Verified**: Detected "Critical" status for English Advanced & Chinese HSK series (correctly).
- **Forge Trigger (Action)**: Implemented `/api/admin/forge/trigger`.
    - Spawns `ai_forge.js` process to theoretically generate new words.
    - Currently runs in **Simulation Mode** (requires API Key for real generation).
- **Context UI & Schema**:
    - **Database**: Added `topic` column to `vocabulary` table (auto-migration).
    - **Client**: Updated `WordEntry` model and `DailyWordBadge` to display Topic Tags (e.g., "PHYSICS").
    - **Verified**: API returns `topic` field, client parses it.

## Client Update: UX Modernization (Phase 6)
- **Interaction**: Replaced "Prev/Next" buttons with **Swipe Gestures** (`TabView` with `.page` style).
- **Navigation**: Added "Swipe Up" (or tap handle) to view full **Batch List** (`DailyWordListView`).
- **Refactor**: Simplified `DailyWordSheet` layout, moving progress indicator to the bottom handle.
        - **Manual Trigger**: Tap book icon or pull-to-refresh to force fetch (+20 words).
        - **UI Upgrade**: Added Library Count, Toolbar Progress Ring, and Bottom Overlay Toast.
    - **Settings Refactor**:
        - Reorganized sections: General, Content, Connection, Maintenance, About.
        - **Dialog Standardization**: Replaced `.alert` with `.confirmationDialog` for "Reset Preferences".
        - **Toast Specs**: Defined `standard` (Glass) vs `prominent` (Solid Color + Haptic) styles。
    - 将 `FilePreviewSheet.swift` 重构为 分页器 (Pager) + 单项视图 (Item View)。
    - 更新了 `FileBrowserView`, `SharesListView`, `RecentFilesListView`, `StarredView`, `DashboardView` 的调用逻辑。
    - 修复了编译错误 (`onGoToLocation` 签名问题)。
    - 修复了手势冲突 (垂直拖拽 vs 水平滑动)。
- **关键决策**:
    - 使用带逻辑判断的 `DragGesture` 以忽略水平位移，而非使用 `UIGestureRecognizer`，以保持 SwiftUI 纯度。
    - 对于大图优先加载缩略图以提升性能。

### 任务: 修复系统与网络交互 (System Dashboard & Web Uploader Fixes)
- **状态**: ✅ 已完成
- **变更内容**:
    - **后端**: 修复 `Server` SQL 查询逻辑，实现 "Omni-Matcher" 别名匹配（兼容 `MS` 和 `市场部 (MS)` 路径），彻底解决 Web 端 Uploader Unknown 问题。
    - **后端**: 修复 `SystemStats` 接口 JSON 字段映射问题 (`snake_case` vs `camelCase`)，解决 Dashboard 白屏。
    - **iOS**: 增强 `FilePreviewSheet`，实现文件夹内容数量异步加载 (`childCount`) 和滑动边界 Toast 提示（修复了 Toast 滞留 Bug 并优化了样式）。
    - **Daily Word 2.0**:
        - **Server**: 新增 `vocabulary` SQLite 表，迁移硬编码词汇至数据库。
        - **API**: 实现 `GET /api/vocabulary/random` 接口，支持按语言和难度筛选。
        - **Web**: 更新组件使用服务端 API，支持动态获取和刷新。
        - **iOS**: 更新 `DailyWordService` 使用 `URLSession` 调用 API，`WordEntry` 模型兼容 snake_case。
    - **iOS Daily Word UX 优化**:
        - 实现 Cache-First 策略：启动时立即显示缓存词汇。
        - API 后台更新，静默刷新 UI。
        - UserDefaults 持久化缓存。
    - **Dashboard Bug 修复**:
        - Server 端跳过无权限访问的系统文件夹（`.TemporaryItems` 等）。
        - 解决 Admin 仪表盘 500 错误。
    - **词汇库扩容**: 从 5 个示例词扩充至 100 个高质量词汇（覆盖所有语种和难度）。
    - **Preview Button 修复**: 修正闭包 nil 传递逻辑，FileBrowser 预览不再显示"所在位置"按钮。
    - **默认排序优化**: FileBrowser 默认按日期倒序（最新优先）。
    - **Dashboard 本地化**: 完成 Admin 和个人中心 Dashboard 的多语言支持。
    - **状态持久化**: 使用 `@AppStorage` 记住用户的排序方式和视图模式。
    - **Toast 系统升级**: 实现分级提示（Standard/Prominent），支持触感反馈。
    - **重置功能**: 设置页新增偏好重置，支持 Alert 二次确认和强反馈。
    - **全面多语言**: 扫除代码中残留的硬编码 Toast 字符串，实现全覆盖。
- **关键技术**:
    - SQLite `RANDOM()` 查询优化。
    - React Hooks (`fetchWord`) 异步状态管理。
    - iOS Toast 交互优化 (.onChange)。

---

## 会话: 2026-01-22

### 任务: 修复 Uploader Unknown 问题
- **预估耗时 (Effort)**: ~10 轮对话
- **变更内容**:
    - 排查后端 `index.js` 中 `api/thumbnail` 的逻辑。
    - 发现 `isLargeImage` 逻辑中针对 0 字节文件的判断缺陷。
    - 修复 "查看原图" 按钮的显示逻辑。
- [2026-02-03] Implemented 'Pulse View' for Inquiry Tickets: grouped by urgency (>3d, >24h, Active), optimized card layout for market efficiency.
- [2026-02-03] Phase 6 Completed: Added 'Scope Bar' (Time/Product Filters). Created 'products.js' API, updated backend query logic, and replaced frontend Tabs.
- [2026-02-03] Fixed Empty Ticket List: Adjusted date filter logic (YYYY-MM-DD) and fixed TypeScript syntax error in InquiryTicketListPage. Added 'product_id' column to DB.
- [2026-02-03] Fixed Date Formatting: Updated Backend to return ISO Date Strings for better compatibility with Frontend date parsing.
