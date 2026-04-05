const express = require("express");
const { PDFDocument, rgb, StandardFonts } = require("pdf-lib");
const Jimp = require("jimp");
const app = express();
app.use(express.json({ limit: "50mb" }));

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.post("/stamp", async (req, res) => {
  try {
    const {
      pdf,
      stamp,
      x_percent,
      y_percent,
      stamp_width    = 70,
      stamp_height   = 30,
      date_text      = "",
      date_x_percent,
      date_y_percent,
      date_font_size = 10,
    } = req.body;

    if (!pdf)              return res.status(400).json({ error: "Missing 'pdf'" });
    if (!stamp)            return res.status(400).json({ error: "Missing 'stamp'" });
    if (x_percent == null) return res.status(400).json({ error: "Missing x_percent" });
    if (y_percent == null) return res.status(400).json({ error: "Missing y_percent" });

    console.log(`→ Stamping at X=${x_percent}%, Y=${y_percent}%`);
    if (date_text) console.log(`→ Date: "${date_text}" at X=${date_x_percent}%, Y=${date_y_percent}%`);

    const pdfBytes   = Buffer.from(pdf,   "base64");
    const stampBytes = Buffer.from(stamp, "base64");

    const pdfDoc = await PDFDocument.load(pdfBytes);
    const pages  = pdfDoc.getPages();

    // Embed stamp image
    const jimpImg  = await Jimp.read(stampBytes);
    const pngBytes = await jimpImg.getBufferAsync(Jimp.MIME_PNG);
    const pngImage = await pdfDoc.embedPng(pngBytes);

    // Embed font (only if date text is provided)
    const font = date_text
      ? await pdfDoc.embedFont(StandardFonts.Helvetica)
      : null;

    for (const page of pages) {
      const { width, height } = page.getSize();

      // ── 1. Draw stamp image ────────────────────────────────
      const cx     = (x_percent / 100) * width;
      const cy     = (y_percent / 100) * height;
      const stampX = cx - stamp_width  / 2;
      const stampY = cy - stamp_height / 2;

      console.log(`  Page ${page.ref}: ${width.toFixed(0)}x${height.toFixed(0)}pt → stamp at (${stampX.toFixed(1)}, ${stampY.toFixed(1)})`);

      page.drawImage(pngImage, {
        x:      stampX,
        y:      stampY,
        width:  stamp_width,
        height: stamp_height,
      });

      // ── 2. Draw date text above stamp ─────────────────────
      if (date_text && font) {

        // X: use date_x_percent if given, else center on stamp
        const dateX = date_x_percent != null
          ? (date_x_percent / 100) * width
          : cx;

        // Y: use date_y_percent if given, else auto 4pt above stamp top
        const dateY = date_y_percent != null
          ? (date_y_percent / 100) * height
          : stampY + stamp_height + 4;

        // Center text horizontally around dateX
        const textWidth = font.widthOfTextAtSize(date_text, date_font_size);
        const textX     = dateX - textWidth / 2;

        console.log(`  Date "${date_text}" at (${textX.toFixed(1)}, ${dateY.toFixed(1)})`);

        page.drawText(date_text, {
          x:     textX,
          y:     dateY,
          size:  date_font_size,
          font:  font,
          color: rgb(0, 0, 0),
        });
      }
    }

    const stamped = await pdfDoc.save();
    res.json({ pdf: Buffer.from(stamped).toString("base64") });
    console.log("✅ Done");

  } catch (err) {
    console.error("❌ Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Stamp API running on port ${PORT}`);
});
