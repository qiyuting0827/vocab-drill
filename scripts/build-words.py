#!/usr/bin/env python3
"""从《鲁教版五四制初中英语单词总表》xlsx 生成 words.js。

用法：
    python scripts/build-words.py "路径/单词总表.xlsx"

依赖：openpyxl（pip install openpyxl）
"""
import json
import re
import sys
from pathlib import Path

from openpyxl import load_workbook

BOOKS = [
    ("六上", "6a", "六年级上册"),
    ("六下", "6b", "六年级下册"),
    ("七上", "7a", "七年级上册"),
    ("七下", "7b", "七年级下册"),
    ("八上", "8a", "八年级上册"),
    ("九全", "9", "九年级全一册"),
]

# 一个英文条目里有多种写法时，给出可接受答案；展示仍用原文。
MULTI_ANSWERS = {
    "a lot of / lots of": ["a lot of", "lots of"],
    "make sb's/the bed": ["make sb's bed", "make the bed"],
    "fight against sb / sth": ["fight against sb", "fight against sth"],
    "be home to sb / sth": ["be home to sb", "be home to sth"],
    "be connected with / to": ["be connected with", "be connected to"],
    "cut sth in / into sth": ["cut sth in sth", "cut sth into sth"],
    "along with sb / sth": ["along with sb", "along with sth"],
    "have to do with sb / sth": ["have to do with sb", "have to do with sth"],
    "be supposed to do / be sth": ["be supposed to do", "be supposed to be sth"],
    "make up ground on sb / sth": ["make up ground on sb", "make up ground on sth"],
}

UNIT_RE = re.compile(r"^(.*?)\s*[｜|]\s*共\s*(\d+)\s*个词条")


def unit_id(book_id, name):
    m = re.fullmatch(r"Bridging Unit\s+(\d+)", name)
    if m:
        return f"lj-{book_id}-bu{m.group(1)}"
    m = re.fullmatch(r"Unit\s+(\d+)", name)
    if m:
        return f"lj-{book_id}-u{m.group(1)}"
    raise ValueError(f"无法识别的单元名：{name}")


def parse(path):
    wb = load_workbook(path, data_only=True)
    books = []
    units = []
    seen_slash = set()

    for name, book_id, full in BOOKS:
        if name not in wb.sheetnames:
            raise ValueError(f"缺少工作表：{name}")
        ws = wb[name]
        current = None
        for row in ws.iter_rows(min_row=3, values_only=True):
            a, b, c = (row + (None, None, None))[:3]
            if a is None and b is None and c is None:
                continue
            if isinstance(a, str):
                m = UNIT_RE.match(a.strip())
                if not m:
                    raise ValueError(f"{name}: 无法识别的单元行：{a!r}")
                current = {
                    "id": unit_id(book_id, m.group(1).strip()),
                    "name": m.group(1).strip(),
                    "book": name,
                    "words": [],
                }
                units.append(current)
                continue
            if isinstance(a, (int, float)) and b:
                if current is None:
                    raise ValueError(f"{name}: 单元之前出现词条：{b!r}")
                en = str(b).strip()
                zh = str(c or "").strip()
                if not en or not zh:
                    raise ValueError(f"{name}: 词条缺英文或中文：{a!r} {b!r} {c!r}")
                word = [en, zh]
                if en in MULTI_ANSWERS:
                    word.append(MULTI_ANSWERS[en])
                    seen_slash.add(en)
                elif "/" in en:
                    raise ValueError(f"{name}: 斜杠词条未配置可接受答案：{en!r}")
                current["words"].append(word)
                continue
            raise ValueError(f"{name}: 无法识别的行：{a!r} / {b!r} / {c!r}")
        books.append({"id": book_id, "name": name, "full": full})

    missing = set(MULTI_ANSWERS) - seen_slash
    if missing:
        raise ValueError("以下配置未在表格中出现：" + "、".join(sorted(missing)))
    return books, units


def render(books, units):
    total = sum(len(u["words"]) for u in units)
    head = (
        "/* 鲁教版五四制初中英语单词总表（六上—九全一册）\n"
        f" * 共 {len(units)} 个单元、{total} 个词条，由教材词汇总表 xlsx 生成，请勿手改。\n"
        " * 词条格式：[英文, 中文]；一个词组有多种写法时为 [英文, 中文, [可接受答案...]]。\n"
        " */\n"
        "(function (root, factory) {\n"
        "  if (typeof module === 'object' && module.exports) module.exports = factory();\n"
        "  else root.VocabBank = factory();\n"
        "})(typeof self !== 'undefined' ? self : this, function () {\n"
    )
    body = (
        "  var books = "
        + json.dumps(books, ensure_ascii=False, separators=(",", ":"))
        + ";\n  var units = "
        + json.dumps(units, ensure_ascii=False, separators=(",", ":"))
        + ";\n"
    )
    tail = "  return { books: books, units: units };\n});\n"
    return head + body + tail, total


def main():
    if len(sys.argv) != 2:
        print(__doc__)
        return 1
    path = Path(sys.argv[1])
    out = Path(__file__).resolve().parent.parent / "words.js"
    books, units = parse(path)
    text, total = render(books, units)
    out.write_text(text, encoding="utf-8", newline="\n")
    print(
        f"已生成 {out}：{len(books)} 册、{len(units)} 单元、{total} 词条"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
