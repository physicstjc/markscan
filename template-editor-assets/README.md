# OMS template editor

Open `../template-editor.html` in a browser. Keep this assets folder beside it. No server or internet connection is required.

The original PDF is embedded in `template-data.js`. With original settings, the download is byte-for-byte the supplied PDF. Changes remove only the text-showing operators in the four editable regions, then draw replacement text with embedded Arial / Arial Narrow fonts. All other source operators, registration marks, bubble positions, page dimensions, and borders are preserved.

Edited text wraps and shrinks within the original region. Overflow and unsupported characters block export. The school heading is white in the source; the checkbox makes an edited heading visible. Drafts are stored under `oms.templateEditor.v1` in local browser storage.

Libraries: pdf-lib 1.17.1 (MIT), @pdf-lib/fontkit 1.1.1 (MIT), PDF.js 3.11.174 (Apache-2.0). Library copyright notices are retained in the vendor files. The PDF.js worker is embedded in template-data.js to support local-file use.
