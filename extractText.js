import Tesseract from "tesseract.js";
import pdfParse from "pdf-parse";
import mammoth from "mammoth";

export const extractText = async (file) => {
  const fileExt = file.mimetype.split("/")[1];

  try {
    if (["jpg", "jpeg", "png"].includes(fileExt)) {
      const { data: { text } } = await Tesseract.recognize(file.buffer, "eng");
      return text.trim();
    }
    if (fileExt === "pdf") {
      const data = await pdfParse(file.buffer);
      return data.text.trim();
    }
    if (["doc", "docx"].includes(fileExt)) {
      const result = await mammoth.extractRawText({ buffer: file.buffer });
      return result.value.trim();
    }
    if (fileExt === "plain") { // For .txt files
      return file.buffer.toString("utf-8").trim();
    }

    return null;
  } catch (error) {
    console.error("❌ Error extracting text:", error);
    return null;
  }
};