#!/usr/bin/env python3
"""
AI Recruit Agent — 邮箱简历导入服务器

支持两种模式：
1. IMAP 直连模式：配置邮箱后，直接从 Outlook/Gmail/QQ/163 等搜索简历
2. 演示/缓存模式：使用本地缓存数据（无需配置邮箱）

REST API:
  GET  /api/email-config       — 查看邮箱配置状态
  POST /api/email-config       — 保存邮箱配置（IMAP 服务器、账号、授权码）
  DELETE /api/email-config     — 删除邮箱配置
  GET  /api/search-emails      — 搜索邮箱简历（自动选择 IMAP 或缓存模式）
  GET  /api/resume-text/<id>   — 获取简历文本
  POST /api/batch-import       — 批量导入简历到 Dashboard
  GET  /api/cache-status       — 查看缓存状态
  POST /api/clear-cache        — 清理缓存
"""

import os
import sys
import json
import time
import hashlib
import imaplib
import email
import re
import ssl
from datetime import datetime
from pathlib import Path
from email.header import decode_header
from email.utils import parsedate_to_datetime

from flask import Flask, request, jsonify, send_from_directory
from PyPDF2 import PdfReader
import docx

# ========== 配置 ==========
BASE_DIR = Path(__file__).parent
CACHE_DIR = BASE_DIR / ".email_cache"
CACHE_DIR.mkdir(exist_ok=True)
CONFIG_FILE = BASE_DIR / ".email_config.json"

DEFAULT_KEYWORDS = ["intern", "实习", "秋招", "求职"]

# 常见邮箱 IMAP 配置
IMAP_PRESETS = {
    "outlook": {
        "name": "Outlook / Hotmail",
        "server": "outlook.office365.com",
        "port": 993,
    },
    "gmail": {
        "name": "Gmail",
        "server": "imap.gmail.com",
        "port": 993,
    },
    "qq": {
        "name": "QQ邮箱",
        "server": "imap.qq.com",
        "port": 993,
    },
    "163": {
        "name": "163邮箱",
        "server": "imap.163.com",
        "port": 993,
    },
    "126": {
        "name": "126邮箱",
        "server": "imap.126.com",
        "port": 993,
    },
    "sina": {
        "name": "新浪邮箱",
        "server": "imap.sina.com",
        "port": 993,
    },
    "sohu": {
        "name": "搜狐邮箱",
        "server": "imap.sohu.com",
        "port": 993,
    },
}

app = Flask(__name__)


# ========== 邮箱配置管理 ==========
def load_email_config() -> dict:
    """加载邮箱配置"""
    if CONFIG_FILE.exists():
        return json.loads(CONFIG_FILE.read_text(encoding="utf-8"))
    return {}


def save_email_config(config: dict):
    """保存邮箱配置"""
    CONFIG_FILE.write_text(json.dumps(config, ensure_ascii=False, indent=2), encoding="utf-8")


def delete_email_config():
    """删除邮箱配置"""
    if CONFIG_FILE.exists():
        CONFIG_FILE.unlink()


def get_imap_config() -> dict | None:
    """获取可用的 IMAP 配置"""
    config = load_email_config()
    preset_key = config.get("preset", "")
    if preset_key in IMAP_PRESETS:
        preset = IMAP_PRESETS[preset_key]
        return {
            "server": preset["server"],
            "port": preset["port"],
            "email": config.get("email", ""),
            "password": config.get("password", ""),
        }
    elif config.get("server"):
        return {
            "server": config["server"],
            "port": config.get("port", 993),
            "email": config.get("email", ""),
            "password": config.get("password", ""),
        }
    return None


# ========== PDF / DOCX 解析 ==========
def extract_pdf_text(filepath: Path) -> str:
    try:
        reader = PdfReader(str(filepath))
        texts = []
        for page in reader.pages:
            t = page.extract_text()
            if t:
                texts.append(t.strip())
        return "\n".join(texts)
    except Exception as e:
        return f"[PDF解析错误: {e}]"


def extract_docx_text(filepath: Path) -> str:
    try:
        doc = docx.Document(str(filepath))
        texts = [para.text.strip() for para in doc.paragraphs if para.text.strip()]
        return "\n".join(texts)
    except Exception as e:
        return f"[DOCX解析错误: {e}]"


def extract_resume_text(filepath: Path) -> str:
    ext = filepath.suffix.lower()
    if ext == ".pdf":
        return extract_pdf_text(filepath)
    elif ext in (".docx", ".doc"):
        return extract_docx_text(filepath)
    elif ext == ".txt":
        return filepath.read_text(encoding="utf-8", errors="replace")
    else:
        return f"[不支持的文件类型: {ext}]"


# ========== 缓存管理 ==========
def get_cache_meta_path():
    return CACHE_DIR / "cache_meta.json"


def load_cache_meta() -> dict:
    meta_path = get_cache_meta_path()
    if meta_path.exists():
        return json.loads(meta_path.read_text(encoding="utf-8"))
    return {"emails": [], "resumes": [], "last_updated": None}


