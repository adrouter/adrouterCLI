import { afterEach, describe, expect, it, vi } from "vitest";
import { ResponseBodyLimitError, readBoundedResponseText } from "../src/utils/bounded-response.ts";

describe("bounded response reader", () => {
	afterEach(() => vi.useRealTimers());
	it("does not wait for a stuck transport to acknowledge cancellation", async () => {
		vi.useFakeTimers();
		const body = new ReadableStream<Uint8Array>({ cancel: () => new Promise<void>(() => {}) });
		let outcome: unknown;
		void readBoundedResponseText(new Response(body), {
			maxBytes: 100,
			idleTimeoutMs: 10,
			overallTimeoutMs: 100,
		}).catch((error) => {
			outcome = error;
		});
		await vi.advanceTimersByTimeAsync(11);
		expect(outcome).toBeInstanceOf(ResponseBodyLimitError);
		expect(body.locked).toBe(false);
	});

	it("cancels a body that exceeds its byte budget", async () => {
		let cancelled = false;
		const body = new ReadableStream<Uint8Array>({
			start(controller) {
				controller.enqueue(new TextEncoder().encode("12345"));
			},
			cancel() {
				cancelled = true;
			},
		});
		const response = new Response(body);

		await expect(
			readBoundedResponseText(response, {
				maxBytes: 4,
				idleTimeoutMs: 100,
				overallTimeoutMs: 1000,
				label: "test response",
			}),
		).rejects.toBeInstanceOf(ResponseBodyLimitError);
		expect(cancelled).toBe(true);
	});

	it("cancels a stalled body at the idle deadline", async () => {
		let cancelled = false;
		const response = new Response(
			new ReadableStream<Uint8Array>({
				cancel() {
					cancelled = true;
				},
			}),
		);

		await expect(
			readBoundedResponseText(response, {
				maxBytes: 10,
				idleTimeoutMs: 10,
				overallTimeoutMs: 100,
				label: "test response",
			}),
		).rejects.toThrow(/timeout/);
		expect(cancelled).toBe(true);
	});
});
