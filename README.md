# AI 招聘智能体 Dashboard

自动分析简历、智能排序候选人、直连邮箱搜索实习生简历。

## 功能

- **职位描述分析** — 填写 JD，自动提取技能要求和职责关键词
- **多格式简历上传** — 支持 PDF / DOCX 拖拽上传或粘贴文本
- **邮箱直连搜索** — 支持 IMAP/POP3 两种协议，可连接 Outlook/Gmail/QQ/163/公司内网邮箱
- **项目级深度匹配** — 解析简历中每个项目经历，逐条对照 JD 验证真实性（反"乱写"）
- **智能排序** — 技能匹配 + 经验评估 + 学历匹配 + 项目真实性综合打分
- **入选理由透明化** — 每名候选人下方展示具体排名原因，点名具体项目和匹配细节
- **简历原文弹窗** — 点击排名或候选人卡片即可查看完整简历
- **导出分析报告** — 一键导出 HTML 报告

## 在线使用

🔗 **[https://ai-recruit-dashboard.onrender.com](https://ai-recruit-dashboard.onrender.com)**

> ⚠️ **关于邮箱功能**：Render 是云端沙盒，无法连接公司内网邮箱（如 `gjzq.com.cn`、`qq.com` 等）。要使用真实邮箱搜索功能，请在本地运行 `python server.py` 访问 `http://localhost:8089`。

## 邮箱配置说明

支持两种协议：

| 协议 | 适用场景 | 默认端口 |
|---|---|---|
| **POP3**（推荐） | 公司内网邮箱、QQ/163/Outlook（IT 不让用 IMAP 时） | 110 (明文) / 995 (SSL) |
| **IMAP** | 允许 IMAP 的现代邮箱 | 143 (明文) / 993 (SSL) |

### 公司内网邮箱配置示例（如国金证券 `gjzq.com.cn`）

1. 邮箱类型选「其他（手动填写）」
2. 收信协议选 **POP3**
3. 服务器填 `email.gjzq.com.cn`，端口填 `110`
4. **取消勾选** SSL（公司内网 POP3 通常是明文）
5. 邮箱地址填完整地址，密码填邮箱登录密码

### 常见邮箱预设

下拉框已内置以下邮箱的 IMAP/POP3 配置：
- Outlook / Hotmail / Live
- Gmail
- QQ邮箱 / 163邮箱 / 126邮箱
- 新浪邮箱 / 搜狐邮箱 / 139邮箱

## 自行部署

1. Fork 本仓库
2. 注册 [Render](https://render.com)（免费）
3. New Web Service → 连接 Fork 的仓库
4. Build Command: `pip install -r requirements.txt`
5. Start Command: `gunicorn server:app --bind 0.0.0.0:$PORT`
6. 点 Create Web Service，等待部署完成

## 本地运行

```bash
git clone <your-fork-url>
cd ai-recruit-dashboard
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
python server.py --port 8089
# 浏览器打开 http://localhost:8089
```

## 技术栈

- 前端：HTML + CSS + 原生 JavaScript
- 后端：Python Flask + gunicorn
- 简历解析：PyPDF2 / python-docx
- 邮箱连接：**POP3**（poplib 标准库）/ **IMAP**（imaplib 标准库），同时支持

