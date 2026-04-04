const express = require("express");
const { PDFDocument } = require("pdf-lib");
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
      stamp_width  = 70,
      stamp_height = 30,
    } = req.body;

    if (!pdf)              return res.status(400).json({ error: "Missing 'pdf'" });
    if (!stamp)            return res.status(400).json({ error: "Missing 'stamp'" });
    if (x_percent == null) return res.status(400).json({ error: "Missing x_percent" });
    if (y_percent == null) return res.status(400).json({ error: "Missing y_percent" });

    console.log(`→ Stamping at X=${x_percent}%, Y=${y_percent}%`);

    const pdfBytes   = Buffer.from(pdf,   "base64");
    const stampBytes = Buffer.from(stamp, "base64");

    const pdfDoc = await PDFDocument.load(pdfBytes);
    const pages  = pdfDoc.getPages();

    const jimpImg  = await Jimp.read(stampBytes);
    const pngBytes = await jimpImg.getBufferAsync(Jimp.MIME_PNG);
    const pngImage = await pdfDoc.embedPng(pngBytes);

    for (const page of pages) {
      const { width, height } = page.getSize();

      // pdf-lib origin = bottom-left, Y goes UP
      // x_percent: 0=left, 100=right
      // y_percent: 0=bottom, 100=top
      const cx = (x_percent / 100) * width;
      const cy = (y_percent / 100) * height;

      const x = cx - stamp_width  / 2;
      const y = cy - stamp_height / 2;

      console.log(`  Page ${page.ref}: ${width.toFixed(0)}x${height.toFixed(0)}pt → stamp at (${x.toFixed(1)}, ${y.toFixed(1)})`);

      page.drawImage(pngImage, {
        x, y,
        width:  stamp_width,
        height: stamp_height,
      });
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
