#!/usr/bin/env python3
"""
AI Recruit Agent — 邮箱简历导入服务器

支持两种协议：
1. IMAP — Outlook/Gmail/QQ/163 等允许 IMAP 的邮箱
2. POP3 — 公司内网邮箱（部分公司 IT 不允许 IMAP，只允许 POP3）

REST API:
  GET  /api/email-config       — 查看邮箱配置状态
  POST /api/email-config       — 保存邮箱配置（协议/服务器/账号/授权码）
  DELETE /api/email-config     — 删除邮箱配置
  GET  /api/search-emails      — 搜索邮箱简历（自动选择协议或缓存模式）
  POST /api/download-resume/<id> — 下载并解析单封邮件的简历附件
  GET  /api/resume-text/<id>   — 获取简历文本
  POST /api/batch-import       — 批量导入简历到 Dashboard
  GET  /api/cache-status       — 查看缓存状态
  POST /api/clear-cache        — 清理缓存
"""

import os
import sys
import json
import time
import socket
import poplib
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

# 常见邮箱预设（同时支持 IMAP 和 POP3）
# 协议优先级：POP3（SMTP/POP3 大多数公司放行，IMAP 经常被封）
EMAIL_PRESETS = {
    "outlook": {
        "name": "Outlook / Hotmail / Live",
        "imap": {"server": "outlook.office365.com", "port": 993},
        "pop3": {"server": "outlook.office365.com", "port": 995},
    },
    "gmail": {
        "name": "Gmail",
        "imap": {"server": "imap.gmail.com", "port": 993},
        "pop3": {"server": "pop.gmail.com", "port": 995},
    },
    "qq": {
        "name": "QQ邮箱",
        "imap": {"server": "imap.qq.com", "port": 993},
        "pop3": {"server": "pop.qq.com", "port": 995},
    },
    "163": {
        "name": "163邮箱",
        "imap": {"server": "imap.163.com", "port": 993},
        "pop3": {"server": "pop.163.com", "port": 995},
    },
    "126": {
        "name": "126邮箱",
        "imap": {"server": "imap.126.com", "port": 993},
        "pop3": {"server": "pop.126.com", "port": 995},
    },
    "sina": {
        "name": "新浪邮箱",
        "imap": {"server": "imap.sina.com", "port": 993},
        "pop3": {"server": "pop.sina.com", "port": 995},
    },
    "sohu": {
        "name": "搜狐邮箱",
        "imap": {"server": "imap.sohu.com", "port": 993},
        "pop3": {"server": "pop.sohu.com", "port": 995},
    },
    "139": {
        "name": "139邮箱 (移动)",
        "imap": {"server": "imap.139.com", "port": 993},
        "pop3": {"server": "pop.139.com", "port": 995},
    },
    # 公司内网邮箱预设（IT 通知：发信SMTP 25 端口，收信POP3 110 端口）
    "gjzq": {
        "name": "国金证券邮箱（POP3 明文 110，不支持 IMAP）",
        "imap": None,
        "pop3": {"server": "email.gjzq.com.cn", "port": 110, "ssl": False},
    },
    "corp_pop3_110": {
        "name": "公司邮箱（POP3 110 明文，常见于内网）",
        "imap": None,
        "pop3": {"server": "", "port": 110, "ssl": False},
    },
    "corp_pop3_995": {
        "name": "公司邮箱（POP3 995 SSL）",
        "imap": None,
        "pop3": {"server": "", "port": 995, "ssl": True},
    },
}

app = Flask(__name__)


# ========== 邮箱配置管理 ==========
def load_email_config() -> dict:
    if CONFIG_FILE.exists():
        try:
            return json.loads(CONFIG_FILE.read_text(encoding="utf-8"))
        except Exception:
            return {}
    return {}


def save_email_config(config: dict):
    CONFIG_FILE.write_text(json.dumps(config, ensure_ascii=False, indent=2), encoding="utf-8")


def delete_email_config():
    if CONFIG_FILE.exists():
        CONFIG_FILE.unlink()