def save_cache_meta(meta: dict):
    meta_path = get_cache_meta_path()
    meta_path.write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")


def get_resume_text_path(email_id: str) -> Path:
    return CACHE_DIR / f"resume_{email_id}.txt"


# ========== IMAP 邮箱搜索 ==========
def decode_email_header(header_value) -> str:
    """解码邮件标题（处理 =?UTF-8?B?...?= 等编码）"""
    if not header_value:
        return ""
    try:
        parts = decode_header(header_value)
        result = ""
        for part, charset in parts:
            if isinstance(part, bytes):
                result += part.decode(charset or "utf-8", errors="replace")
            else:
                result += str(part)
        return result
    except Exception:
        return str(header_value)


def decode_email_address(addr_str: str) -> str:
    """从 'Name <email>' 格式中提取可读的发件人信息"""
    if not addr_str:
        return ""
    # 尝试解码
    addr_str = decode_email_header(addr_str)
    # 提取邮箱地址
    match = re.search(r'<(.+?)>', addr_str)
    if match:
        return match.group(1)
    return addr_str.strip()


def is_resume_attachment(filename: str, mime_type: str) -> bool:
    """判断附件是否可能是简历"""
    filename_lower = filename.lower()
    # 检查文件扩展名
    resume_exts = [".pdf", ".doc", ".docx", ".txt"]
    if any(filename_lower.endswith(ext) for ext in resume_exts):
        return True
    # 检查 MIME 类型
    resume_mimes = [
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "text/plain",
    ]
    if mime_type in resume_mimes:
        return True
    return False


