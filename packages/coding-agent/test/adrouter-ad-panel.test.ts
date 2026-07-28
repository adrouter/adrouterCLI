import { publishAdRouterAds } from "@adrouter/ai";
import { type TUI, visibleWidth } from "@adrouter/tui";
import chalk from "chalk";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { AdRouterAdPanel } from "../src/modes/interactive/components/adrouter-ad-panel.ts";
import { getResolvedThemeColors, initTheme } from "../src/modes/interactive/theme/theme.ts";
import { stripAnsi } from "../src/utils/ansi.ts";

const originalColorLevel = chalk.level;

describe("AdRouterAdPanel", () => {
	beforeAll(() => {
		initTheme(undefined, false);
	});

	afterEach(() => {
		chalk.level = originalColorLevel;
		delete process.env.ADROUTER_MIN_AD_TIER;
		publishAdRouterAds({ status: "off", ads: [] });
		vi.restoreAllMocks();
	});

	it("renders live ads as three highlighted rows with title, body, CTA, and URL", () => {
		chalk.level = 3;
		const tui = { requestRender: vi.fn() } as unknown as TUI;
		const panel = new AdRouterAdPanel(tui);

		publishAdRouterAds({
			status: "live",
			ads: [
				{
					id: "ad-1",
					tier: "A",
					title: "Compiler Cloud",
					body: "Fast build minutes for coding agents.",
					cta: "Start building",
					url: "https://compiler.example",
					label: "Sponsored",
				},
			],
		});

		const lines = panel.render(80);
		const rendered = lines.map((line) => stripAnsi(line).trimEnd());

		expect(rendered).toEqual([
			"Sponsored by: Compiler Cloud",
			"Fast build minutes for coding agents.",
			"Start building · https://compiler.example",
		]);
		expect(lines.every((line) => visibleWidth(line) === 80)).toBe(true);
		expect(lines.every((line) => line.includes("\x1b[48;"))).toBe(true);
		expect(lines[0]).toContain("\x1b[3m");
		expect(lines[0]).toContain("\x1b[1m");
		expect(lines[2]).toContain("\x1b[4m");
		expect(tui.requestRender).toHaveBeenCalled();

		panel.dispose();
	});

	it("renders Tier NONE as one compact grey-highlighted row", () => {
		const tui = { requestRender: vi.fn() } as unknown as TUI;
		const panel = new AdRouterAdPanel(tui);

		publishAdRouterAds({
			status: "live",
			ads: [
				{
					id: "ad-3",
					tier: "NONE",
					title: "No sponsored content",
					body: "Sensitive category detected.",
					label: "TIER NONE",
				},
			],
		});

		const lines = panel.render(80);
		expect(lines).toHaveLength(1);
		expect(stripAnsi(lines[0]!).trimEnd()).toBe("TIER NONE: No sponsored content — Sensitive category detected.");
		expect(visibleWidth(lines[0]!)).toBe(80);
		expect(lines[0]).toContain("\x1b[48;");

		panel.dispose();
	});

	it("keeps privacy-protected NONE visible but clears opt-out", () => {
		const tui = { requestRender: vi.fn() } as unknown as TUI;
		const panel = new AdRouterAdPanel(tui);

		publishAdRouterAds({
			status: "privacy_protected",
			ads: [
				{
					id: "guardrail",
					tier: "NONE",
					title: "No sponsored content",
					body: "Sensitive category detected.",
					label: "TIER NONE",
				},
			],
		});
		expect(stripAnsi(panel.render(80).join("\n"))).toContain("TIER NONE: No sponsored content");

		publishAdRouterAds({ status: "off", ads: [] });
		expect(panel.render(80)).toEqual([]);
		panel.dispose();
	});

	it("atomically replaces a sponsor with the latest outcome and clears degraded state", () => {
		const tui = { requestRender: vi.fn() } as unknown as TUI;
		const panel = new AdRouterAdPanel(tui);

		publishAdRouterAds({
			status: "live",
			ads: [
				{
					id: "home-depot",
					tier: "A",
					title: "Home Depot",
					body: "Pipe repair supplies",
					url: "https://homedepot.com",
					label: "Sponsored",
				},
			],
		});
		publishAdRouterAds({
			status: "live",
			ads: [
				{
					id: "expedia",
					tier: "B",
					title: "Expedia",
					body: "December travel deals",
					url: "https://expedia.com",
					label: "Sponsored",
				},
			],
		});

		const replacement = stripAnsi(panel.render(80).join("\n"));
		expect(replacement).toContain("Expedia");
		expect(replacement).not.toContain("Home Depot");

		publishAdRouterAds({
			status: "live",
			ads: [
				{
					id: "none",
					tier: "NONE",
					title: "No sponsored content",
					body: "Sensitive category detected.",
					label: "TIER NONE",
				},
			],
		});
		expect(stripAnsi(panel.render(80).join("\n"))).toContain("TIER NONE: No sponsored content");
		expect(stripAnsi(panel.render(80).join("\n"))).not.toContain("Expedia");

		publishAdRouterAds({ status: "degraded", ads: [] });
		expect(panel.render(80)).toEqual([]);
		panel.dispose();
	});

	it("keeps the three-row display on narrow terminals", () => {
		const tui = { requestRender: vi.fn() } as unknown as TUI;
		const panel = new AdRouterAdPanel(tui);
		publishAdRouterAds({
			status: "live",
			ads: [
				{
					id: "narrow",
					tier: "C",
					title: "A very long brand",
					body: "A very long sponsored message",
					url: "https://example.com",
					label: "Sponsored",
				},
			],
		});
		const lines = panel.render(22);
		expect(lines).toHaveLength(3);
		expect(stripAnsi(lines[0]!)).toMatch(/^Sponsored by:/);
		expect(lines.every((line) => visibleWidth(line) === 22)).toBe(true);
		panel.dispose();
	});

	it("never exceeds extremely narrow terminal widths", () => {
		const tui = { requestRender: vi.fn() } as unknown as TUI;
		const panel = new AdRouterAdPanel(tui);
		publishAdRouterAds({
			status: "live",
			ads: [{ id: "tiny", tier: "C", title: "Brand", body: "Copy", label: "Sponsored" }],
		});

		expect(panel.render(0)).toEqual([]);
		for (const width of [1, 2, 3]) {
			const lines = panel.render(width);
			expect(lines).toHaveLength(3);
			expect(lines.every((line) => visibleWidth(line) === width)).toBe(true);
		}
		panel.dispose();
	});

	it("keeps a blank highlighted third row when CTA and URL are absent", () => {
		const tui = { requestRender: vi.fn() } as unknown as TUI;
		const panel = new AdRouterAdPanel(tui);
		publishAdRouterAds({
			status: "live",
			ads: [{ id: "minimal", tier: "B", title: "Brand", body: "Body", label: "Sponsored" }],
		});

		const lines = panel.render(30);
		expect(lines).toHaveLength(3);
		expect(stripAnsi(lines[2]!).trim()).toBe("");
		expect(visibleWidth(lines[2]!)).toBe(30);
		panel.dispose();
	});

	it("uses a footer-only dark blue and a separate grey NONE highlight", () => {
		const light = getResolvedThemeColors("light");
		expect(light.sponsoredHighlight).toBe("#dcefff");
		expect(light.sponsoredFooterHighlight).toBe("#17364a");
		expect(light.sponsoredNoneHighlight).toBe("#e8e8e8");
	});
});
