import { ReactNode } from "react";
import { DefenseReq } from "ws-packets/src/fromClient/DefenseReq";
import { DefenseNoChoiceRes } from "ws-packets/src/fromServer/defense/DefenseRes";
import { FromServerPacket } from "ws-packets/src/fromServer/FromServerPacket";
import { PlayerNotFound } from "ws-packets/src/fromServer/common/PlayerNotFound";
import {
	CommandMenu, useCommandMenus
} from "@/src/store/useInventoryMenus";
import { SectionHeader } from "@/src/design/Primitives";
import {
	EntryRow, ExpandableList, Lock, Refusal
} from "@/src/design/Sections";
import { TwemojiIcon } from "@/src/design/TwemojiIcon";
import { AppIcons } from "@/src/AppIcons";
import { i18n } from "@/src/translations/i18n";

const ENTRY_EMBLEM_SIZE = 26;

/** The app cannot tell beforehand which classes have a single style: the server's answer is shown on the spot. */
function noChoiceRefusal(packet: FromServerPacket): string {
	return i18n.t("commands:defense.noChoice", { className: i18n.t(`models:classes.${(packet as DefenseNoChoiceRes).classId}`) });
}

const DEFENSE_MENU: CommandMenu = {
	request: DefenseReq, emptyPacket: PlayerNotFound, emptyMessage: "app:profile.notFound", outcomePackets: [DefenseNoChoiceRes], refusal: noChoiceRefusal
};

/** Opens the choice of the style defending the player; what keeps it closed is written on the row, before any tap. */
export function DefenseStyleEntry({ lock }: { lock: Lock | undefined }): ReactNode {
	const menus = useCommandMenus();
	return <>
		<SectionHeader>{i18n.t("app:defense.section")}</SectionHeader>
		<ExpandableList>
			<EntryRow
				emblem={<TwemojiIcon emoji={AppIcons.getIcon("fightCommand.shield")} size={ENTRY_EMBLEM_SIZE} />}
				title={i18n.t("app:defense.title")}
				subtitle={lock?.reason ?? i18n.t("app:defense.entry")}
				disabled={lock !== undefined}
				onPress={(): void => {
					menus.open(DEFENSE_MENU).catch(console.error);
				}}
			/>
		</ExpandableList>
		{menus.message ? <Refusal>{menus.message}</Refusal> : null}
	</>;
}