def get_email_config() -> dict | None:
    """获取完整邮箱配置（包含协议/服务器/账号/密码）"""
    config = load_email_config()
    if not config.get("email") or not config.get("password"):
        return None
    protocol = config.get("protocol", "pop3").lower()
    preset_key = config.get("preset", "")

    server = ""
    port = 0
    use_ssl = True

    if preset_key in EMAIL_PRESETS:
        preset = EMAIL_PRESETS[preset_key]
        proto_conf = preset.get(protocol)
        if proto_conf:
            server = config.get("server") or proto_conf["server"]
            port = config.get("port") or proto_conf["port"]
            use_ssl = proto_conf.get("ssl", True)
        else:
            # 该预设不支持该协议
            return None
    elif config.get("server"):
        server = config["server"]
        port = config.get("port", 110 if protocol == "pop3" else 993)
        use_ssl = config.get("ssl", port in (995, 993))

    return {
        "protocol": protocol,
        "server": server,
        "port": port,
        "email": config.get("email", ""),
        "password": config.get("password", ""),
        "ssl": use_ssl,
    }


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
        try:
            return json.loads(meta_path.read_text(encoding="utf-8"))
        except Exception:
            return {"emails": [], "resumes": [], "last_updated": None}
    return {"emails": [], "resumes": [], "last_updated": None}


def save_cache_meta(meta: dict):
    meta_path = get_cache_meta_path()
    meta_path.write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")


def get_resume_text_path(email_id: str) -> Path:
    return CACHE_DIR / f"resume_{email_id}.txt"


# ========== 通用工具 ==========
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
    if not addr_str:
        return ""
    addr_str = decode_email_header(addr_str)
    match = re.search(r'<(.+?)>', addr_str)
    if match:
        return match.group(1)
    return addr_str.strip()


def is_resume_attachment(filename: str, mime_type: str) -> bool:
    filename_lower = filename.lower()
    resume_exts = [".pdf", ".doc", ".docx", ".txt"]
    if any(filename_lower.endswith(ext) for ext in resume_exts):
        return True
    resume_mimes = [
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "text/plain",
    ]
    if mime_type in resume_mimes:
        return True
    return False


def text_contains_keyword(text: str, keywords: list[str]) -> bool:
    """检查文本是否包含任一关键词（不区分大小写）"""
    if not text:
        return False
    text_lower = text.lower()
    for kw in keywords:
        if kw.lower() in text_lower:
            return True
    return False


# ========== IMAP 实现 ==========
def _connect_imap(cfg: dict):
    """连接并登录 IMAP，返回连接对象"""
    if cfg.get("ssl", True):
        context = ssl.create_default_context()
        conn = imaplib.IMAP4_SSL(cfg["server"], cfg["port"], ssl_context=context, timeout=30)
    else:
        conn = imaplib.IMAP4(cfg["server"], cfg["port"], timeout=30)
    conn.login(cfg["email"], cfg["password"])
    conn.select("INBOX", readonly=True)
    return conn


def _parse_email_message(msg_bytes: bytes) -> dict:
    """从邮件字节解析出 subject/from/date/snippet/attachments"""
    full_msg = email.message_from_bytes(msg_bytes)
    subject = decode_email_header(full_msg.get("Subject", "(无主题)"))
    from_addr = decode_email_address(full_msg.get("From", ""))
    date_str = full_msg.get("Date", "")
    try:
        date_obj = parsedate_to_datetime(date_str)
        date_iso = date_obj.isoformat()
    except Exception:
        date_iso = date_str

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
                if snippet:
                    break
            elif content_type == "text/html" and not snippet:
                try:
                    payload = part.get_payload(decode=True)
                    if payload:
                        charset = part.get_content_charset() or "utf-8"
                        html_text = payload.decode(charset, errors="replace")
                        snippet = re.sub(r'<[^>]+>', ' ', html_text).strip()[:300]
                except Exception:
                    pass
    else:
        try:
            payload = full_msg.get_payload(decode=True)
            if payload:
                charset = full_msg.get_content_charset() or "utf-8"
                snippet = payload.decode(charset, errors="replace")[:300]
        except Exception:
            pass

    # 查找附件
    attachments = []
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

    return {
        "subject": subject,
        "from": from_addr,
        "date": date_iso,
        "snippet": snippet[:200] if snippet else "",
        "attachments": attachments,
    }


