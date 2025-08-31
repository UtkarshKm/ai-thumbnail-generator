import {NextResponse} from "next/server";
import type {NextRequest} from "next/server";
import {GoogleGenAI, Modality} from "@google/genai";

export async function POST(req: NextRequest) {
	try {
		const {prompt} = await req.json();
		const ai = new GoogleGenAI({apiKey: process.env.GOOGLE_API_KEY});
		const response = await ai.models.generateContent({
			model: "gemini-2.0-flash-preview-image-generation",
			contents: prompt,
			config: {responseModalities: [Modality.TEXT, Modality.IMAGE]},
		});

		const parts = response.candidates?.[0]?.content?.parts;
		if (parts) {
			for (const part of parts) {
				if (part.inlineData) {
					const dataUrl = `data:image/png;base64,${part.inlineData.data}`;
					return NextResponse.json({data_url: dataUrl});
				}
			}
		}
		return NextResponse.json({error: "No image returned"}, {status: 500});
	} catch (err: unknown) {
		console.error(err);
		const message = err instanceof Error ? err.message : String(err);
		return NextResponse.json({error: message || "Server error"}, {status: 500});
	}
}
