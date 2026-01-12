# 🌐 Longhorn Client (网页端)

这是 Longhorn 的前端项目，基于 React 和 Vite 构建。

## 技术栈
- **框架**: React 18
- **构建工具**: Vite
- **图标**: Lucide React
- **样式**: CSS (部分模块化)

## 主要功能
- 文件浏览与搜索
- 大文件分片上传
- 文件夹管理
- 分享链接生成 (密码/有效期)
- 权限管理 (Admin/Contributor/Viewer)

## 开发与编译
```bash
# 进入目录
cd client

# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 构建生产版本
npm run build
```

---
*注：生产环境部署通常由根目录的 `scripts/deploy.sh` 自动完成。*