def search_emails_via_imap(keywords: list[str], max_results: int = 50) -> dict:
    cfg = get_email_config()
    if not cfg or cfg["protocol"] != "imap":
        return {"success": False, "error": "未配置 IMAP 邮箱", "emails": [], "total": 0}

    try:
        conn = _connect_imap(cfg)
        try:
            # 搜索邮件
            all_msg_ids = set()
            for kw in keywords:
                for field in ["SUBJECT", "BODY"]:
                    try:
                        search_criteria = f'({field} "{kw}")'
                        status, data = conn.search(None, "CHARSET", "UTF-8", search_criteria)
                        if status == "OK" and data[0]:
                            ids = data[0].split()
                            all_msg_ids.update(id.decode() for id in ids)
                    except Exception:
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
                    "message": "IMAP 收件箱中未找到匹配关键词的邮件",
                    "searched_keywords": keywords,
                    "source": "imap",
                }

            sorted_ids = sorted(all_msg_ids, key=int, reverse=True)[:max_results]
            emails = []
            for msg_id in sorted_ids:
                try:
                    status, msg_data = conn.fetch(msg_id.encode(), "(RFC822)")
                    if status != "OK" or not msg_data[0]:
                        continue
                    info = _parse_email_message(msg_data[0][1])
                    emails.append({
                        "id": f"imap_{msg_id.decode() if isinstance(msg_id, bytes) else msg_id}",
                        **info,
                        "has_attachments": len(info["attachments"]) > 0,
                    })
                except Exception as e:
                    print(f"IMAP 解析邮件 {msg_id} 出错: {e}", file=sys.stderr)
                    continue

            conn.close()
            conn.logout()
            return {
                "success": True,
                "emails": emails,
                "total": len(emails),
                "from_cache": False,
                "source": "imap",
                "searched_keywords": keywords,
            }
        except Exception:
            try:
                conn.close()
                conn.logout()
            except Exception:
                pass
            raise
    except imaplib.IMAP4.error as e:
        return {"success": False, "error": f"IMAP 登录失败: {e}（检查邮箱地址和授权码）", "emails": [], "total": 0}
    except Exception as e:
        return {"success": False, "error": f"IMAP 连接失败: {e}", "emails": [], "total": 0}


def download_attachment_via_imap(email_id: str, attachment_filename: str) -> str | None:
    cfg = get_email_config()
    if not cfg or cfg["protocol"] != "imap":
        return None
    msg_id = email_id.replace("imap_", "")
    try:
        conn = _connect_imap(cfg)
        status, data = conn.fetch(msg_id.encode(), "(RFC822)")
        if status != "OK" or not data[0]:
            conn.close()
            conn.logout()
            return None
        full_msg = email.message_from_bytes(data[0][1])
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
            safe_name = _safe_filename(filename)
            att_path = CACHE_DIR / f"att_{email_id}_{safe_name}"
            att_path.write_bytes(payload)
            text = extract_resume_text(att_path)
            conn.close()
            conn.logout()
            return text
        conn.close()
        conn.logout()
        return None
    except Exception as e:
        print(f"IMAP 下载附件出错: {e}", file=sys.stderr)
        return None


# ========== POP3 实现 ==========
def _connect_pop3(cfg: dict):
    """连接并登录 POP3，返回 (conn, total_count)

    注意：不调用 getwelcome() — CoreMail 等内网服务器对此敏感，
    二次读取 banner 会触发 Protocol error。
    """
    if cfg.get("ssl", True):
        context = ssl.create_default_context()
        context.check_hostname = False
        context.verify_mode = ssl.CERT_NONE
        conn = poplib.POP3_SSL(cfg["server"], cfg["port"], context=context, timeout=30)
    else:
        conn = poplib.POP3(cfg["server"], cfg["port"], timeout=30)
    # 不调用 conn.getwelcome() — poplib 构造函数已自动读取 banner
    conn.user(cfg["email"])
    conn.pass_(cfg["password"])
    stat = conn.stat()
    return conn, stat[0]


def _safe_filename(filename: str) -> str:
    """生成安全的文件名"""
    import hashlib
    return hashlib.md5(filename.encode()).hexdigest()[:8] + "_" + re.sub(r'[\\/:*?"<>|]', '_', filename)


