#!/usr/bin/env python3
"""Regenerate the XLSX test fixtures.

Writes leads-deflate.xlsx (zip deflate) and leads-stored.xlsx (zip stored)
from hand written OOXML, so the parser is tested against a real zip container
without any third party spreadsheet library. Run from the repo root:

    python3 tests/fixtures/make_fixtures.py
"""

import zipfile
from pathlib import Path

HERE = Path(__file__).parent

NS_CT = "http://schemas.openxmlformats.org/package/2006/content-types"
NS_REL = "http://schemas.openxmlformats.org/package/2006/relationships"
NS_SS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"
NS_R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"

CONTENT_TYPES = f"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="{NS_CT}"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/></Types>"""

ROOT_RELS = f"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="{NS_REL}"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>"""

WORKBOOK = f"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="{NS_SS}" xmlns:r="{NS_R}"><sheets><sheet name="Fixture Leads" sheetId="1" r:id="rId1"/></sheets></workbook>"""

WORKBOOK_RELS = f"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="{NS_REL}"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/></Relationships>"""

HEADERS = ["Full Name", "Email", "Title", "Company", "Domain", "Score", "Notes"]

# Shared strings are registered in first-seen order while the sheet is built,
# so indices can never drift from the cell references.
SHARED = []


def esc(text: str) -> str:
    # Built from chr(38) so the entity literals survive any transport mangling.
    amp = chr(38)
    return (text.replace("&", amp + "amp;")
                .replace("<", amp + "lt;")
                .replace(">", amp + "gt;"))


def si(text: str) -> int:
    if text not in SHARED:
        SHARED.append(text)
    return SHARED.index(text)


def cell_s(ref: str, text: str) -> str:
    return f'<c r="{ref}" t="s"><v>{si(text)}</v></c>'


def cell_n(ref: str, value: int) -> str:
    return f'<c r="{ref}"><v>{value}</v></c>'


def build_sheet() -> str:
    rows = []
    # Row 1: header.
    rows.append(
        '<row r="1">'
        + "".join(cell_s(f"{col}1", h) for col, h in zip("ABCDEFG", HEADERS))
        + "</row>"
    )
    # Row 2: every cell, shared strings plus a numeric score.
    rows.append(
        '<row r="2">'
        + cell_s("A2", "Fixture Lead One")
        + cell_s("B2", "lead.one@example.com")
        + cell_s("C2", "VP Operations")
        + cell_s("D2", "Fixture Labs")
        + cell_s("E2", "fixturelabs.example")
        + cell_n("F2", 100)
        + cell_s("G2", 'Said: "call" & =check <now>')
        + "</row>"
    )
    # Row 3: cell D3 omitted entirely (sparse reference), numeric score.
    rows.append(
        '<row r="3">'
        + cell_s("A3", "Fixture Lead Two")
        + cell_s("B3", "lead.two@example.com")
        + cell_s("C3", "CTO")
        + cell_s("E3", "sample-systems.example")
        + cell_n("F3", 91)
        + cell_s("G3", "+follow up @billing")
        + "</row>"
    )
    # Row 4: self closing empty email cell, inline string note, numeric score.
    rows.append(
        '<row r="4">'
        + cell_s("A4", "Fixture Lead Three")
        + '<c r="B4"/>'
        + cell_s("C4", "Head of Data")
        + cell_s("D4", "Example Co")
        + cell_s("E4", "example.com")
        + cell_n("F4", 88)
        + '<c r="G4" t="inlineStr"><is><t>=HYPERLINK("http://evil.example","click")</t></is></c>'
        + "</row>"
    )
    return (
        f'<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
        f'<worksheet xmlns="{NS_SS}"><sheetData>'
        + "".join(rows)
        + "</sheetData></worksheet>"
    )


def shared_strings_xml() -> str:
    items = "".join(f"<si><t>{esc(s)}</t></si>" for s in SHARED)
    return (
        f'<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
        f'<sst xmlns="{NS_SS}" count="{len(SHARED)}" uniqueCount="{len(SHARED)}">'
        + items
        + "</sst>"
    )


def parts() -> dict:
    sheet = build_sheet()
    return {
        "[Content_Types].xml": CONTENT_TYPES,
        "_rels/.rels": ROOT_RELS,
        "xl/workbook.xml": WORKBOOK,
        "xl/_rels/workbook.xml.rels": WORKBOOK_RELS,
        "xl/sharedStrings.xml": shared_strings_xml(),
        "xl/worksheets/sheet1.xml": sheet,
    }


def build(name: str, compression: int) -> None:
    path = HERE / name
    with zipfile.ZipFile(path, "w", compression) as zf:
        for member, data in parts().items():
            zf.writestr(member, data)
    print(f"wrote {path} ({path.stat().st_size} bytes, {len(SHARED)} shared strings)")


if __name__ == "__main__":
    build("leads-deflate.xlsx", zipfile.ZIP_DEFLATED)
    SHARED.clear()
    build("leads-stored.xlsx", zipfile.ZIP_STORED)
