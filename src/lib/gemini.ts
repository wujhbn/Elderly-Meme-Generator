import { GoogleGenAI } from "@google/genai";

let aiInstance: GoogleGenAI | null = null;
let currentKey: string | null = null;

function getAI(): GoogleGenAI {
  const userKey = localStorage.getItem('gemini_api_key');
  const envKey = process.env.GEMINI_API_KEY;
  const keyToUse = userKey || envKey;

  if (!keyToUse) {
    throw new Error("找不到 GEMINI_API_KEY。請點擊上方設定按鈕輸入您的 API 金鑰。");
  }

  // Reuse instance if key hasn't changed
  if (aiInstance && currentKey === keyToUse) {
    return aiInstance;
  }

  currentKey = keyToUse;
  aiInstance = new GoogleGenAI({ apiKey: keyToUse });
  return aiInstance;
}

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
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-lite",
      contents: prompt,
      config: {
        temperature: 0.9,
      }
    });
    return response.text?.trim() || "早安～ 祝您平安順心 \n的天天開心！";
  } catch (e: any) {
    console.error(e);
    if (e.message.includes("GEMINI_API_KEY")) {
      alert(e.message);
    }
    return "早安～ 願您天天都有好心情 🙏"; // Fallback
  }
}

export async function editImageWithStyle(base64ImageStr: string, artStyle: string) {
  const match = base64ImageStr.match(/^data:(image\/[A-Za-z-+\/]+);base64,(.+)$/);
  if (!match) {
    throw new Error("Invalid image format");
  }
  const mimeType = match[1];
  const base64Data = match[2];

  let stylePrompt = "transform this image into a beautiful Studio Ghibli style 2D anime illustration. Features: warm cozy healing colors, soft glowing bright sunlight, happiness atmosphere, beautiful painterly anime backgrounds. Strictly keep the original composition and subjects, just apply the 2D anime style.";
  
  switch(artStyle) {
    case 'watercolor':
      stylePrompt = "transform this image into a soft, beautiful watercolor painting. Features: delicate brush strokes, soft edge blending, vibrant yet translucent colors, slightly textured watercolor paper feel. Strictly keep the original composition and subjects, just apply the watercolor style.";
      break;
    case 'oil_painting':
      stylePrompt = "transform this image into a classic oil painting. Features: thick impasto brushstrokes, rich and deep colors, dramatic lighting (chiaroscuro), canvas texture. Strictly keep the original composition and subjects, just apply the oil painting style.";
      break;
    case 'cyberpunk':
      stylePrompt = "transform this image into a futuristic cyberpunk style. Features: neon lights (pink, cyan, purple), dark atmospheric mood, sci-fi metallic elements, glowing accents. Strictly keep the original composition and subjects, just apply the cyberpunk style.";
      break;
    case 'anime':
      stylePrompt = "transform this image into a high-quality modern Japanese anime style. Features: sharp clean cel shading, bright vivid colors, detailed skies, aesthetic anime lighting. Strictly keep the original composition and subjects, just apply the modern anime style.";
      break;
    case 'ink':
      stylePrompt = "transform this image into a traditional Chinese ink wash painting (Shui-mo). Features: monochromatic or sparse colors, expressive brush strokes, elegant use of negative space, poetic atmosphere. Strictly keep the original composition and subjects, just apply the ink wash printing style.";
      break;
    case '3d_pixar':
      stylePrompt = "transform this image into a 3D Pixar/Disney style CGI render. Features: soft rounded shapes, high-quality subsurface scattering, beautiful cinematic lighting, cute and friendly atmosphere. Strictly keep the original composition and subjects, just apply the 3D animation style.";
      break;
    case 'none':
      stylePrompt = "enhance and beautify this image without changing its core style. Features: better lighting, balanced contrast, vivid and natural colors, high definition.";
      break;
    default:
      // Keep ghibli as default
      break;
  }

  const ai = getAI();
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
          text: stylePrompt,
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