def search_emails_via_pop3(keywords: list[str], max_results: int = 50) -> dict:
    """
    通过 POP3 搜索邮箱中的简历邮件。
    POP3 没有服务器端搜索，必须拉取所有邮件头在本地过滤。
    """
    cfg = get_email_config()
    if not cfg or cfg["protocol"] != "pop3":
        return {"success": False, "error": "未配置 POP3 邮箱", "emails": [], "total": 0}

    try:
        conn, total = _connect_pop3(cfg)
    except poplib.error_proto as e:
        return {"success": False, "error": f"POP3 登录失败: {e}（检查邮箱地址和授权码/密码）", "emails": [], "total": 0}
    except socket.timeout:
        return {"success": False, "error": f"连接 {cfg['server']}:{cfg['port']} 超时（检查服务器地址/端口/网络）", "emails": [], "total": 0}
    except ssl.SSLError as e:
        return {"success": False, "error": f"SSL 错误: {e}（如为内网自签证书，可尝试明文 POP3 110 端口）", "emails": [], "total": 0}
    except OSError as e:
        return {"success": False, "error": f"网络错误: {e}（检查服务器地址和端口）", "emails": [], "total": 0}
    except Exception as e:
        return {"success": False, "error": f"POP3 连接失败: {e}", "emails": [], "total": 0}

    try:
        # POP3 邮件 ID 从 1 开始，越大越新
        all_ids = list(range(1, total + 1))
        # 只看最近 max_results 封
        if len(all_ids) > max_results:
            all_ids = all_ids[-max_results:]

        # 第一遍：只取邮件 header，用关键词过滤
        matched = []
        for msg_num in all_ids:
            try:
                # POP3 TOP 命令：取邮件 header + 前 N 行正文
                # 先用 TOP 0（只取 header），节省流量
                try:
                    response, lines, size = conn.top(msg_num, 0)
                except poplib.error_proto:
                    # CoreMail 等服务器可能不支持 TOP 0，降级用 RETR 获取完整邮件
                    response, lines, size = conn.retr(msg_num)
                msg_bytes = b"\n".join(lines)
                header_msg = email.message_from_bytes(msg_bytes)
                subject = decode_email_header(header_msg.get("Subject", "(无主题)"))
                from_addr = decode_email_address(header_msg.get("From", ""))
                date_str = header_msg.get("Date", "")
                try:
                    date_obj = parsedate_to_datetime(date_str)
                    date_iso = date_obj.isoformat()
                except Exception:
                    date_iso = date_str

                # 关键词过滤（subject + from）
                combined = f"{subject} {from_addr}"
                if not text_contains_keyword(combined, keywords):
                    continue

                matched.append({
                    "id": f"pop3_{msg_num}",
                    "subject": subject,
                    "from": from_addr,
                    "date": date_iso,
                    "msg_num": msg_num,
                })
            except Exception as e:
                print(f"POP3 解析邮件 #{msg_num} header 出错: {e}", file=sys.stderr)
                continue

        # 第二遍：拉取匹配的完整邮件，提取附件信息
        emails = []
        for m in matched:
            try:
                response, lines, size = conn.retr(m["msg_num"])
                msg_bytes = b"\n".join(lines)
                full_info = _parse_email_message(msg_bytes)
                # 关键词二次过滤（subject + from + snippet）
                combined2 = f"{full_info['subject']} {full_info['from']} {full_info['snippet']}"
                if not text_contains_keyword(combined2, keywords):
                    continue
                emails.append({
                    "id": m["id"],
                    **full_info,
                    "has_attachments": len(full_info["attachments"]) > 0,
                })
            except Exception as e:
                print(f"POP3 拉取邮件 #{m['msg_num']} body 出错: {e}", file=sys.stderr)
                # 仍然加入，但标记没有附件
                emails.append({
                    "id": m["id"],
                    "subject": m["subject"],
                    "from": m["from"],
                    "date": m["date"],
                    "snippet": "",
                    "attachments": [],
                    "has_attachments": False,
                })

        try:
            conn.quit()
        except Exception:
            pass

        return {
            "success": True,
            "emails": emails,
            "total": len(emails),
            "from_cache": False,
            "source": "pop3",
            "searched_keywords": keywords,
            "inbox_total": total,
        }
    except Exception as e:
        try:
            conn.quit()
        except Exception:
            pass
        return {"success": False, "error": f"POP3 搜索过程出错: {e}", "emails": [], "total": 0}


