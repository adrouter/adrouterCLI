export interface PresencePrompt {
	taskId: string;
	promptId: string;
}

/** Local control flow only: never serialize into messages or tool results. */
export class PresenceRequiredError extends Error {
	constructor() {
		super("attention_required");
		this.name = "PresenceRequiredError";
	}
}

export class PresenceGate {
	private taskId: string | undefined;
	private pending: PresencePrompt | undefined;
	private deadline = 0;
	private remaining = 60_000;
	private paused = 0;
	private issuedAt = 0;
	private timer: ReturnType<typeof setTimeout> | undefined;
	private waiters = new Set<() => void>();
	public interactive = true;

	private readonly changed: (prompt: PresencePrompt | undefined) => void;
	private readonly clock: () => number;
	constructor(changed: (prompt: PresencePrompt | undefined) => void, clock: () => number = () => Date.now()) {
		this.changed = changed;
		this.clock = clock;
	}

	public get prompt(): PresencePrompt | undefined {
		this.check();
		return this.pending;
	}

	public start(taskId: string = globalThis.crypto.randomUUID()): void {
		this.stop();
		this.taskId = taskId;
		this.remaining = 60_000;
		this.arm();
	}

	private arm(): void {
		if (!this.taskId || this.pending || this.paused) return;
		this.deadline = this.clock() + this.remaining;
		this.timer = setTimeout(() => this.check(), this.remaining);
		this.timer.unref?.();
	}

	private check(): void {
		if (!this.taskId || this.pending || this.paused || this.clock() < this.deadline) return;
		clearTimeout(this.timer);
		this.pending = { taskId: this.taskId, promptId: globalThis.crypto.randomUUID() };
		this.issuedAt = this.clock();
		this.changed(this.pending);
	}

	public acknowledge(taskId: string, promptId: string): boolean {
		this.check();
		if (
			!this.pending ||
			this.pending.taskId !== taskId ||
			this.pending.promptId !== promptId ||
			this.clock() - this.issuedAt < 250
		)
			return false;
		this.pending = undefined;
		this.remaining = 60_000;
		this.arm();
		this.changed(undefined);
		this.wake();
		return true;
	}

	/** Ordinary approval waits suspend elapsed time, without acknowledging presence. */
	public pause(): void {
		this.check();
		if (this.paused++ === 0) {
			this.remaining = Math.max(0, this.deadline - this.clock());
			clearTimeout(this.timer);
		}
	}

	public resume(): void {
		if (this.paused > 0 && --this.paused === 0) this.arm();
	}

	public async boundary(signal?: AbortSignal): Promise<void> {
		signal?.throwIfAborted();
		const taskId = this.taskId;
		while (this.prompt) {
			if (!this.interactive) throw new PresenceRequiredError();
			await new Promise<void>((resolve, reject) => {
				const cleanup = (): void => {
					this.waiters.delete(wake);
					signal?.removeEventListener("abort", abort);
				};
				const wake = (): void => {
					cleanup();
					resolve();
				};
				const abort = (): void => {
					cleanup();
					reject(signal?.reason ?? new Error("Cancelled"));
				};
				this.waiters.add(wake);
				signal?.addEventListener("abort", abort, { once: true });
				if (signal?.aborted) abort();
			});
			signal?.throwIfAborted();
			if (taskId !== this.taskId) throw new PresenceRequiredError();
		}
	}

	private wake(): void {
		for (const wake of [...this.waiters]) wake();
	}

	public stop(): void {
		clearTimeout(this.timer);
		const hadPrompt = Boolean(this.pending);
		this.taskId = undefined;
		this.pending = undefined;
		this.paused = 0;
		if (hadPrompt) this.changed(undefined);
		this.wake();
	}
}
