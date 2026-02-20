
import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export async function processArticle(content: string, url: string = "") {
  const isUrl = content.trim().startsWith('http');
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Analyze the following ${isUrl ? 'URL' : 'text'} from an article. 
    1. Summarize it briefly (max 3 sentences).
    2. Extract 5-10 advanced English vocabulary words (CEFR C1 or C2 level) that are essential for high-level proficiency in AI, Tech, Neuroscience, or Economics.
    3. For each word, provide: pronunciation, Vietnamese meaning, a contextual example from the text, and whether it is C1 or C2.
    
    Source: ${content}`,
    config: {
      tools: isUrl ? [{ googleSearch: {} }] : undefined,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          author: { type: Type.STRING },
          summary: { type: Type.STRING },
          words: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                word: { type: Type.STRING },
                pronunciation: { type: Type.STRING },
                vietnameseMeaning: { type: Type.STRING },
                context: { type: Type.STRING },
                difficulty: { type: Type.STRING, enum: ['C1', 'C2'] }
              },
              required: ['word', 'pronunciation', 'vietnameseMeaning', 'context', 'difficulty']
            }
          }
        },
        required: ['title', 'author', 'summary', 'words']
      }
    }
  });

  const data = JSON.parse(response.text);
  return { ...data, url: isUrl ? content : url };
}

export async function getSuggestedMaterial() {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: "Find 3 recent interesting articles from Morning Brew (morningbrew.com) and 3 from VnExpress International (e.vnexpress.net). Return their titles, a short teaser summary for each, and their direct URLs.",
    config: {
      tools: [{ googleSearch: {} }],
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            summary: { type: Type.STRING },
            url: { type: Type.STRING },
            source: { type: Type.STRING }
          },
          required: ['title', 'summary', 'url', 'source']
        }
      }
    }
  });
  return JSON.parse(response.text);
}

export async function summarizeArticle(content: string) {
  const isUrl = content.trim().startsWith('http');
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Summarize the following ${isUrl ? 'URL' : 'text'} into a clear, bulleted list of 3-5 main points. Focus on the core message and key insights.
    
    Source: ${content}`,
    config: {
      tools: isUrl ? [{ googleSearch: {} }] : undefined,
    }
  });
  return response.text;
}

export async function playPronunciation(text: string) {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: `Say clearly: ${text}` }] }],
      config: {
        responseModalities: ["AUDIO" as any],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Kore' },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (base64Audio) {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      const audioBuffer = await decodeAudioData(decodeBase64(base64Audio), audioContext, 24000, 1);
      const source = audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContext.destination);
      source.start();
    }
  } catch (err) {
    console.error("TTS Error:", err);
  }
}

function decodeBase64(base64: string) {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodeAudioData(data: Uint8Array, ctx: AudioContext, sampleRate: number, numChannels: number): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);
  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}
