import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PresenceGate, PresenceRequiredError } from "../src/presence.ts";

describe("presence execution boundary", () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});
	afterEach(() => {
		vi.useRealTimers();
	});

	it("counts first-response waiting and rejects early, stale and repeated acknowledgement", async () => {
		const changed = vi.fn();
		const gate = new PresenceGate(changed);
		gate.start("task");
		await vi.advanceTimersByTimeAsync(59_999);
		expect(gate.prompt).toBeUndefined();
		await vi.advanceTimersByTimeAsync(1);
		const prompt = gate.prompt!;
		expect(prompt.taskId).toBe("task");
		expect(gate.acknowledge(prompt.taskId, prompt.promptId)).toBe(false);
		let executed = false;
		const boundary = gate.boundary().then(() => {
			executed = true;
		});
		await vi.advanceTimersByTimeAsync(250);
		expect(executed).toBe(false);
		expect(gate.acknowledge("previous-task", prompt.promptId)).toBe(false);
		expect(gate.acknowledge(prompt.taskId, "previous-prompt")).toBe(false);
		expect(gate.acknowledge(prompt.taskId, prompt.promptId)).toBe(true);
		await boundary;
		expect(executed).toBe(true);
		expect(gate.acknowledge(prompt.taskId, prompt.promptId)).toBe(false);
		await vi.advanceTimersByTimeAsync(60_000);
		expect(gate.prompt?.promptId).not.toBe(prompt.promptId);
		gate.stop();
	});

	it("suspends elapsed time during nested approval waits without granting presence", async () => {
		const gate = new PresenceGate(() => {});
		gate.start("task");
		await vi.advanceTimersByTimeAsync(40_000);
		gate.pause();
		gate.pause();
		await vi.advanceTimersByTimeAsync(180_000);
		gate.resume();
		await vi.advanceTimersByTimeAsync(180_000);
		expect(gate.prompt).toBeUndefined();
		gate.resume();
		await vi.advanceTimersByTimeAsync(19_999);
		expect(gate.prompt).toBeUndefined();
		await vi.advanceTimersByTimeAsync(1);
		expect(gate.prompt).toBeDefined();
		gate.pause();
		gate.resume();
		expect(gate.prompt).toBeDefined();
		gate.stop();
	});

	it("detects an overdue deadline when background timers did not run", () => {
		let time = 0;
		const gate = new PresenceGate(
			() => {},
			() => time,
		);
		gate.start("task");
		time = 90_000;
		expect(gate.prompt).toBeDefined();
		gate.stop();
	});

	it("keeps receiving an existing stream but blocks subsequent queued execution", async () => {
		const gate = new PresenceGate(() => {});
		gate.start("task");
		await gate.boundary();
		const received: string[] = [];
		await vi.advanceTimersByTimeAsync(60_000);
		received.push("partial", "settlement", "done");
		let next = false;
		const waiting = gate.boundary().then(() => {
			next = true;
		});
		await vi.advanceTimersByTimeAsync(250);
		expect(received).toEqual(["partial", "settlement", "done"]);
		expect(next).toBe(false);
		const prompt = gate.prompt!;
		gate.acknowledge(prompt.taskId, prompt.promptId);
		await waiting;
		expect(next).toBe(true);
		gate.stop();
	});

	it("cancels a pending boundary and clears task state", async () => {
		const gate = new PresenceGate(() => {});
		const controller = new AbortController();
		gate.start("task");
		await vi.advanceTimersByTimeAsync(60_000);
		const prompt = gate.prompt!;
		const waiting = gate.boundary(controller.signal);
		const rejected = expect(waiting).rejects.toThrow();
		controller.abort();
		gate.stop();
		await rejected;
		expect(gate.prompt).toBeUndefined();
		expect(gate.acknowledge(prompt.taskId, prompt.promptId)).toBe(false);
	});

	it("fails noninteractive execution only at a safe boundary", async () => {
		const changed = vi.fn();
		const gate = new PresenceGate(changed);
		gate.interactive = false;
		gate.start("task");
		await vi.advanceTimersByTimeAsync(60_000);
		expect(changed).toHaveBeenCalledOnce();
		await expect(gate.boundary()).rejects.toBeInstanceOf(PresenceRequiredError);
		gate.stop();
	});
});
