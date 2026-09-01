# -*- coding: utf-8 -*-
"""生成 data/data.js 的构建脚本。

读取 data/nodes/*.json（按 order 排序）、data/poems.json、data/quickref.json，
合并后写入 data/data.js（内容为 window.POETRY_DATA = {...};）。

用法：在工程根目录执行  python data/build_data.py
"""
import glob
import json
import os

BASE = os.path.dirname(os.path.abspath(__file__))


def load_json(path):
    """以 UTF-8 读取并解析 JSON。"""
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def main():
    # 1. 读取全部节点，按 order 升序排列
    node_files = glob.glob(os.path.join(BASE, "nodes", "*.json"))
    nodes = [load_json(fp) for fp in node_files]
    nodes.sort(key=lambda n: n.get("order", 0))

    # 2. 读取例诗库与速查表
    poems = load_json(os.path.join(BASE, "poems.json"))
    quickref = load_json(os.path.join(BASE, "quickref.json"))

    # 3. 合并为统一数据对象（纯数据，无函数）
    data = {
        "nodes": nodes,
        "poems": poems,
        "quickref": quickref,
    }

    # 4. 序列化：ensure_ascii=False 保留中文原样；
    #    U+2028/U+2029 是 JS 的行分隔符，需转义以免破坏字符串
    body = json.dumps(data, ensure_ascii=False, indent=1)
    body = body.replace(" ", "\\u2028").replace(" ", "\\u2029")

    # 5. 写入 data/data.js
    out = os.path.join(BASE, "data.js")
    content = (
        "/* 本文件由 data/build_data.py 自动生成，请勿手改。 */\n"
        "/* 数据来源：data/nodes/*.json、data/poems.json、data/quickref.json */\n"
        "window.POETRY_DATA = " + body + ";\n"
    )
    with open(out, "w", encoding="utf-8") as f:
        f.write(content)

    print("data.js 生成完成")
    print("  节点数：", len(nodes))
    print("  例诗数：", len(poems))
    print("  速查表板块：", ", ".join(quickref.keys()))
    print("  输出文件：", out, os.path.getsize(out), "字节")


if __name__ == "__main__":
    main()
