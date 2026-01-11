# Prompt Log - Longhorn项目历史记录

本文档记录Longhorn项目开发过程中的所有用户prompt，用于追踪需求和问题演进。

---

## 2026-01-11

### 11:22 - iPhone 药丸屏遮挡
```
现在手机竖屏，登录进去之后，手机是iPhone Air或者Pro，pill screen。会出现这样的状况，就是上面被遮挡，甚至点击sidebar---都很难点击。请处理。
```
**修复**: 添加 `viewport-fit=cover` 和 CSS `env(safe-area-inset-*)` 适配，解决 Dynamic Island 遮挡问题。

### 01:20 - 文件夹显示为空与 Unknown 上传者
```
opware服务器，文件浏览器有问题：比如点击面包屑，显示为空...
还有unknown这个notorious问题...
```
**分析**:
1. 文件夹为空：前端路径与物理路径不匹配（数据库新旧部门混杂）。
2. Unknown 上传者：数据库 `file_stats` 缺少 OP 目录下文件夹的记录。
**修复**: 执行数据库清洗（删除旧部门ID），手动插入缺失文件夹记录并归属 Admin。

### 00:48 - 弹窗遮挡与隐藏文件
```
Fixing UI Issues
1. Hidden Files in Folder Tree Selector
2. Modal Z-Index Issue
```
**修复**:
1. 提升 Modal Z-index (4000+)，解决 UserDetails 遮挡授权弹窗问题。
2. 前端 FolderTreeSelector 增加 `.chunks` 过滤逻辑。
3. 恢复用户菜单两行显示。

---

## 2026-01-10

### 11:03 - PM2 Cluster模式咨询
```
你再考虑 PM2 Cluster 模式 ，是否可以加速这个大文件传输和合并。服务器是M1芯片，所有处理能力CPU和GPU很强。也许可以利用好。
```
**结论**: Cluster模式对单个大文件上传帮助有限（瓶颈是网络），但可提升多用户并发处理能力。M1 GPU对Node.js无直接作用。暂不启用。

### 10:56 - 分块上传实现
```
好的，现在你处理大文件传输，切割小文件的方式，来解决100s。你选择一个最佳的小文件大小尺寸。一般我们上传文件不会超过500MB。
```
**实现**: 5MB分块大小，前端切片上传，后端合并。彻底绕过Cloudflare 100秒限制。

### 10:51 - 版本时间标注需求
```
所有日期时间：显示为北京时间。
此外，我去看这个时间的时候，会困惑，究竟是我关注服务器启动时间有意义呢，还是代码最后版本交付时间有意义呢？作为设计系统和调试系统的人，应该对后者更感兴趣。作为运营的人，对前者更感兴趣。
```
**实现**: 双时间显示 - "代码版本"(Commit Time) + "构建部署"(Build Time)，均锁定北京时间(GMT+8)。

### 10:43 - 版本号Hash困惑
```
每次更新程序的时候，我很难判断是否更新了版本，hash code太随机了。而且本地的hash code和服务器上的居然不一样。
```
**实现**: 在Login、Sidebar、TopBar三处添加Build Time显示，便于验证部署状态。

### 10:41 - 自动部署哨兵权限问题
```
[1]  + exit 126   nohup ./deploy-watch.sh > sentinel.log 2>&1
仍然没有deploy-watch
```
**解决**: `chmod +x deploy-watch.sh` + `pm2 start ./deploy-watch.sh --name "sentinel" --interpreter bash`

### 10:37 - 自动更新线程查询
```
我记得服务器上有每分钟就在检测git代码更新，如果有更新就同步的线程、你找一下是否有在运行
```
**发现**: `deploy-watch.sh` 脚本（每60秒检测Git更新并自动部署）

### 10:28 - 小文件上传延迟问题
```
上传了个mov hevc文件(仅几M大小)，100%之后等了很久，才出现上传成功的提示。不应该100%之后，就立刻提示，并更新列表吗
```
**修复**: 
1. 服务端添加数据库事务(Transaction)减少磁盘I/O
2. 前端100%时显示"处理中..."状态
3. 汉化修复

### 10:27 - Cloudflare Tunnel确认
```
我的确使用Cloudflare Tunnel (穿透)。所以使用增加一个上传域名让它变成灰色（显示为 "DNS only"），这个方法去处理upload规避100秒，是无效的？
```
**确认**: Tunnel模式下DNS-only无效，必须实现分块上传。

---

## 2026-01-09

### 09:30 - FileBrowser和RecycleBin国际化修复（续）
```
问题依然存在
```
**附图**: `/Users/Kine/.gemini/antigravity/brain/e669b095-be00-4cbe-99a1-8a03fa89b5db/uploaded_image_1767922211753.png`
显示：FileBrowser表头仍显示"NAME", "UPLOADER", "UPLOAD DATE", "SIZE", "ACCESS COUNT"（英文）

### 09:22 - FileBrowser中文翻译仍未生效
```
仍然如此。
```
说明：验证编译后JS包含中文翻译，但浏览器显示仍为英文

### 09:15 - FileBrowser和RecycleBin国际化修复
```
中文时候，文件浏览器表头成英文了？还有一些按键也是英文，upload, delete, 菜单的delete都是。你仔细看看。修改好
```
**附图**: 
- `/Users/Kine/.gemini/antigravity/brain/e669b095-be00-4cbe-99a1-8a03fa89b5db/uploaded_image_0_1767892001581.png`
- `/Users/Kine/.gemini/antigravity/brain/e669b095-be00-4cbe-99a1-8a03fa89b5db/uploaded_image_1_1767892001581.png`

显示：FileBrowser表头"NAME"/"UPLOADER"等全为英文，"Selected 2 items", "Batch Delete", "Upload", "Share", "Delete"等按钮也是英文

### 01:04 - RecycleBin时间locale问题
```
而不是"3 天前"、"5 天前"。"没有搞定
无痕窗口打开仍然如此
```
**附图**: `/Users/Kine/.gemini/antigravity/brain/e669b095-be00-4cbe-99a1-8a03fa89b5db/uploaded_image_1767891386903.png`
显示：德语模式下，回收站时间仍显示"3 天前"、"5 天前"而非"vor 3 Tagen"

---

## 2026-01-08

### 14:16:59 - 搜索页面全中文
```
搜索页面，全中文。
```
