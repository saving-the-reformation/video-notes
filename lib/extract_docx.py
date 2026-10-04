"""Extract ordinary paragraph text from a Google Docs or Word .docx export."""

import base64
import io
import json
import sys
import zipfile
import xml.etree.ElementTree as ET

WORD = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"


def extract_docx(data: bytes) -> str:
    with zipfile.ZipFile(io.BytesIO(data)) as package:
        info = package.getinfo("word/document.xml")
        if info.file_size > 2_000_000:
            raise ValueError("Document text is too large.")
        root = ET.fromstring(package.read(info))
    lines = []
    for paragraph in root.iter(WORD + "p"):
        parts = []
        for item in paragraph.iter():
            if item.tag == WORD + "t" and item.text:
                parts.append(item.text)
            elif item.tag == WORD + "tab":
                parts.append("\t")
            elif item.tag == WORD + "br":
                parts.append("\n")
        if parts:
            lines.append("".join(parts))
    return "\n".join(lines)


if __name__ == "__main__":
    try:
        request = json.load(sys.stdin)
        data = base64.b64decode(request["content"], validate=True)
        if len(data) > 2_000_000:
            raise ValueError("Document file is too large.")
        text = extract_docx(data)
        if not text.strip():
            raise ValueError("No text was found in the document.")
        print(json.dumps({"text": text}))
    except (KeyError, ValueError, zipfile.BadZipFile, ET.ParseError) as error:
        print(json.dumps({"error": str(error)}))
        sys.exit(1)
