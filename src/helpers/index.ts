import { GoogleGenerativeAI, } from "@google/generative-ai";


const getGeminiApiKey = () => {
    // It's highly recommended to use environment variables for your API key
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    if (!GEMINI_API_KEY) {
        throw new Error("GEMINI_API_KEY environment variable not set.");
    }
    return GEMINI_API_KEY;
}

export const genAI = new GoogleGenerativeAI(getGeminiApiKey());

export const JSONModel = genAI.getGenerativeModel({
    model: "gemini-1.5-flash", // Or any other suitable model
    generationConfig: {
        // Ensure the output is JSON
        responseMimeType: "application/json",
    }
});