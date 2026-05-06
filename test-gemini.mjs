import { GoogleGenAI } from "@google/genai";
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
async function run() {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-1.5-flash',
      contents: 'hello',
    });
    console.log(response.text);
  } catch (e) {
    console.error("2.5 Failed:", e.message);
    try {
      const resp2 = await ai.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: 'hello',
      });
      console.log("2.0 Success:", resp2.text);
    } catch(e2) {
      console.error("2.0 Failed:", e2.message);
    }
  }
}
run();
