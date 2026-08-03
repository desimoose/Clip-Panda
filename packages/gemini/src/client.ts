import { GoogleGenerativeAI } from "@google/generative-ai";

let client: GoogleGenerativeAI | undefined;

export function getGeminiModel(modelName = "gemini-2.5-pro") {
  if (!client) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY is not set");
    client = new GoogleGenerativeAI(apiKey);
  }
  return client.getGenerativeModel({ model: modelName });
}
