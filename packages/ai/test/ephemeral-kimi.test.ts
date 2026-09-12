import { describe, expect, it } from "vitest";
import type { AssistantMessage } from "../src/types.ts";
import { EphemeralKimiReasoning } from "../src/utils/ephemeral-kimi.ts";

const assistant = () =>
	({ role: "assistant", content: [{ type: "text", text: "Visible" }], timestamp: 1 }) as AssistantMessage;
describe("memory-only Kimi continuation", () => {
	it("keeps complete reasoning only in wire copies and loses it on reload", () => {
		const memory = new EphemeralKimiReasoning();
		const message = assistant();
		memory.select("kimi-k3");
		memory.complete(message, "private fixture reasoning");
		expect(JSON.stringify(message)).not.toContain("private fixture");
		expect(JSON.stringify(memory.prepare([message]))).toContain("private fixture");
		expect(JSON.stringify(memory.prepare([structuredClone(message)]))).not.toContain("private fixture");
		expect(memory.prepare([message])[0]?.role).toBe("user");
	});
	it("drops continuation on model change or incomplete stream", () => {
		const memory = new EphemeralKimiReasoning();
		const message = assistant();
		memory.select("kimi-k3");
		memory.complete(message, "private fixture");
		memory.select("glm-5.3");
		memory.select("kimi-k3");
		expect(JSON.stringify(memory.prepare([message]))).not.toContain("private fixture");
		memory.complete(message, "private fixture");
		memory.clear();
		expect(JSON.stringify(memory.prepare([message]))).not.toContain("private fixture");
	});
});