def search_emails_via_imap(
    keywords: list[str],
    max_results: int = 50,
    folder: str = "INBOX",
) -> dict:
    """
    通过 IMAP 搜索邮箱中的简历邮件。
    返回格式与 search_emails API 一致。
    """
    imap_conf = get_imap_config()
    if not imap_conf:
        return {"success": False, "error": "未配置邮箱", "emails": [], "total": 0}

    server = imap_conf["server"]
    port = imap_conf["port"]
    email_addr = imap_conf["email"]
    password = imap_conf["password"]

    try:
        # 连接 IMAP 服务器
        context = ssl.create_default_context()
        conn = imaplib.IMAP4_SSL(server, port, ssl_context=context, timeout=30)

        try:
            conn.login(email_addr, password)
        except imaplib.IMAP4.error as e:
            error_msg = str(e)
            if "authentication" in error_msg.lower() or "login" in error_msg.lower():
                hint = ""
                if "outlook" in server:
                    hint = "（Outlook 需使用应用密码，请在 Microsoft 帐户安全设置中生成）"
                elif "gmail" in server:
                    hint = "（Gmail 需使用应用专用密码，请在 Google 帐户 → 安全性 → 应用专用密码中生成）"
                elif "qq" in server:
                    hint = "（QQ邮箱需使用授权码，请在 QQ邮箱设置 → 账户 → POP3/IMAP 服务中生成）"
                elif "163" in server:
                    hint = "（163邮箱需使用授权码，请在 163邮箱设置 → POP3/SMTP/IMAP 中开启并获取）"
                return {
                    "success": False,
                    "error": f"登录失败：请检查邮箱地址和授权码是否正确{hint}",
                    "emails": [],
                    "total": 0,
                }
            return {"success": False, "error": f"登录失败: {error_msg}", "emails": [], "total": 0}

        # 选择文件夹
        status, _ = conn.select(folder, readonly=True)
        if status != "OK":
            return {"success": False, "error": f"无法打开文件夹: {folder}", "emails": [], "total": 0}

        # 搜索邮件：用 IMAP OR 组合关键词
        # IMAP 搜索语法: OR (OR SUBJECT "kw1" BODY "kw1") (OR SUBJECT "kw2" BODY "kw2") ...
        # 为简化，先用 SUBJECT 搜索，再用 BODY 搜索，合并结果
        all_msg_ids = set()

        for kw in keywords:
            for field in ["SUBJECT", "BODY"]:
                try:
                    # 对中文关键词使用 UTF-8 编码的搜索
                    search_criteria = f'({field} "{kw}")'
                    status, data = conn.search(None, "CHARSET", "UTF-8", search_criteria)
                    if status == "OK" and data[0]:
                        ids = data[0].split()
                        all_msg_ids.update(id.decode() for id in ids)
                except Exception:
                    # 回退到 ASCII 搜索
                    try:
                        status, data = conn.search(None, search_criteria)
                        if status == "OK" and data[0]:
                            ids = data[0].split()
                            all_msg_ids.update(id.decode() for id in ids)
                    except Exception:
                        pass

        if not all_msg_ids:
            conn.close()
            conn.logout()
            return {
                "success": True,
                "emails": [],
                "total": 0,
                "message": f"在文件夹 {folder} 中未找到匹配关键词的邮件",
                "searched_keywords": keywords,
            }

        # 按 ID 降序排列（最新的在前），限制数量
        sorted_ids = sorted(all_msg_ids, key=int, reverse=True)[:max_results]

        # 获取邮件详情
        emails = []
        for msg_id in sorted_ids:
            try:
                status, data = conn.fetch(msg_id.encode(), "(BODY.PEEK[HEADER.FIELDS (SUBJECT FROM DATE)] BODYSTRUCTURE)")
                if status != "OK":
                    continue

                # 解析邮件头
                msg_data = data[0][1] if isinstance(data[0], tuple) else None
                if not msg_data:
                    continue

                header_msg = email.message_from_bytes(msg_data)

                subject = decode_email_header(header_msg.get("Subject", "(无主题)"))
                from_addr = decode_email_address(header_msg.get("From", ""))
                date_str = header_msg.get("Date", "")
                try:
                    date_obj = parsedate_to_datetime(date_str)
                    date_iso = date_obj.isoformat()
                except Exception:
                    date_iso = date_str

                # 获取 bodystructure 来找出附件
                attachments = []
                if len(data) > 1 and data[1]:
                    body_structure = data[1]
                    # 解析 bodystructure 找附件
                    # 简化处理：获取完整邮件来解析附件
                    pass

                # 获取完整邮件来解析附件
                status2, msg_data2 = conn.fetch(msg_id.encode(), "(RFC822)")
                if status2 == "OK" and msg_data2[0]:
                    full_msg = email.message_from_bytes(msg_data2[0][1])

                    # 提取正文摘要
                    snippet = ""
                    if full_msg.is_multipart():
                        for part in full_msg.walk():
                            content_type = part.get_content_type()
                            if content_type == "text/plain":
                                try:
                                    payload = part.get_payload(decode=True)
                                    if payload:
                                        charset = part.get_content_charset() or "utf-8"
                                        snippet = payload.decode(charset, errors="replace")[:300]
                                except Exception:
                                    pass
                                break
                            elif content_type == "text/html":
                                try:
                                    payload = part.get_payload(decode=True)
                                    if payload:
                                        charset = part.get_content_charset() or "utf-8"
                                        html_text = payload.decode(charset, errors="replace")
                                        # 简单去除 HTML 标签
                                        snippet = re.sub(r'<[^>]+>', ' ', html_text).strip()[:300]
                                except Exception:
                                    pass
                                if not snippet:
                                    continue
                                break
                    else:
                        try:
                            payload = full_msg.get_payload(decode=True)
                            if payload:
                                charset = full_msg.get_content_charset() or "utf-8"
                                snippet = payload.decode(charset, errors="replace")[:300]
                        except Exception:
                            pass

                    # 查找附件
                    for part in full_msg.walk():
                        content_disposition = str(part.get("Content-Disposition", ""))
                        if "attachment" not in content_disposition:
                            continue

                        filename = part.get_filename()
                        if not filename:
                            continue

                        filename = decode_email_header(filename)
                        mime_type = part.get_content_type()

                        if is_resume_attachment(filename, mime_type):
                            attachments.append({
                                "filename": filename,
                                "mime_type": mime_type,
                                "size": len(part.get_payload(decode=True) or b""),
                            })

                # 使用 msg_id 作为唯一 ID
                email_id = f"imap_{msg_id.decode() if isinstance(msg_id, bytes) else msg_id}"

                emails.append({
                    "id": email_id,
                    "subject": subject,
                    "from": from_addr,
                    "date": date_iso,
                    "snippet": snippet[:200] if snippet else "",
                    "attachments": attachments,
                    "has_attachments": len(attachments) > 0,
                })

            except Exception as e:
                print(f"解析邮件 {msg_id} 出错: {e}", file=sys.stderr)
                continue

        conn.close()
        conn.logout()

        return {
            "success": True,
            "emails": emails,
            "total": len(emails),
            "from_cache": False,
            "source": "imap",
            "folder": folder,
            "searched_keywords": keywords,
        }

    except imaplib.IMAP4.error as e:
        error_msg = str(e)
        if "timeout" in error_msg.lower():
            return {"success": False, "error": "连接超时，请检查 IMAP 服务器地址和端口是否正确", "emails": [], "total": 0}
        return {"success": False, "error": f"IMAP 错误: {error_msg}", "emails": [], "total": 0}
    except ssl.SSLError as e:
        return {"success": False, "error": f"SSL 连接失败: {e}", "emails": [], "total": 0}
    except Exception as e:
        return {"success": False, "error": f"连接失败: {e}", "emails": [], "total": 0}


