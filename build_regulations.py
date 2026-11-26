#!/usr/bin/env python3
"""Chunk PMIST regulation PDFs (extracted text) into structured JSON for RAG."""
import re
import json
import os

BASE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(BASE, "data")
OUT = "/home/z/my-project/src/data/regulations.ts"

DOCS = {
    "ug": {
        "file": os.path.join(DATA, "raw-ug.txt"),
        "title": "B.Tech. Regulations R-2024 (CBCS, Full-Time, 8 Semesters / 6 Semesters Lateral Entry)",
        "short": "B.Tech R-2024 (UG)",
    },
    "pg": {
        "file": os.path.join(DATA, "raw-pg.txt"),
        "title": "PG Regulations R-2024 (CBCS, Common to M.A. / MBA / MCA / M.Sc. / MSW / M.Com. / M.Tech., 4 Semesters)",
        "short": "PG R-2024 (M.Tech / M.Sc. / MBA etc.)",
    },
    "phd": {
        "file": os.path.join(DATA, "raw-phd.txt"),
        "title": "Ph.D. Programme Ordinances and Regulations 2024",
        "short": "Ph.D. Regulations 2024",
    },
}

# heading patterns
RE_SUB = re.compile(r"^R\.?\s?(\d+(?:\.\d+)+)\.?\s+(.*)$")
RE_TOP = re.compile(r"^R\.?\s?(\d+)\.?\s+(.*)$")
RE_ORD = re.compile(r"^O\.(\d+)\.?\s+(.*)$")
SPECIALS = [
    "ORDINANCES",
    "Ph.D. Regulations - 2024",
    "Formation of Research Advisory Board",
    "The major roles of Research Advisory Board:",
    "Appeal:",
]

MAX_CHARS = 3000
PART_CHARS = 1600


def clean_text(raw: str) -> str:
    # join wrapped lines, keep single spacing
    t = re.sub(r"[ \t]+", " ", raw)
    # join hyphenated wraps: "well- prepared" -> "well-prepared" (only lowercase continuation)
    t = re.sub(r"(\w)- ([a-z])", r"\1-\2", t)
    # normalize curly quotes
    t = t.replace("\u2018", "'").replace("\u2019", "'").replace("\u201c", '"').replace("\u201d", '"')
    # collapse whitespace
    t = re.sub(r"\s+", " ", t).strip()
    return t


def split_parts(text: str) -> list:
    if len(text) <= MAX_CHARS:
        return [text]
    # split into sentences
    sentences = re.split(r"(?<=[.;:])\s+", text)
    parts, cur = [], ""
    for s in sentences:
        if cur and len(cur) + len(s) + 1 > PART_CHARS:
            parts.append(cur.strip())
            cur = s
        else:
            cur = (cur + " " + s).strip()
    if cur:
        parts.append(cur.strip())
    return parts


def is_noise(line: str) -> bool:
    s = line.strip()
    if not s:
        return True
    if re.fullmatch(r"\d{1,3}", s):  # page numbers
        return True
    if s in ("", "\uf0b7", "\u2022"):
        return True
    return False


def parse_doc(doc_id: str, path: str):
    with open(path, encoding="utf-8", errors="ignore") as f:
        lines = [ln.rstrip() for ln in f.readlines()]

    chunks = []
    front = []  # front matter lines
    cur = None  # current chunk dict
    section_title = ""

    def push(clause, heading):
        nonlocal cur
        cur = {"clause": clause, "heading": clean_text(heading), "section": section_title, "lines": []}
        chunks.append(cur)

    for ln in lines:
        if is_noise(ln):
            continue
        s = ln.strip()

        # special phd sections
        matched_special = None
        for sp in SPECIALS:
            if s.startswith(sp):
                matched_special = sp
                break

        m_sub = RE_SUB.match(s)
        m_top = RE_TOP.match(s)
        m_ord = RE_ORD.match(s)

        if matched_special:
            if matched_special == "ORDINANCES":
                push("Ordinances", "ORDINANCES")
            elif matched_special == "Ph.D. Regulations - 2024":
                push("Title", "Ph.D. Regulations - 2024")
            elif matched_special == "Formation of Research Advisory Board":
                push("RAB", "Formation of Research Advisory Board")
                section_title = "Research Advisory Board"
            elif matched_special == "The major roles of Research Advisory Board:":
                push("RAB Roles", "The major roles of Research Advisory Board")
                section_title = "Research Advisory Board"
            elif matched_special == "Appeal:":
                push("Appeal", "Appeal")
            continue

        if m_sub:
            cid, head = m_sub.group(1), m_sub.group(2)
            push("R" + cid, head)
            continue
        if m_top:
            cid, head = m_top.group(1), m_top.group(2)
            # top-level: becomes running section title too
            if head and head.upper() == head and len(head) > 4:
                section_title = f"R{cid}. {head}"
            push("R" + cid, head)
            continue
        if m_ord:
            cid, head = "O." + m_ord.group(1), m_ord.group(2)
            push(cid, head)
            continue

        # normal content line
        if cur is None:
            front.append(s)
        else:
            cur["lines"].append(s)

    out = []
    # front matter chunk
    fm = clean_text(" ".join(front))
    if len(fm) > 80:
        out.append({
            "doc": doc_id, "clause": "Preamble", "heading": "Institute Profile: Vision, Mission, Quality Policy, Objectives, Motto",
            "section": "Preamble", "text": fm[:4000],
        })

    for c in chunks:
        body = clean_text(" ".join(c["lines"]))
        full = (c["heading"] + " " + body).strip() if body else c["heading"]
        parts = split_parts(full)
        for i, p in enumerate(parts):
            out.append({
                "doc": doc_id,
                "clause": c["clause"] if len(parts) == 1 else f"{c['clause']} (part {i+1})",
                "heading": c["heading"][:160],
                "section": c["section"],
                "text": p,
            })
    return out


def main():
    all_chunks = []
    stats = {}
    for doc_id, meta in DOCS.items():
        ch = parse_doc(doc_id, meta["file"])
        all_chunks.extend(ch)
        stats[doc_id] = len(ch)

    for i, c in enumerate(all_chunks):
        c["id"] = i + 1
        # reorder keys
    all_chunks = [{"id": c["id"], "doc": c["doc"], "clause": c["clause"], "heading": c["heading"], "section": c["section"], "text": c["text"]} for c in all_chunks]

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        f.write("// AUTO-GENERATED by scripts/build_regulations.py — do not edit by hand\n")
        f.write("// Source: PMIST B.Tech R-2024, PG R-2024, Ph.D 2024 regulation PDFs\n\n")
        f.write("export type RegDocId = 'ug' | 'pg' | 'phd';\n\n")
        f.write("export interface RegChunk {\n  id: number;\n  doc: RegDocId;\n  clause: string;\n  heading: string;\n  section: string;\n  text: string;\n}\n\n")
        f.write("export const DOC_META: Record<RegDocId, { title: string; short: string }> = ")
        f.write(json.dumps({k: {"title": v["title"], "short": v["short"]} for k, v in DOCS.items()}, ensure_ascii=False, indent=2))
        f.write(";\n\n")
        f.write("export const REG_CHUNKS: RegChunk[] = [\n")
        for c in all_chunks:
            f.write("  " + json.dumps(c, ensure_ascii=False) + ",\n")
        f.write("];\n")

    total = len(all_chunks)
    print("stats:", stats, "total:", total)
    print("out:", OUT, os.path.getsize(OUT), "bytes")


if __name__ == "__main__":
    main()
