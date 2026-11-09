import { ReactNode } from "react";
import { BlacksmithEnchantmentTransferRes } from "ws-packets/src/fromServer/report/BlacksmithEnchantmentTransferRes";
import { AppIcons } from "@/src/AppIcons";
import { Toast } from "@/src/design/Sections";
import { TwemojiIcon } from "@/src/design/TwemojiIcon";
import { formatMoney } from "@/src/display/Amounts";
import { i18n } from "@/src/translations/i18n";

const EMBLEM_SIZE = 22;

/** The enchantment the blacksmith moved, said in passing over the forge the player stays in. */
export function EnchantmentTransferOutcome({
	outcome, onContinue
}: {
	outcome: BlacksmithEnchantmentTransferRes; onContinue: () => void;
}): ReactNode {
	const emoji = AppIcons.getIconOrNull(`enchantmentTypes.${outcome.enchantmentType}`);
	return <Toast
		{...emoji ? { emblem: <TwemojiIcon emoji={emoji} size={EMBLEM_SIZE} /> } : {}}
		title={i18n.t("app:city.enchantmentTransferred.title")}
		subtitle={i18n.t("app:city.enchantmentTransferred.description", {
			enchantment: i18n.t(`items:enchantments.${outcome.enchantmentId}`), cost: formatMoney(outcome.cost)
		})}
		onDismiss={onContinue}
	/>;
}