def download_attachment_via_imap(email_id: str, attachment_filename: str) -> str | None:
    """通过 IMAP 下载指定邮件的附件并解析为文本"""
    imap_conf = get_imap_config()
    if not imap_conf:
        return None

    # 从 email_id 提取 IMAP msg_id
    msg_id = email_id.replace("imap_", "")

    server = imap_conf["server"]
    port = imap_conf["port"]
    email_addr = imap_conf["email"]
    password = imap_conf["password"]

    try:
        context = ssl.create_default_context()
        conn = imaplib.IMAP4_SSL(server, port, ssl_context=context, timeout=30)
        conn.login(email_addr, password)
        conn.select("INBOX", readonly=True)

        status, data = conn.fetch(msg_id.encode(), "(RFC822)")
        if status != "OK":
            conn.close()
            conn.logout()
            return None

        full_msg = email.message_from_bytes(data[0][1])

        # 查找附件
        for part in full_msg.walk():
            content_disposition = str(part.get("Content-Disposition", ""))
            if "attachment" not in content_disposition:
                continue

            filename = part.get_filename()
            if not filename:
                continue

            filename = decode_email_header(filename)
            if filename != attachment_filename:
                continue

            payload = part.get_payload(decode=True)
            if not payload:
                continue

            # 保存附件
            safe_name = hashlib.md5(filename.encode()).hexdigest()[:8] + "_" + filename
            att_path = CACHE_DIR / f"att_{email_id}_{safe_name}"
            att_path.write_bytes(payload)

            # 解析文本
            text = extract_resume_text(att_path)
            return text

        conn.close()
        conn.logout()
        return None

    except Exception as e:
        print(f"下载附件出错: {e}", file=sys.stderr)
        return None


# ========== API: 邮箱配置 ==========
@app.route("/api/email-config", methods=["GET"])
def get_email_config():
    """查看邮箱配置状态（不返回密码）"""
    config = load_email_config()
    imap = get_imap_config()
    return jsonify({
        "configured": bool(imap),
        "preset": config.get("preset", ""),
        "email": config.get("email", ""),
        "server": imap["server"] if imap else "",
        "port": imap["port"] if imap else 0,
        "presets_available": list(IMAP_PRESETS.keys()),
    })


@app.route("/api/email-config", methods=["POST"])
def set_email_config():
    """保存邮箱配置"""
    data = request.get_json(silent=True) or {}
    preset = data.get("preset", "").strip().lower()
    email_addr = data.get("email", "").strip()
    password = data.get("password", "").strip()
    server = data.get("server", "").strip()
    port = data.get("port", 993)

    if not email_addr:
        return jsonify({"success": False, "error": "请输入邮箱地址"}), 400
    if not password:
        return jsonify({"success": False, "error": "请输入授权码/应用密码"}), 400

    config = {
        "preset": preset if preset in IMAP_PRESETS else "",
        "email": email_addr,
        "password": password,
    }

    if preset not in IMAP_PRESETS:
        if not server:
            return jsonify({"success": False, "error": "请选择邮箱类型或填写 IMAP 服务器地址"}), 400
        config["server"] = server
        config["port"] = port

    save_email_config(config)

    # 快速测试连接
    imap = get_imap_config()
    if imap:
        try:
            context = ssl.create_default_context()
            conn = imaplib.IMAP4_SSL(imap["server"], imap["port"], ssl_context=context, timeout=15)
            conn.login(imap["email"], imap["password"])
            conn.select("INBOX", readonly=True)
            status, data = conn.search(None, "ALL")
            total = len(data[0].split()) if status == "OK" and data[0] else 0
            conn.close()
            conn.logout()
            return jsonify({
                "success": True,
                "message": f"邮箱配置成功！收件箱共 {total} 封邮件",
                "total_emails": total,
            })
        except Exception as e:
            delete_email_config()
            return jsonify({"success": False, "error": f"连接测试失败: {e}"}), 400

    return jsonify({"success": True, "message": "邮箱配置已保存"})


@app.route("/api/email-config", methods=["DELETE"])
def remove_email_config():
    """删除邮箱配置"""
    delete_email_config()
    return jsonify({"success": True, "message": "邮箱配置已删除"})