def download_attachment_via_pop3(email_id: str, attachment_filename: str) -> str | None:
    """通过 POP3 下载指定邮件的附件并解析"""
    cfg = get_email_config()
    if not cfg or cfg["protocol"] != "pop3":
        return None

    msg_num = int(email_id.replace("pop3_", ""))
    try:
        conn, _ = _connect_pop3(cfg)
        try:
            response, lines, size = conn.retr(msg_num)
            msg_bytes = b"\n".join(lines)
            full_msg = email.message_from_bytes(msg_bytes)

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

                safe_name = _safe_filename(filename)
                att_path = CACHE_DIR / f"att_{email_id}_{safe_name}"
                att_path.write_bytes(payload)
                text = extract_resume_text(att_path)
                return text
            return None
        finally:
            try:
                conn.quit()
            except Exception:
                pass
    except Exception as e:
        print(f"POP3 下载附件出错: {e}", file=sys.stderr)
        return None


# ========== API: 邮箱配置 ==========
@app.route("/api/email-config", methods=["GET"])
def get_email_config_api():
    """查看邮箱配置状态（不返回密码）"""
    cfg = get_email_config()
    config = load_email_config()
    # 返回所有协议预设供前端使用
    presets = {}
    for key, val in EMAIL_PRESETS.items():
        presets[key] = {
            "name": val["name"],
            "imap": val.get("imap"),
            "pop3": val.get("pop3"),
        }
    return jsonify({
        "configured": bool(cfg),
        "preset": config.get("preset", ""),
        "protocol": cfg["protocol"] if cfg else "",
        "email": cfg["email"] if cfg else "",
        "server": cfg["server"] if cfg else "",
        "port": cfg["port"] if cfg else 0,
        "ssl": cfg.get("ssl", True) if cfg else True,
        "presets": presets,
    })


@app.route("/api/email-config", methods=["POST"])
def set_email_config():
    """保存邮箱配置"""
    data = request.get_json(silent=True) or {}
    preset = data.get("preset", "").strip().lower()
    protocol = data.get("protocol", "pop3").strip().lower()
    email_addr = data.get("email", "").strip()
    password = data.get("password", "").strip()
    server = data.get("server", "").strip()
    port = data.get("port")
    use_ssl = data.get("ssl", None)

    if protocol not in ("imap", "pop3"):
        return jsonify({"success": False, "error": "协议必须是 imap 或 pop3"}), 400
    if not email_addr:
        return jsonify({"success": False, "error": "请输入邮箱地址"}), 400
    if not password:
        return jsonify({"success": False, "error": "请输入授权码/密码"}), 400

    config = {
        "preset": preset if preset in EMAIL_PRESETS else "",
        "protocol": protocol,
        "email": email_addr,
        "password": password,
    }

    if preset in EMAIL_PRESETS:
        proto_conf = EMAIL_PRESETS[preset].get(protocol)
        if not proto_conf:
            return jsonify({
                "success": False,
                "error": f"「{EMAIL_PRESETS[preset]['name']}」不支持 {protocol.upper()} 协议，请换其他协议或手动配置"
            }), 400
        config["server"] = server or proto_conf["server"]
        config["port"] = port or proto_conf["port"]
        if use_ssl is None:
            use_ssl = proto_conf.get("ssl", True)
    else:
        # 自定义服务器
        if not server:
            return jsonify({"success": False, "error": "请选择邮箱类型或填写服务器地址"}), 400
        config["server"] = server
        if not port:
            return jsonify({"success": False, "error": "请填写端口号"}), 400
        config["port"] = int(port)
        if use_ssl is None:
            use_ssl = int(port) in (993, 995)

    config["ssl"] = bool(use_ssl)
    save_email_config(config)

    # 快速测试连接
    test_result = test_connection()
    if not test_result["success"]:
        # 测试失败但保留配置（用户可能用明文 110 端口测试不通过但实际能用）
        # 不过还是返回错误让用户知道
        return jsonify(test_result), 400
    return jsonify(test_result)


def test_connection() -> dict:
    """测试当前配置的邮箱连接"""
    cfg = get_email_config()
    if not cfg:
        return {"success": False, "error": "未配置邮箱"}

    if cfg["protocol"] == "imap":
        try:
            conn = _connect_imap(cfg)
            status, data = conn.search(None, "ALL")
            total = len(data[0].split()) if status == "OK" and data[0] else 0
            try:
                conn.close()
                conn.logout()
            except Exception:
                pass
            return {
                "success": True,
                "message": f"IMAP 连接成功！收件箱共 {total} 封邮件",
                "total_emails": total,
            }
        except Exception as e:
            return {"success": False, "error": f"IMAP 连接测试失败: {e}"}
    else:
        # POP3
        try:
            conn, total = _connect_pop3(cfg)
            try:
                conn.quit()
            except Exception:
                pass
            return {
                "success": True,
                "message": f"POP3 连接成功！收件箱共 {total} 封邮件",
                "total_emails": total,
            }
        except Exception as e:
            return {"success": False, "error": f"POP3 连接测试失败: {e}"}


