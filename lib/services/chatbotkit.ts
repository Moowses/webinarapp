import "server-only";

type CompleteConversationInput = {
  apiKey: string;
  conversationId: string;
  text: string;
};

type CompleteConversationResult = {
  text: string;
};

export async function completeChatbotKitConversation(
  input: CompleteConversationInput
): Promise<CompleteConversationResult> {
  const response = await fetch(
    `https://api.chatbotkit.com/v1/conversation/${encodeURIComponent(input.conversationId)}/complete`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Token ${input.apiKey}`,
      },
      body: JSON.stringify({ text: input.text }),
    }
  );

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`ChatbotKit request failed (${response.status}) ${body.slice(0, 300)}`);
  }

  const payload = (await response.json()) as { text?: unknown };
  return {
    text: typeof payload.text === "string" ? payload.text.trim() : "",
  };
}
