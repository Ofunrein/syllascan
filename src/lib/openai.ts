import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface Event {
  title: string;
  description?: string;
  startDate: string; // ISO date string
  endDate?: string; // ISO date string
  location?: string;
  isAllDay?: boolean;
}

export async function extractEventsFromImage(base64Image: string): Promise<Event[]> {
  try {
    console.log("Calling OpenAI API with image...");
    
    // Use the latest GPT-4 Vision model
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Extract all calendar events from this syllabus or document image. For each event, provide the title, description (if available), start date, end date (if available), location (if available), and whether it's an all-day event. Format the response as a JSON array of events with the following structure: [{\"title\": \"Event Title\", \"description\": \"Event Description\", \"startDate\": \"ISO date string\", \"endDate\": \"ISO date string\", \"location\": \"Location\", \"isAllDay\": boolean}]. Ensure dates are in ISO format (YYYY-MM-DDTHH:MM:SS). If you can't determine a field, omit it from the JSON."
            },
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${base64Image}`,
              },
            },
          ],
        },
      ],
      max_tokens: 4096,
      temperature: 0.2,
      response_format: { type: "json_object" },
    });

    console.log("OpenAI API response received");
    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("No content in response");
    }

    console.log("Parsing response content...");
    const parsedContent = JSON.parse(content);
    return parsedContent.events || [];
  } catch (error) {
    console.error("Error extracting events from image:", error);
    throw error;
  }
}

export default openai; 