@app.route("/api/email-config", methods=["DELETE"])
def remove_email_config():
    delete_email_config()
    return jsonify({"success": True, "message": "邮箱配置已删除"})


@app.route("/api/email-test", methods=["POST"])
def email_test():
    """单独测试连接（不保存配置）"""
    return jsonify(test_connection())


# ========== API: 搜索邮箱简历 ==========
@app.route("/api/search-emails", methods=["GET"])
def search_emails():
    """搜索邮箱中的实习生简历"""
    keywords_str = request.args.get("keywords", ",".join(DEFAULT_KEYWORDS))
    keywords = [kw.strip() for kw in keywords_str.split(",") if kw.strip()]

    cfg = get_email_config()

    if cfg:
        # 有邮箱配置 → 走协议搜索
        if cfg["protocol"] == "imap":
            result = search_emails_via_imap(keywords)
        else:
            result = search_emails_via_pop3(keywords)

        if result["success"]:
            # 缓存搜索结果
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
            return jsonify(result), 502

    # 回退到缓存模式
    meta = load_cache_meta()
    if not meta.get("emails"):
        return jsonify({
            "success": True,
            "total": 0,
            "emails": [],
            "from_cache": False,
            "message": "未配置邮箱，且缓存为空。请先配置邮箱或使用演示数据。",
            "keywords": keywords,
            "status": "no_data",
            "needs_config": True,
        })

    matching = []
    for email_data in meta.get("emails", []):
        subject = email_data.get("subject", "").lower()
        snippet = email_data.get("snippet", "").lower()
        if any(kw.lower() in subject or kw.lower() in snippet for kw in keywords):
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
        "needs_config": True,
    })


