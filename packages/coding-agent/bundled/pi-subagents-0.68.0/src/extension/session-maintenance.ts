export interface SessionMaintenanceLifecycle {
	start(): void;
	stop(): void;
}

/** Keep background maintenance scoped to a live parent session. */
export function createSessionMaintenanceLifecycle(options: {
	startWatcher(): void;
	primeResults(): void;
	stopWatcher(): void;
	clearTimers(): void;
}): SessionMaintenanceLifecycle {
	let started = false;
	return {
		start() {
			if (started) return;
			started = true;
			options.startWatcher();
			options.primeResults();
		},
		stop() {
			if (!started) return;
			started = false;
			options.stopWatcher();
			options.clearTimers();
		},
	};
}