# ========== API: 搜索邮箱简历 ==========
@app.route("/api/search-emails", methods=["GET"])
def search_emails():
    """
    搜索邮箱中的实习生简历。
    优先使用 IMAP 直连模式，配置不可用时回退到缓存模式。
    """
    keywords_str = request.args.get("keywords", ",".join(DEFAULT_KEYWORDS))
    keywords = [kw.strip() for kw in keywords_str.split(",") if kw.strip()]
    force = request.args.get("force", "").lower() == "true"

    # 检查 IMAP 配置
    imap_conf = get_imap_config()

    if imap_conf and (force or True):
        # 使用 IMAP 直连搜索
        result = search_emails_via_imap(keywords)

        if result["success"]:
            # 将搜索结果写入缓存
            if result["emails"]:
                meta = load_cache_meta()
                existing_ids = {e["id"] for e in meta.get("emails", [])}
                for e in result["emails"]:
                    if e["id"] not in existing_ids:
                        meta["emails"].append(e)
                meta["last_updated"] = datetime.now().isoformat()
                save_cache_meta(meta)

            return jsonify(result)
        else:
            return jsonify(result), 502 if result["error"] else 200

    # 回退到缓存模式
    meta = load_cache_meta()
    if not meta.get("emails") or force:
        return jsonify({
            "success": True,
            "total": 0,
            "emails": [],
            "from_cache": False,
            "message": "未配置邮箱，且缓存为空。请先配置邮箱或使用演示数据。",
            "keywords": keywords,
            "status": "no_data",
            "needs_config": not bool(imap_conf),
        })

    matching = []
    for email_data in meta.get("emails", []):
        subject = email_data.get("subject", "").lower()
        snippet = email_data.get("snippet", "").lower()
        match = any(kw.lower() in subject or kw.lower() in snippet for kw in keywords)
        if match:
            for att in email_data.get("attachments", []):
                txt_path = get_resume_text_path(email_data.get("id", ""))
                att["downloaded"] = txt_path.exists()
                att["extracted_chars"] = len(txt_path.read_text(encoding="utf-8")) if txt_path.exists() else 0
            matching.append(email_data)

    return jsonify({
        "success": True,
        "total": len(matching),
        "emails": matching,
        "from_cache": True,
        "last_updated": meta.get("last_updated"),
        "keywords": keywords,
        "needs_config": not bool(imap_conf),
    })


# ========== API: 下载并解析单封邮件的简历 ==========
@app.route("/api/download-resume/<email_id>", methods=["POST"])
def download_resume(email_id: str):
    """下载指定邮件的附件并解析为文本"""
    data = request.get_json(silent=True) or {}
    filename = data.get("filename", "")

    imap_conf = get_imap_config()

    if not imap_conf:
        # 缓存模式：检查是否已有文本
        txt_path = get_resume_text_path(email_id)
        if txt_path.exists():
            return jsonify({
                "success": True,
                "text": txt_path.read_text(encoding="utf-8", errors="replace"),
                "from_cache": True,
            })
        return jsonify({"success": False, "error": "未配置邮箱且缓存中没有该简历"}), 404

    # IMAP 模式：下载并解析
    text = download_attachment_via_imap(email_id, filename)
    if text:
        # 缓存
        txt_path = get_resume_text_path(email_id)
        txt_path.write_text(text, encoding="utf-8")
        return jsonify({"success": True, "text": text, "length": len(text)})
    else:
        return jsonify({"success": False, "error": "下载或解析失败"}), 500


# ========== API: 获取简历文本 ==========
@app.route("/api/resume-text/<email_id>", methods=["GET"])
def get_resume_text(email_id: str):
    txt_path = get_resume_text_path(email_id)
    if not txt_path.exists():
        return jsonify({"success": False, "error": "简历文本缓存不存在，请先下载附件"}), 404

    text = txt_path.read_text(encoding="utf-8", errors="replace")
    meta = load_cache_meta()
    email_info = None
    for e in meta.get("emails", []):
        if e.get("id") == email_id:
            email_info = e
            break

    return jsonify({
        "success": True,
        "email_id": email_id,
        "subject": email_info.get("subject", "") if email_info else "",
        "from": email_info.get("from", "") if email_info else "",
        "text": text,
        "length": len(text)
    })


# ========== API: 批量导入简历到 Dashboard ==========
@app.route("/api/batch-import", methods=["POST"])
def batch_import():
    data = request.get_json(silent=True) or {}
    email_ids = data.get("email_ids", [])
    keywords_str = data.get("keywords", ",".join(DEFAULT_KEYWORDS))

    if not email_ids:
        keywords = [kw.strip() for kw in keywords_str.split(",") if kw.strip()]
        meta = load_cache_meta()
        for email_data in meta.get("emails", []):
            subject = email_data.get("subject", "").lower()
            snippet = email_data.get("snippet", "").lower()
            if any(kw.lower() in subject or kw.lower() in snippet for kw in keywords):
                email_ids.append(email_data.get("id"))

    # 对于 IMAP 直连模式的邮件，先下载附件
    imap_conf = get_imap_config()
    meta = load_cache_meta()
    resumes = []
    skipped = 0

    for email_id in email_ids:
        txt_path = get_resume_text_path(email_id)

        # 如果文本缓存不存在且有 IMAP 配置，尝试下载
        if not txt_path.exists() and imap_conf:
            email_info = None
            for e in meta.get("emails", []):
                if e.get("id") == email_id:
                    email_info = e
                    break
            if email_info and email_info.get("attachments"):
                att_filename = email_info["attachments"][0].get("filename", "")
                text = download_attachment_via_imap(email_id, att_filename)
                if text:
                    txt_path.write_text(text, encoding="utf-8")

        if not txt_path.exists():
            skipped += 1
            continue

        text = txt_path.read_text(encoding="utf-8", errors="replace")
        email_info = None
        for e in meta.get("emails", []):
            if e.get("id") == email_id:
                email_info = e
                break

        resume_name = email_info.get("subject", "未命名简历") if email_info else "未命名简历"
        if email_info:
            atts = email_info.get("attachments", [])
            if atts:
                resume_name = atts[0].get("filename", resume_name)

        resumes.append({
            "name": resume_name,
            "text": text,
            "size": len(text.encode("utf-8")),
            "email_subject": email_info.get("subject", "") if email_info else "",
            "from": email_info.get("from", "") if email_info else "",
            "source": "imap" if imap_conf else "cache",
        })

    return jsonify({
        "success": True,
        "resumes": resumes,
        "imported": len(resumes),
        "skipped": skipped,
    })


