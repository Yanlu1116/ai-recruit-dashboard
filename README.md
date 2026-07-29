# AI 招聘智能体 Dashboard

自动分析简历、智能排序候选人、直连邮箱搜索实习生简历。

## 功能

- **职位描述分析** — 填写 JD，自动提取技能要求和职责关键词
- **多格式简历上传** — 支持 PDF / DOCX 拖拽上传或粘贴文本
- **邮箱直连搜索** — 绑定 Outlook/Gmail/QQ/163 邮箱，自动搜索含"实习/秋招/求职"关键词的简历附件
- **项目级深度匹配** — 解析简历中每个项目经历，逐条对照 JD 验证真实性（反"乱写"）
- **智能排序** — 技能匹配 + 经验评估 + 学历匹配 + 项目真实性综合打分
- **入选理由透明化** — 每名候选人下方展示具体排名原因，点名具体项目和匹配细节
- **简历原文弹窗** — 点击排名或候选人卡片即可查看完整简历
- **导出分析报告** — 一键导出 HTML 报告

## 在线使用

🔗 **[https://ai-recruit-dashboard.onrender.com](https://ai-recruit-dashboard.onrender.com)**

## 自行部署

1. Fork 本仓库
2. 注册 [Render](https://render.com)（免费）
3. New Web Service → 连接 Fork 的仓库
4. Build Command: `pip install -r requirements.txt`
5. Start Command: `gunicorn server:app --bind 0.0.0.0:$PORT`
6. 点 Create Web Service，等待部署完成

## 技术栈

- 前端：HTML + CSS + 原生 JavaScript
- 后端：Python Flask + gunicorn
- 简历解析：PyPDF2 / python-docx
- 邮箱连接：IMAP（支持 Outlook / Gmail / QQ / 163）
