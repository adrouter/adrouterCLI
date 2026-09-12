import type { AssistantMessage, Message } from "../types.ts";

/** Reasoning never becomes part of a serializable message or event. */
export class EphemeralKimiReasoning {
	private records = new WeakMap<AssistantMessage, string>();
	private characters = 0;
	private contextOnly = new WeakSet<Message>();
	private model = "";
	select(model: string): void {
		if (model !== this.model) this.clear();
		this.model = model;
	}
	clear(): void {
		this.records = new WeakMap();
		this.contextOnly = new WeakSet();
		this.characters = 0;
	}
	complete(message: AssistantMessage, reasoning: string): void {
		if (!reasoning || reasoning.length > 2_000_000) {
			this.clear();
			return;
		}
		if (this.characters + reasoning.length > 2_000_000) this.clear();
		this.records.set(message, reasoning);
		this.characters += reasoning.length;
	}
	prepare(messages: Message[]): Message[] {
		const missing = messages.some(
			(message) => message.role === "assistant" && !this.records.has(message) && !this.contextOnly.has(message),
		);
		if (missing) {
			this.clear();
			for (const message of messages) if (message.role !== "user") this.contextOnly.add(message);
		}
		return messages.map((message) => {
			if (message.role === "assistant") {
				const visible = message.content.filter((block) => block.type !== "thinking");
				if (this.contextOnly.has(message))
					return {
						role: "user" as const,
						timestamp: message.timestamp,
						content:
							"Earlier assistant response, supplied as conversation context:\n" +
							visible
								.filter((block) => block.type === "text")
								.map((block) => block.text)
								.join("\n"),
					};
				return {
					...message,
					content: [
						{
							type: "thinking" as const,
							thinking: this.records.get(message) ?? "",
							thinkingSignature: "reasoning_content",
						},
						...visible,
					],
				};
			}
			if (this.contextOnly.has(message) && message.role === "toolResult")
				return {
					role: "user" as const,
					timestamp: message.timestamp,
					content:
						"Earlier tool result, supplied as conversation context:\n" +
						message.content
							.filter((block) => block.type === "text")
							.map((block) => block.text)
							.join("\n"),
				};
			return message;
		});
	}
}