# ========== API: 缓存管理 ==========
@app.route("/api/cache-status", methods=["GET"])
def cache_status():
    meta = load_cache_meta()
    emails_count = len(meta.get("emails", []))
    downloaded = 0
    for e in meta.get("emails", []):
        for _att in e.get("attachments", []):
            txt_path = get_resume_text_path(e.get("id", ""))
            if txt_path.exists():
                downloaded += 1

    imap_conf = get_imap_config()
    return jsonify({
        "success": True,
        "emails_total": emails_count,
        "resumes_cached": downloaded,
        "last_updated": meta.get("last_updated"),
        "cache_dir": str(CACHE_DIR),
        "is_empty": emails_count == 0,
        "imap_configured": bool(imap_conf),
        "imap_email": imap_conf["email"] if imap_conf else "",
    })


@app.route("/api/update-cache", methods=["POST"])
def update_cache():
    data = request.get_json(silent=True) or {}
    emails = data.get("emails", [])
    if not emails:
        return jsonify({"success": False, "error": "emails 参数为空"}), 400

    meta = load_cache_meta()
    existing_ids = {e["id"] for e in meta.get("emails", [])}
    for email_data in emails:
        eid = email_data.get("id")
        if not eid:
            continue
        for att in email_data.get("attachments", []):
            text = att.pop("text", None)
            if text:
                txt_path = get_resume_text_path(eid)
                txt_path.write_text(text, encoding="utf-8")
        if eid in existing_ids:
            for i, e in enumerate(meta["emails"]):
                if e["id"] == eid:
                    meta["emails"][i] = email_data
                    break
        else:
            meta["emails"].append(email_data)

    meta["last_updated"] = datetime.now().isoformat()
    save_cache_meta(meta)
    return jsonify({
        "success": True,
        "total": len(meta["emails"]),
        "new": len([e for e in emails if e.get("id") not in existing_ids]),
        "updated": len([e for e in emails if e.get("id") in existing_ids]),
    })


@app.route("/api/clear-cache", methods=["POST"])
def clear_cache():
    meta_path = get_cache_meta_path()
    if meta_path.exists():
        meta_path.unlink()
    for f in CACHE_DIR.iterdir():
        if f.is_file():
            f.unlink()
    return jsonify({"success": True, "message": "缓存已清理"})


# ========== 静态文件服务 ==========
@app.route("/")
def index():
    return send_from_directory(str(BASE_DIR), "index.html")


@app.route("/<path:filename>")
def static_files(filename):
    return send_from_directory(str(BASE_DIR), filename)


