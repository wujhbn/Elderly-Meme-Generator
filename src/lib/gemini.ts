import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function generateGreetingText(timeOfDay: string, mode: string) {
  let modePrompt = "";
  switch(mode) {
    case 'taiwanese': modePrompt = "使用台灣長輩常用的台語問候（例如：呷飽未、身體勇健、平安順序、天冷多穿衣），要充滿在地感。"; break;
    case 'buddhist': modePrompt = "加入佛教用語（例如：阿彌陀佛、平安喜樂、善哉、祈願）。"; break;
    case 'temple': modePrompt = "加入台灣宮廟拜拜用語（例如：媽祖保庇、王爺保庇、萬事如意、心誠則靈）。"; break;
    case 'holiday': modePrompt = "假如今天是過節，請生成通用的過節祝福語，要非常喜氣。"; break;
    case 'health': modePrompt = "極度強調健康養生的重要性，鼓勵長輩多運動、開心過每一天。"; break;
    case 'positive': modePrompt = "充滿人生智慧與正能量的勵志短句（例如：人老心不老、快樂就是最大的財富）。"; break;
    default: modePrompt = "標準的台灣 LINE 長輩圖風格，溫暖、禮貌、具有祝福意味。";
  }

  const prompt = `請為台灣長輩圖生成一句問候語。目前的時段是「${timeOfDay}」。
風格要求：
- ${modePrompt}
- 像台灣 LINE 長輩群組會收到的圖片上面的文字。
- 短小精悍，好閱讀，字數總共不要太多（大約 1 到 2 個短句，總字數 10-25 字內）。
- 偶爾加入適合的 Emoji（如 ☀️, 🌙, 🌸, ☕, 🙏）。
- 每次生成請盡量隨機，不要都一樣。

請直接回覆這句話就好，不要有任何其他解釋或引號。回覆如果有兩句可以用換行分隔。`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-lite",
      contents: prompt,
      config: {
        temperature: 0.9,
      }
    });
    return response.text?.trim() || "早安～ 祝您平安順心 \n的天天開心！";
  } catch (e) {
    console.error(e);
    return "早安～ 願您天天都有好心情 🙏"; // Fallback
  }
}

export async function editImageToGhibli(base64ImageStr: string) {
  const match = base64ImageStr.match(/^data:(image\/[A-Za-z-+\/]+);base64,(.+)$/);
  if (!match) {
    throw new Error("Invalid image format");
  }
  const mimeType = match[1];
  const base64Data = match[2];

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: {
      parts: [
        {
          inlineData: {
            data: base64Data,
            mimeType: mimeType,
          },
        },
        {
          text: 'transform this image into a beautiful Studio Ghibli style 2D anime illustration. Features: warm cozy healing colors, soft glowing bright sunlight, happiness atmosphere, beautiful painterly anime backgrounds. Strictly keep the original composition and subjects, just apply the 2D anime style.',
        },
      ],
    },
  });

  for (const part of response.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData) {
      return `data:${part.inlineData.mimeType || 'image/jpeg'};base64,${part.inlineData.data}`;
    }
  }
  
  throw new Error("Failed to generate image.");
}
