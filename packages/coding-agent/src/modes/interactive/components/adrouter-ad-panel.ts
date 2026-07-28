import { type AdRouterAd, type AdRouterAdUpdate, subscribeAdRouterAds } from "@adrouter/ai";
import { type Component, type TUI, truncateToWidth, visibleWidth } from "@adrouter/tui";
import { type ThemeBg, theme } from "../theme/theme.ts";

function sanitize(value: string | undefined): string {
	return (value ?? "")
		.replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, "")
		.replace(/[\r\n\t]/g, " ")
		.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/g, "")
		.replace(/ +/g, " ")
		.trim();
}

function highlightedLine(text: string, width: number, background: ThemeBg): string {
	const clipped = truncateToWidth(text, width, "…");
	const padded = clipped + " ".repeat(Math.max(0, width - visibleWidth(clipped)));
	return theme.bg(background, padded);
}

function initialUpdate(): AdRouterAdUpdate {
	return {
		status:
			process.env.ADROUTER_ADS_ENABLED === "false" || process.env.ADROUTER_AD_MODE === "off"
				? "off"
				: process.env.ADROUTER_AD_MODE === "mock"
					? "mock"
					: "live",
		ads:
			process.env.ADROUTER_ADS_ENABLED !== "false" && process.env.ADROUTER_AD_MODE === "mock"
				? [
						{
							id: "mock-tier-3-001",
							tier: "C",
							title: "Developer Tooling",
							body: "Mock sponsored message for validating the AdRouterCLI ad surface.",
							cta: "Learn more",
							url: "https://example.com",
							label: "Sponsored",
						},
					]
				: [],
		timestamp: Date.now(),
	};
}

export class AdRouterAdPanel implements Component {
	private update: AdRouterAdUpdate = initialUpdate();
	private readonly unsubscribe: () => void;
	private readonly ui: TUI;

	constructor(ui: TUI) {
		this.ui = ui;
		this.unsubscribe = subscribeAdRouterAds((update) => {
			// Replace the complete display state per event. In particular an off,
			// degraded, or NONE event must never leave a prior sponsor visible.
			this.update = { ...update, ads: [...update.ads] };
			this.ui.requestRender();
		});
	}

	dispose(): void {
		this.unsubscribe();
	}

	invalidate(): void {
		// Render is derived from the latest event.
	}

	render(width: number): string[] {
		if (width <= 0) return [];
		if (this.update.status === "off" || this.update.status === "degraded") return [];
		const ad = this.update.ads[0];
		if (!ad) return [];
		return this.renderAd(ad, width);
	}

	private renderAd(ad: AdRouterAd, width: number): string[] {
		const title = sanitize(ad.title);
		const body = sanitize(ad.body);
		const cta = sanitize(ad.cta);
		const url = sanitize(ad.url);
		if (ad.tier === "NONE") {
			const content = `TIER NONE: No sponsored content${body ? ` — ${body}` : ""}`;
			return [highlightedLine(theme.fg("sponsoredText", content), width, "sponsoredNoneHighlight")];
		}

		const sponsorLabel = theme.italic(theme.fg("sponsoredFooterMuted", "Sponsored by:"));
		const titleText = theme.bold(theme.fg("sponsoredFooterText", title));
		const bodyText = theme.fg("sponsoredFooterText", body);
		const actionParts = [
			cta ? theme.fg("sponsoredFooterText", cta) : "",
			url ? theme.underline(theme.fg("sponsoredFooterLink", url)) : "",
		].filter(Boolean);
		return [
			highlightedLine(`${sponsorLabel}${titleText ? ` ${titleText}` : ""}`, width, "sponsoredFooterHighlight"),
			highlightedLine(bodyText, width, "sponsoredFooterHighlight"),
			highlightedLine(actionParts.join(theme.fg("sponsoredFooterMuted", " · ")), width, "sponsoredFooterHighlight"),
		];
	}
}
