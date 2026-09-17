export interface InterruptRegistry {
	createRegistrar(): (interrupt: (() => void) | undefined) => void;
	interruptAll(): number;
	size(): number;
}

/** Track each live child independently so parallel cancellation cannot lose earlier handles. */
export function createInterruptRegistry(): InterruptRegistry {
	const active = new Set<() => void>();
	return {
		createRegistrar() {
			let registered: (() => void) | undefined;
			return (interrupt) => {
				if (registered) active.delete(registered);
				registered = interrupt;
				if (registered) active.add(registered);
			};
		},
		interruptAll() {
			const snapshot = [...active];
			for (const interrupt of snapshot) interrupt();
			return snapshot.length;
		},
		size: () => active.size,
	};
}