# ========== API: 下载并解析单封邮件的简历 ==========
@app.route("/api/download-resume/<email_id>", methods=["POST"])
def download_resume(email_id: str):
    data = request.get_json(silent=True) or {}
    filename = data.get("filename", "")

    cfg = get_email_config()

    if not cfg:
        # 缓存模式
        txt_path = get_resume_text_path(email_id)
        if txt_path.exists():
            return jsonify({
                "success": True,
                "text": txt_path.read_text(encoding="utf-8", errors="replace"),
                "from_cache": True,
            })
        return jsonify({"success": False, "error": "未配置邮箱且缓存中没有该简历"}), 404

    if cfg["protocol"] == "imap":
        text = download_attachment_via_imap(email_id, filename)
    else:
        text = download_attachment_via_pop3(email_id, filename)

    if text:
        txt_path = get_resume_text_path(email_id)
        txt_path.write_text(text, encoding="utf-8")
        return jsonify({"success": True, "text": text, "length": len(text)})
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

    cfg = get_email_config()
    meta = load_cache_meta()
    resumes = []
    skipped = 0

    for email_id in email_ids:
        txt_path = get_resume_text_path(email_id)

        # 缓存不存在则尝试下载
        if not txt_path.exists() and cfg:
            email_info = None
            for e in meta.get("emails", []):
                if e.get("id") == email_id:
                    email_info = e
                    break
            if email_info and email_info.get("attachments"):
                att_filename = email_info["attachments"][0].get("filename", "")
                if cfg["protocol"] == "imap":
                    text = download_attachment_via_imap(email_id, att_filename)
                else:
                    text = download_attachment_via_pop3(email_id, att_filename)
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
            "source": cfg["protocol"] if cfg else "cache",
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

    cfg = get_email_config()
    return jsonify({
        "success": True,
        "emails_total": emails_count,
        "resumes_cached": downloaded,
        "last_updated": meta.get("last_updated"),
        "cache_dir": str(CACHE_DIR),
        "is_empty": emails_count == 0,
        "email_configured": bool(cfg),
        "email_protocol": cfg["protocol"] if cfg else "",
        "email_address": cfg["email"] if cfg else "",
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
    # 不拦截 /api/ 路径
    if filename.startswith("api/"):
        return jsonify({"error": "Not Found"}), 404
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
            "attachments": [{"id": "demo_att_004", "filename": "赵六_全栈工程师_简历.pdf", "mime_type": "application/pdf", "size": 128000}]
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
        "demo_msg_001": """张三
手机: 138-0000-0001 | 邮箱: zhangsan@example.com | GitHub: github.com/zhangsan

教育背景
XX大学 计算机科学与技术 本科 2024-2027 | GPA: 3.8/4.0

技能
- 编程语言: JavaScript, TypeScript, Python, HTML5, CSS3
- 前端框架: React, Vue.js, Next.js, Tailwind CSS, Webpack
- 后端技术: Node.js, Express, MySQL, MongoDB
- 工具: Git, Docker, Figma, VS Code

实习经历
ABC科技有限公司 — 前端开发实习生 (2025.06 - 2025.09)
- 使用 React + TypeScript 参与公司核心管理后台开发
- 优化页面加载性能，首屏渲染时间降低 40%
- 与后端协作完成 RESTful API 对接
- 开发可复用组件库，被团队 5 个项目采用

个人项目
在线协作白板 — React + Canvas + WebSocket
- 实现多人实时协作绘图功能，支持 50+ 用户同时编辑
- 使用 WebSocket 实现低延迟同步

获奖经历
- 全国大学生计算机设计大赛 省级一等奖
- ACM 校赛银牌""",
        "demo_msg_002": """李四
电话: 139-0000-0002 | lisi@example.com | 博客: lisi.dev

教育背景
YY大学 软件工程 硕士 2025-2027 | 本科 2021-2025

专业技能
- 编程语言: Java, Python, Go, SQL
- 框架: Spring Boot, Spring Cloud, MyBatis, Django
- 数据库: MySQL, PostgreSQL, Redis, Elasticsearch
- 云原生: Docker, Kubernetes, Jenkins, Nginx
- 其他: 微服务架构, 分布式系统, 消息队列(Kafka)

实习经历
DEF金融科技 — 后端开发实习生 (2026.01 - 2026.06)
- 负责支付系统核心模块的开发和维护，日均处理 10万+ 笔交易
- 基于 Spring Cloud 重构微服务架构，系统可用性提升至 99.9%
- 设计并实现分布式事务方案，解决跨服务数据一致性问题
- 编写技术文档和单元测试，代码覆盖率 85%+

开源贡献
- Apache ShardingSphere 贡献者，提交 3 个 PR 被合并
- 个人开源项目 (star 500+): 轻量级 API 网关""",
        "demo_msg_003": """王五
138-0000-0003 | wangwu@example.com

教育经历
ZZ大学 统计学 硕士 2025-2027
ZZ大学 数学与应用数学 本科 2021-2025 | GPA: 3.9/4.0 (专业前 5%)

技术能力
- 数据分析: Python, R, SQL, Excel
- 机器学习: Scikit-learn, TensorFlow, XGBoost, LightGBM
- 可视化: Tableau, Power BI, Matplotlib, ECharts
- 大数据: Spark, Hadoop, Hive
- 统计方法: A/B测试, 假设检验, 回归分析, 时间序列

实习经历
GHI电商平台 — 数据分析实习生 (2025.07 - 2025.12)
- 搭建用户行为分析数据看板，支持运营团队日常决策
- 通过 RFM 模型实现用户分层，精准营销转化率提升 25%
- 利用时间序列模型预测 GMV，准确率达 92%
- 编写自动化数据报表脚本，工作效率提升 60%

科研经历
- 发表 SCI 论文 1 篇 (二区，一作): 基于深度学习的销量预测模型
- 参与国家自然科学基金项目: 大规模时空数据分析方法研究

校园经历
- 数学建模竞赛 全国二等奖
- Kaggle 竞赛 Top 5% (2 次)""",
        "demo_msg_004": """赵六
📞 137-0000-0004 | ✉️ zhaoliu@example.com | 🔗 linkedin.com/in/zhaoliu

教育
WW大学 软件工程 本科 2024-2027 | GPA 3.7/4.0

技术栈
前端: React, Vue.js, TypeScript, Next.js, Tailwind CSS, Ant Design
后端: Node.js (Express/NestJS), Python (Flask/FastAPI), Go (Gin)
数据库: PostgreSQL, MongoDB, Redis
DevOps: Docker, AWS (EC2/S3/Lambda), GitHub Actions, Nginx
移动端: React Native, Flutter (入门)

实习
JKL 创业公司 — 全栈开发实习生 (2026.02 - 2026.07)
- 从零搭建公司 SaaS 产品前后端，2 个月上线 MVP
- 前端使用 React + TypeScript + Ant Design，后端使用 NestJS + PostgreSQL
- 设计 RESTful API 50+ 个，前后端联调零阻塞
- 集成微信支付和阿里云 OSS，支持用户付费和企业文件存储
- 搭建 CI/CD 流水线，实现自动化测试和部署

项目
校园二手交易平台 — 全栈 (个人项目, 3000+ 用户)
- React Native 开发跨平台 App，后端使用 Go + Gin
- 实现实时聊天 (WebSocket)、地理位置搜索、智能推荐
- 使用 Redis 缓存热点数据，QPS 从 200 提升至 2000

荣誉
- "互联网+" 大学生创新创业大赛 省赛金奖
- 蓝桥杯 Java 组 省级一等奖""",
        "demo_msg_005": """孙七
📧 sunqi@example.com | 📱 136-0000-0005 | scholar.google.com/sunqi

教育背景
VV大学 人工智能 博士在读 2025-2029
VV大学 计算机科学 本科 2021-2025 | GPA 3.95/4.0 (专业第 1)

研究领域
自然语言处理、大语言模型 (LLM)、多模态学习

技能
- 深度学习框架: PyTorch, TensorFlow, JAX
- NLP: Transformers, BERT, GPT, LLaMA, Prompt Engineering
- LLM 训练: 预训练、SFT、RLHF、DPO
- 分布式训练: DeepSpeed, Megatron-LM, FSDP
- 编程: Python, C++, CUDA
- 工程: Docker, Kubernetes, Weights & Biases

学术成果
- 发表顶会论文 5 篇 (NeurIPS x1, ICML x1, ACL x2, EMNLP x1)
- 谷歌学术引用 200+ 次
- 担任 ACL/EMNLP/NAACL 审稿人

实习经历
MNO AI Lab — 研究实习生 (2025.06 - 2025.12)
- 参与百亿参数大模型训练，负责数据清洗和评测框架搭建
- 提出新型注意力机制，在 3 个 NLP 基准上取得 SOTA 结果
- 设计自动化评估管线，模型迭代周期缩短 50%
- 研究成果转化为公司核心产品功能

项目
- OpenLLM-Chinese: 开源中文 LLM 项目 (GitHub 2k+ stars)
- 多模态文档理解系统: 支持 PDF/图片的端到端信息提取

奖项
- 国家奖学金 (连续 3 年)
- CCF 优秀大学生奖
- ACL 2025 最佳论文提名"""
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


# ========== 启动入口（支持 gunicorn） ==========
# gunicorn 使用: gunicorn server:app --bind 0.0.0.0:$PORT
# 本地运行:    python server.py [--port 8089]


# ========== 命令行入口 ==========
if __name__ == "__main__":
    import argparse

    default_port = int(os.environ.get("PORT", 8089))

    parser = argparse.ArgumentParser(description="AI Recruit Agent 邮箱服务器")
    parser.add_argument("--port", type=int, default=default_port, help="服务器端口")
    parser.add_argument("--generate-demo", action="store_true", help="生成演示数据")
    args = parser.parse_args()

    if args.generate_demo:
        generate_demo_cache()
        print("✅ 演示数据已生成")
        sys.exit(0)

    cfg = get_email_config()
    meta = load_cache_meta()
    emails_count = len(meta.get("emails", []))
    cached = sum(1 for e in meta.get("emails", []) for _a in e.get("attachments", [])
                 if get_resume_text_path(e.get("id", "")).exists())

    print(f"🚀 AI Recruit Agent 邮箱服务器")
    print(f"   地址: http://0.0.0.0:{args.port}")
    print(f"   缓存: {emails_count} 封邮件, {cached} 份简历已缓存")
    if cfg:
        print(f"   邮箱: {cfg['protocol'].upper()} {cfg['server']}:{cfg['port']} ({cfg['email']}) ✓")
    else:
        print(f"   邮箱: 未配置（使用缓存/演示模式）")
    print()

    app.run(host="0.0.0.0", port=args.port, debug=False)
