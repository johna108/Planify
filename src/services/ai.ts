import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export type ExtractedTask = {
  id: string;
  title: string;
  description: string;
  priority: "High" | "Medium" | "Low";
  preferredStart?: string;
  deadline?: string;
  estimatedDurationMinutes: number;
};

export type ExtractedData = {
  summary: {
    text: string;
    keyInsights: string[];
  };
  tasks: Omit<ExtractedTask, "id">[];
};

export type TimeContext = {
  utcIso: string;
  localIso: string;
  timezone: string;
  utcOffset: string;
};

export async function processInput(input: string, timeContext: TimeContext): Promise<ExtractedData> {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Current time context:
- Local datetime: ${timeContext.localIso}
- Timezone: ${timeContext.timezone} (UTC${timeContext.utcOffset})
- UTC datetime: ${timeContext.utcIso}

Extract tasks, deadlines, preferred start times, and a summary from the user input.

Rules:
1) Treat the local datetime/timezone above as the source of truth.
2) If a task doesn't have explicit duration, estimate reasonably (30-60 mins).
3) If user specifies explicit start time (e.g., "at 5 PM", "tomorrow 10:30", "from 2 to 3"), put it in preferredStart as ISO 8601 including timezone offset.
4) If a deadline is mentioned, convert to ISO 8601 in deadline including timezone offset.
5) For ambiguous hour-only phrasing like "at 7" without am/pm, interpret as the next sensible upcoming local time, preferring evening for typical reminder/call language.

Input:
${input}`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          summary: {
            type: Type.OBJECT,
            properties: {
              text: { type: Type.STRING, description: "A concise summary of the input" },
              keyInsights: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "Key actionable points or insights"
              }
            },
            required: ["text", "keyInsights"]
          },
          tasks: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING, description: "Short, actionable title" },
                description: { type: Type.STRING, description: "Details or context" },
                priority: {
                  type: Type.STRING,
                  enum: ["High", "Medium", "Low"],
                  description: "Priority based on urgency and importance"
                },
                preferredStart: {
                  type: Type.STRING,
                  description: "ISO 8601 date string when user specifies an explicit start time"
                },
                deadline: {
                  type: Type.STRING,
                  description: "ISO 8601 date string if a deadline is mentioned or implied"
                },
                estimatedDurationMinutes: {
                  type: Type.NUMBER,
                  description: "Estimated duration in minutes (default to 30 if unknown)"
                }
              },
              required: ["title", "description", "priority", "estimatedDurationMinutes"]
            }
          }
        },
        required: ["summary", "tasks"]
      }
    }
  });

  if (!response.text) {
    throw new Error("Failed to extract data");
  }

  return JSON.parse(response.text) as ExtractedData;
}