# ========== 演示数据 ==========
def generate_demo_cache():
    demo_emails = [
        {
            "id": "demo_msg_001",
            "subject": "【实习申请】张三 — 前端开发实习生",
            "from": "zhangsan@example.com",
            "date": "2026-07-25T14:30:00",
            "snippet": "您好，我是XX大学计算机科学专业的大三学生，希望应聘贵公司的前端开发实习生岗位...",
            "attachments": [{"id": "demo_att_001", "filename": "张三_前端开发_简历.pdf", "mime_type": "application/pdf", "size": 102400}]
        },
        {
            "id": "demo_msg_002",
            "subject": "李四 — 秋招后端开发工程师简历",
            "from": "lisi@example.com",
            "date": "2026-07-24T16:00:00",
            "snippet": "尊敬的HR，我即将于2027年毕业，看到贵公司的秋招信息，特此投递后端开发岗位...",
            "attachments": [{"id": "demo_att_002", "filename": "李四_Java后端_简历.docx", "mime_type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "size": 87000}]
        },
        {
            "id": "demo_msg_003",
            "subject": "求职：数据分析实习生 — 王五",
            "from": "wangwu@example.com",
            "date": "2026-07-23T10:15:00",
            "snippet": "您好！我是统计学专业的硕士研究生，对贵公司的数据分析实习生岗位非常感兴趣...",
            "attachments": [{"id": "demo_att_003", "filename": "王五_数据分析_求职简历.pdf", "mime_type": "application/pdf", "size": 155000}]
        },
        {
            "id": "demo_msg_004",
            "subject": "赵六 — 2027届秋招全栈工程师求职",
            "from": "zhaoliu@example.com",
            "date": "2026-07-22T09:30:00",
            "snippet": "您好，我是一名软件工程专业的学生，精通前后端技术栈，希望加入贵公司的研发团队...",
            "attachments": [{"id": "demo_att_004", "filename": "赵���_全栈工程师_简历.pdf", "mime_type": "application/pdf", "size": 128000}]
        },
        {
            "id": "demo_msg_005",
            "subject": "实习申请 — 孙七 AI算法工程师（2027届秋招）",
            "from": "sunqi@example.com",
            "date": "2026-07-20T11:45:00",
            "snippet": "我是人工智能专业的研究生，有多篇顶会论文和丰富的实习经验，期待加入贵公司的AI团队...",
            "attachments": [{"id": "demo_att_005", "filename": "孙七_AI算法_实习简历.docx", "mime_type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "size": 111000}]
        }
    ]

    demo_resume_texts = {
        "demo_msg_001": """张三\n手机: 138-0000-0001 | 邮箱: zhangsan@example.com | GitHub: github.com/zhangsan\n\n教育背景\nXX大学 计算机科学与技术 本科 2024-2027 | GPA: 3.8/4.0\n\n技能\n- 编程语言: JavaScript, TypeScript, Python, HTML5, CSS3\n- 前端框架: React, Vue.js, Next.js, Tailwind CSS, Webpack\n- 后端技术: Node.js, Express, MySQL, MongoDB\n- 工具: Git, Docker, Figma, VS Code\n\n实习经历\nABC科技有限公司 — 前端开发实习生 (2025.06 - 2025.09)\n- 使用 React + TypeScript 参与公司核心管理后台开发\n- 优化页面加载性能，首屏渲染时间降低 40%\n- 与后端协作完成 RESTful API 对接\n- 开发可复用组件库，被团队 5 个项目采用\n\n个人项目\n在线协作白板 — React + Canvas + WebSocket\n- 实现多人实时协作绘图功能，支持 50+ 用户同时编辑\n- 使用 WebSocket 实现低延迟同步\n\n获奖经历\n- 全国大学生计算机设计大赛 省级一等奖\n- ACM 校赛银牌""",

        "demo_msg_002": """李四\n电话: 139-0000-0002 | lisi@example.com | 博客: lisi.dev\n\n教育背景\nYY大学 软件工程 硕士 2025-2027 | 本科 2021-2025\n\n专业技能\n- 编程语言: Java, Python, Go, SQL\n- 框架: Spring Boot, Spring Cloud, MyBatis, Django\n- 数据库: MySQL, PostgreSQL, Redis, Elasticsearch\n- 云原生: Docker, Kubernetes, Jenkins, Nginx\n- 其他: 微服务架构, 分布式系统, 消息队列(Kafka)\n\n实习经历\nDEF金融科技 — 后端开发实习生 (2026.01 - 2026.06)\n- 负责支付系统核心模块的开发和维护，日均处理 10万+ 笔交易\n- 基于 Spring Cloud 重构微服务架构，系统可用性提升至 99.9%\n- 设计并实现分布式事务方案，解决跨服务数据一致性问题\n- 编写技术文档和单元测试，代码覆盖率 85%+\n\n开源贡献\n- Apache ShardingSphere 贡献���，提交 3 个 PR 被合并\n- 个人开源项目 (star 500+): 轻量级 API 网关""",

        "demo_msg_003": """王五\n138-0000-0003 | wangwu@example.com\n\n教育经历\nZZ大学 统计学 硕士 2025-2027\nZZ大学 数学与应用数学 本科 2021-2025 | GPA: 3.9/4.0 (专业前 5%)\n\n技术能力\n- 数据分析: Python, R, SQL, Excel\n- 机器学习: Scikit-learn, TensorFlow, XGBoost, LightGBM\n- 可视化: Tableau, Power BI, Matplotlib, ECharts\n- 大数据: Spark, Hadoop, Hive\n- 统计方法: A/B测试, 假设检验, 回归分析, 时间序列\n\n实习经历\nGHI电商平台 — 数据分析实习生 (2025.07 - 2025.12)\n- 搭建用户行为分析数据看板，支持运营团队日常决策\n- 通过 RFM 模型实现用户分层，精准营销转化率提升 25%\n- 利用时间序列模型预测 GMV，准确率达 92%\n- 编写自动化数据报表脚本，工作效率提升 60%\n\n科研经历\n- 发表 SCI 论文 1 篇 (二区，一作): 基于深度学习的销量预测模型\n- 参与国家自然科学基金项目: 大规模时空数据分析方法研究\n\n校园经历\n- 数学建模竞赛 全国二等奖\n- Kaggle 竞赛 Top 5% (2 次)""",

        "demo_msg_004": """赵六\n📞 137-0000-0004 | ✉️ zhaoliu@example.com | 🔗 linkedin.com/in/zhaoliu\n\n教育\nWW大学 软件工程 本科 2024-2027 | GPA 3.7/4.0\n\n技术栈\n前端: React, Vue.js, TypeScript, Next.js, Tailwind CSS, Ant Design\n后端: Node.js (Express/NestJS), Python (Flask/FastAPI), Go (Gin)\n数据库: PostgreSQL, MongoDB, Redis\nDevOps: Docker, AWS (EC2/S3/Lambda), GitHub Actions, Nginx\n移动端: React Native, Flutter (入门)\n\n实习\nJKL 创业公司 — 全栈开发��习生 (2026.02 - 2026.07)\n- 从零搭建公司 SaaS 产品前后端，2 个月上线 MVP\n- 前端使用 React + TypeScript + Ant Design，后端使用 NestJS + PostgreSQL\n- 设计 RESTful API 50+ 个，前后端联调零阻塞\n- 集成微信支付和阿里云 OSS，支持用户付费和企业文件存储\n- 搭建 CI/CD 流水线，实现自动化测试和部署\n\n项目\n校园二手交易平台 — 全栈 (个人项目, 3000+ 用户)\n- React Native 开发跨平台 App，后端使用 Go + Gin\n- 实现实时聊天 (WebSocket)、地理位置搜索、智能推荐\n- 使用 Redis 缓存热点数据，QPS 从 200 提升至 2000\n\n荣誉\n- "互联网+" 大学生创新创业大赛 省赛金奖\n- 蓝桥杯 Java 组 省级一等奖""",

        "demo_msg_005": """孙七\n📧 sunqi@example.com | 📱 136-0000-0005 | scholar.google.com/sunqi\n\n教育背景\nVV大学 人工智能 博士在读 2025-2029\nVV大学 计算机科学 本科 2021-2025 | GPA 3.95/4.0 (专业第 1)\n\n研究领域\n自然语言处理、大语言模型 (LLM)、多模态学习\n\n技能\n- 深度学习框架: PyTorch, TensorFlow, JAX\n- NLP: Transformers, BERT, GPT, LLaMA, Prompt Engineering\n- LLM 训练: 预训练、SFT、RLHF、DPO\n- 分布式训练: DeepSpeed, Megatron-LM, FSDP\n- 编程: Python, C++, CUDA\n- 工程: Docker, Kubernetes, Weights & Biases\n\n学术成果\n- 发表顶会论文 5 篇 (NeurIPS x1, ICML x1, ACL x2, EMNLP x1)\n- 谷歌学术引用 200+ 次\n- 担任 ACL/EMNLP/NAACL 审稿人\n\n实习经历\nMNO AI Lab — 研究实习生 (2025.06 - 2025.12)\n- 参与百亿参数大模型训练，负责数据清洗和评测框架搭建\n- 提出新型注意力机制，在 3 个 NLP 基准上取得 SOTA 结果\n- 设计自动化评估管线，模型迭代周期缩短 50%\n- 研究成果转化为公司核心产品功能\n\n项目\n- OpenLLM-Chinese: 开源中文 LLM 项目 (GitHub 2k+ stars)\n- 多模态文档理解系统: 支持 PDF/图片的端到端信息提取\n\n奖项\n- 国家奖学金 (连续 3 年)\n- CCF 优秀大学生奖\n- ACL 2025 最佳论文提名"""
    }

    meta = load_cache_meta()
    existing_ids = {e["id"] for e in meta.get("emails", [])}
    for email_data in demo_emails:
        eid = email_data["id"]
        if eid in existing_ids:
            continue
        text = demo_resume_texts.get(eid, f"[演示简历] {email_data['subject']}")
        txt_path = get_resume_text_path(eid)
        txt_path.write_text(text, encoding="utf-8")
        meta["emails"].append(email_data)

    meta["last_updated"] = datetime.now().isoformat()
    save_cache_meta(meta)
    print(f"✅ 已生成 {len(demo_emails)} 份演示简历数据")


# ========== 命令行入口 ==========
if __name__ == "__main__":
    import argparse

    # 云端部署时 Render 等平台会设置 PORT 环境变量
    default_port = int(os.environ.get("PORT", 8089))

    parser = argparse.ArgumentParser(description="AI Recruit Agent 邮箱服务器")
    parser.add_argument("--port", type=int, default=default_port, help="服务器端口")
    parser.add_argument("--generate-demo", action="store_true", help="生成演示数据")
    args = parser.parse_args()

    if args.generate_demo:
        generate_demo_cache()
        print("✅ 演示数据已生成")
        sys.exit(0)

    imap_conf = get_imap_config()
    meta = load_cache_meta()
    emails_count = len(meta.get("emails", []))
    cached = sum(1 for e in meta.get("emails", []) for _a in e.get("attachments", [])
                 if get_resume_text_path(e.get("id", "")).exists())

    print(f"🚀 AI Recruit Agent 邮箱服务器")
    print(f"   地址: http://0.0.0.0:{args.port}")
    print(f"   缓存: {emails_count} 封邮件, {cached} 份简历已缓存")
    if imap_conf:
        print(f"   IMAP: {imap_conf['server']} ({imap_conf['email']}) ✓ 已配置")
    else:
        print(f"   IMAP: 未配置（使用缓存/演示模式）")
    print()

    app.run(host="0.0.0.0", port=args.port, debug=False)
