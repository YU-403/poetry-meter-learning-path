# -*- coding: utf-8 -*-
"""打包脚本：将 CSS / JS / 数据全部内联进 index.html，生成单文件产物。

输出：D:\\Agent\\poetry-meter\\诗词格律学习路径.html
产物为纯前端单文件，file:// 双击即可运行（无任何外部依赖、无 fetch）。

用法：在工程根目录执行  python build.py
"""
import os

BASE = os.path.dirname(os.path.abspath(__file__))


def read(rel):
    """以 UTF-8 读取工程内文件。"""
    with open(os.path.join(BASE, rel), encoding="utf-8") as f:
        return f.read()


def inline_js(code):
    """内联 JS 前做安全转义：防止字符串中出现 </script> 提前结束脚本。"""
    return code.replace("</script", "<\\/script").replace("</SCRIPT", "<\\/SCRIPT")


def main():
    html = read("index.html")
    css = read("css/style.css")
    data_js = read("data/data.js")
    app_js = read("js/app.js")

    # 1. 内联 CSS → <style>
    if '<link rel="stylesheet" href="css/style.css">' in html:
        html = html.replace(
            '<link rel="stylesheet" href="css/style.css">',
            "<style>\n" + css + "\n</style>",
        )
    else:
        raise RuntimeError("index.html 中未找到 CSS 引用，无法内联。")

    # 2. 内联 data.js → <script>
    if '<script src="data/data.js"></script>' in html:
        html = html.replace(
            '<script src="data/data.js"></script>',
            "<script>\n" + inline_js(data_js) + "\n</script>",
        )
    else:
        raise RuntimeError("index.html 中未找到 data.js 引用，无法内联。")

    # 3. 内联 app.js → <script>
    if '<script src="js/app.js"></script>' in html:
        html = html.replace(
            '<script src="js/app.js"></script>',
            "<script>\n" + inline_js(app_js) + "\n</script>",
        )
    else:
        raise RuntimeError("index.html 中未找到 app.js 引用，无法内联。")

    # 4. 校验：产物中不应再残留外部引用
    if 'src="' in html or 'href="' in html:
        raise RuntimeError("产物中仍存在外部引用，打包未完成。")

    out_path = os.path.join(BASE, "诗词格律学习路径.html")
    with open(out_path, "w", encoding="utf-8") as f:
        f.write(html)

    print("单文件打包完成")
    print("  输出：", out_path)
    print("  大小：", os.path.getsize(out_path), "字节")


if __name__ == "__main__":
    main()
