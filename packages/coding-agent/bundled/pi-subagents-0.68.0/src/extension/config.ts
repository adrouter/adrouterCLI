import * as fs from "node:fs";
import * as path from "node:path";
import type { ExtensionConfig } from "../shared/types.ts";
import { getAgentDir } from "../shared/utils.ts";

export function applyAdRouterSubagentPolicy(config: ExtensionConfig): ExtensionConfig {
	const notifyChannels = config.control?.notifyChannels?.filter((channel) => channel !== "intercom");
	return {
		...config,
		// AdRouter delegates one level only. Child processes never receive the subagent tool.
		maxSubagentDepth: 1,
		parallel: { maxTasks: 3, concurrency: 3 },
		chain: { dynamicFanout: { maxItems: 3 } },
		// External/native intercom and managed worktree hooks are outside the reviewed subset.
		intercomBridge: { mode: "off" },
		worktreeSetupHook: undefined,
		worktreeSetupHookTimeoutMs: undefined,
		...(config.control
			? {
					control: {
						...config.control,
						...(notifyChannels ? { notifyChannels } : {}),
					},
				}
			: {}),
	};
}

export function loadConfig(): ExtensionConfig {
	const configPath = path.join(getAgentDir(), "extensions", "subagent", "config.json");
	try {
		if (fs.existsSync(configPath)) {
			return applyAdRouterSubagentPolicy(JSON.parse(fs.readFileSync(configPath, "utf-8")) as ExtensionConfig);
		}
	} catch (error) {
		console.error(`Failed to load subagent config from '${configPath}':`, error);
	}
	return applyAdRouterSubagentPolicy({});
}
