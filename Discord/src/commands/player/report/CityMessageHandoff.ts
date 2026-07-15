import { CrowniclesInteraction } from "../../../messages/CrowniclesInteraction";
import { CrowniclesNestedMenus } from "../../../messages/CrowniclesNestedMenus";

const cityMenusByInteraction = new WeakMap<CrowniclesInteraction, CrowniclesNestedMenus>();

export function registerCityMessageOwner(interaction: CrowniclesInteraction, nestedMenus: CrowniclesNestedMenus): void {
	cityMenusByInteraction.set(interaction, nestedMenus);
}

export function confirmCityMessageHandoff(interaction: CrowniclesInteraction): void {
	cityMenusByInteraction.get(interaction)?.confirmMessageHandoff();
}
