# Longhorn 自动化部署指引

您可以使用以下流程实现从 **MBAir (开发)** 到 **Mac mini (服务器)** 的一键迁移。

## 第一阶段：MBAir 准备工作
由于我们要全自动化，您只需要拷贝这个名为 `Longhorn` 的整个文件夹。

### 拷贝建议清单：
1. **源码**：`client/`, `server/`, `package.json` (根目录那个)。
2. **引导脚本**：我为您新建的 `setup.sh`。
3. **配置文件**：如果您有 `.env` 文件，请确保包含在内。

> [!TIP]
> **不要拷贝 `node_modules` 目录**。各个电脑架构不同（特别是 M1），`node_modules` 需要在 M1 上重新生成。

---

## 第二阶段：Mac mini 自动化安装

1. **登录 Mac mini**：使用您的管理员账户。
2. **放置文件夹**：将拷贝的 `Longhorn` 文件夹放在任一目录（如 `Documents`）。
3. **打开终端 (Terminal)**：进入该文件夹：
   ```bash
   cd path/to/Longhorn
   ```
4. **运行一键引导命令**：
   ```bash
   chmod +x setup.sh && ./setup.sh
   ```

> [!TIP]
> **常见错误处理**：
> 1. 如果提示 `locked ... .incomplete`：新版脚本已加入自动清理逻辑；或者手动运行 `rm -rf $(brew --cache)/downloads/*.incomplete`。
> 2. 如果提示 `jws.json` 错误：这是 Homebrew 服务器通讯异常，请使用以下“强制绕过”命令：
>    `HOMEBREW_NO_INSTALL_FROM_API=1 ./setup.sh`

### setup.sh 会自动完成：
- 🛠️ **安装 Homebrew** (Mac 必备包管理)。
- 🟢 **安装 Node.js 20+**。
- 📂 **安装 Git**。
- 🔄 **安装 PM2** (保证程序不崩溃、重启自动运行)。
- ☁️ **安装 Cloudflared** (为 `opware.kineraw.com` 准备)。
- 🏗️ **安装所有依赖并编译 UI**。

---

## 第三阶段：开启公网访问 (opware.kineraw.com)

实现公网访问需要两步：**域名转交** 和 **隧道开启**。

### 1. 域名 DNS 权限转交 (在 GoDaddy 操作)
由于 `kineraw.com` 目前使用了自定义的 `ns3.v4.cn`，这意味着您的解析暂由第三方管理。

1. **注册 Cloudflare**：添加站点 `kineraw.com`。
2. **导入记录 (非常关键)**：Cloudflare 会自动扫描您现有的 DNS 记录。
   > [!IMPORTANT]
   > 请务必核对 Cloudflare 扫描出的 A、MX、CNAME 记录是否与您当前 `ns3.v4.cn` 里的记录一致。如果漏掉，可能会导致您的现有网站或邮箱失效。
3. **获取 Cloudflare Nameservers**：获得两条类似 `xxxx.ns.cloudflare.com` 的地址。
4. **GoDaddy 修改**：
   - 进入 GoDaddy 管理中心 -> **域名** -> `kineraw.com` -> **DNS** -> **名称服务器 (Nameservers)**。
   - 点击 **更改 (Change)**，选择 **“使用我自己的名称服务器”**。
   - 输入 Cloudflare 的两条地址并保存。

---

### 2. 配置隧道 (在 Mac mini 操作)
环境就绪后，在 Mac mini 终端执行：

1. **启动后端服务**：
   ```bash
   pm2 start server/index.js --name longhorn
   ```
2. **配置并运行隧道 (一次性操作)**：
   - 运行：`cloudflared tunnel login` （选择 `kineraw.com` 授权）。
   - 运行：`cloudflared tunnel create longhorn-proxy`。
   - **关键映射**：
     `cloudflared tunnel route dns longhorn-proxy opware.kineraw.com`
   - **启动隧道**：
     `cloudflared tunnel run --url http://localhost:4000 longhorn-proxy`

> [!IMPORTANT]
> 运行完成后，全球任何地方访问 `https://opware.kineraw.com` 即可直接使用。
