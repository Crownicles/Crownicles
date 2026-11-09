import { ReactNode } from "react";
import { EnchanterDisenchantRes } from "ws-packets/src/fromServer/report/EnchanterDisenchantRes";
import { AppIcons } from "@/src/AppIcons";
import { Toast } from "@/src/design/Sections";
import { TwemojiIcon } from "@/src/design/TwemojiIcon";
import { i18n } from "@/src/translations/i18n";

const EMBLEM_SIZE = 22;

/** The enchantment Mernil wiped away, said in passing over the enchanter page the player stays on. */
export function EnchanterDisenchantOutcome({
	outcome, onContinue
}: {
	outcome: EnchanterDisenchantRes; onContinue: () => void;
}): ReactNode {
	const emoji = AppIcons.getIconOrNull(`enchantmentTypes.${outcome.enchantmentType}`);
	return <Toast
		{...emoji ? { emblem: <TwemojiIcon emoji={emoji} size={EMBLEM_SIZE} /> } : {}}
		title={i18n.t("app:city.disenchanted.title")}
		subtitle={i18n.t("app:city.disenchanted.description", { enchantment: i18n.t(`items:enchantments.${outcome.enchantmentId}`) })}
		onDismiss={onContinue}
	/>;
}
