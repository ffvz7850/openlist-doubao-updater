# OpenList 豆包一键更新（浏览器扩展）· 纯净版 v1.1.0

解决 OpenList 里豆包网盘 Cookie 频繁过期、需要反复到管理后台手动更新的问题。

本版本为**纯净版**：不包含任何人的服务器地址、账号或密码，首次使用需自己配置。适合分享给他人使用。

## 安装

1. 打开浏览器扩展管理页：
   - Edge：地址栏输入 `edge://extensions`
   - Chrome：地址栏输入 `chrome://extensions`
2. 打开右上角「开发人员模式」（Developer mode）开关。
3. 点击「加载解压缩的扩展」（Load unpacked），选择本文件夹：
   `D:\PCAPP\DBAO\openlist-doubao-updater-1.1.0`
4. 扩展图标出现在工具栏后，右键图标 →「选项」（或点弹窗右上角「设置」）。

## 首次配置（每个人只需要做一次）

1. 打开设置页，填写你自己的：
   - OpenList 服务器地址，例如 `http://192.168.1.100:5244`（换成你自己的）
   - 用户名 / 密码（或填 Admin Token，留空则用用户名密码登录）
   - 豆包存储 ID（在 OpenList 管理后台 - 存储 页面查看，通常是豆包网盘对应的那个编号）
2. 点「保存」。保存时浏览器会询问是否允许扩展访问该服务器地址，点「允许」。
3. 在浏览器里登录豆包云盘：`https://www.doubao.com/chat/drive`（保持登录态）。

## 使用

点扩展图标 → 「从浏览器读取豆包 Cookie 并更新」，一次完成。

如果 Cookie 来自其它浏览器：点「手动粘贴 Cookie 更新」，把豆包云盘 F12 → Network → 搜 `biz_auth` → 请求头里的完整 Cookie 粘贴进去再更新。

## 工作原理

- 豆包驱动（DoubaoNew）的 `addition.cookie` 中包含 `LARK_SUITE_ACCESS_TOKEN`、`LARK_SUITE_DPOP`、`feishu_dpop_keypair` 等关键字段，驱动运行时从中提取 Authorization / DPoP 凭证。
- 扩展仅更新 `cookie` 字段，其它字段（根目录、app_id、dpop_key_secret 等）保持不变。
- 调用 OpenList 管理 API：登录（`/api/auth/login`）→ 查询存储（`/api/admin/storage/get`）→ 更新存储（`/api/admin/storage/update`）。

## 常见问题

- **提示 Cookie 中 Token 已过期**：当前浏览器里豆包登录态已失效，先重新登录豆包云盘再更新。
- **提示缺 LARK_SUITE_ACCESS_TOKEN / LARK_SUITE_DPOP**：复制的 Cookie 不完整，按上面手动方式重新从 `biz_auth` 请求头完整复制。
- **提示未授权访问服务器**：点「允许」授权即可；若之前误点拒绝，到扩展管理页该扩展详情里手动开启站点访问权限。
- **更新后 OpenList 显示 Token 过期**：豆包接口本身是逆向接口，偶发失效属正常，重新复制最新 Cookie 再更新一次即可。

## 安全说明

- 本扩展不含任何账号密码；每个人的账号密码只保存在自己本机浏览器扩展存储（chrome.storage.local）中。
- 扩展只向你自己填写的 OpenList 服务器地址发送请求，服务器访问权限由浏览器按需询问授权。
