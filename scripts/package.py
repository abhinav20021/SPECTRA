"""Package the static studio and its single-file offline edition."""
from base64 import b64encode
from pathlib import Path
import re
from zipfile import ZIP_DEFLATED, ZipFile

root = Path(__file__).resolve().parents[1]
dist = root / "dist"
html = (dist / "studio.html").read_text()
font = b64encode((dist / "fonts/inter-latin.woff2").read_bytes()).decode()
style = (dist / "style.css").read_text().replace("fonts/inter-latin.woff2", "data:font/woff2;base64," + font)
html = html.replace('<link rel="stylesheet" href="style.css">', '<style>' + style + '</style>')
html = re.sub(r'<a data-online-only[^>]*>[^<]*</a>', '', html)
scripts = re.findall(r'<script defer src="([\w.-]+\.js)"></script>', html)
html = re.sub(r'<script defer src="[\w.-]+\.js"></script>', "", html)
html = re.sub(r'<a class="offlinedl"[^>]*>[^<]*</a>', "", html)
bundled = "\n".join("<script>" + (dist / name).read_text() + "</script>" for name in scripts)
html = html.replace("</body>", bundled + "\n</body>")
license_text = (dist / "fonts/LICENSE.txt").read_text()
html = html.replace("</html>", "<!-- Bundled font license\n" + license_text + "\n-->\n</html>")
(dist / "visual-task-factory.html").write_text(html)

archive = dist / "visual-task-factory-source.zip"
sources = [root / name for name in ("README.md", "package.json", "package-lock.json", ".gitignore")]
for directory in ("framework", "adapters", "suites", "scripts", "tests", ".github/workflows"):
    sources.extend(sorted((root / directory).rglob("*")))
with ZipFile(archive, "w", ZIP_DEFLATED) as z:
    for p in [*sorted(dist.rglob("*")), *sources]:
        if p.is_file() and p != archive:
            z.write(p, p.relative_to(root))

