import {ReactNode} from "react";
import {ReactionCollectorCreation} from "ws-packets/src/fromServer/common/ReactionCollectorCreation";
import {SMALL_EVENT_DATA_KINDS} from "ws-packets/src/fromServer/collectors";
import {AppIcons} from "@/src/AppIcons";
import {CollectorChoices} from "@/src/collectors/CollectorPrompt";
import {formatNumber} from "@/src/display/Amounts";
import {Note, Screen} from "@/src/design/Primitives";
import {Figures, Standing} from "@/src/design/Sections";
import {FightGauge} from "@/src/components/FightGauge";
import {Theme} from "@/src/design/Theme";
import {TwemojiIcon} from "@/src/design/TwemojiIcon";
import {i18n} from "@/src/translations/i18n";

const ISLAND_EMBLEM_SIZE = 34;

export function PveIslandInvitationCollector({collector, onChoose, submitting}: {
	collector: ReactionCollectorCreation;
	onChoose: (reactionIndex: number) => void;
	submitting: boolean;
}): ReactNode {
	if (collector.data.type !== SMALL_EVENT_DATA_KINDS.PVE_ISLAND) {
		return null;
	}
	const {energy, price} = collector.data.data;
	const islandIcon = AppIcons.getIconOrNull("smallEvents.goToPVEIsland");

	return (
		<Screen>
			<Standing
				{...islandIcon ? {emblem: <TwemojiIcon emoji={islandIcon} size={ISLAND_EMBLEM_SIZE} />} : {}}
				caption={i18n.t("app:adventure.smallEvent.eyebrow")}
				title={i18n.t("app:collector.pveIsland.title")}
				subtitle={i18n.t("app:collector.pveIsland.description")}
			/>
			<Figures items={[
				{
					caption: i18n.t("app:collector.pveIsland.crossing"),
					value: price === 0 ? i18n.t("app:collector.pveIsland.free") : formatNumber(price),
					...price === 0 ? {} : {unit: "gem"}
				}
			]} />
			<FightGauge label={i18n.t("app:collector.pveIsland.energy")} value={energy.current} max={energy.max} color={Theme.colors.green} />
			<Note>{i18n.t("app:collector.pveIsland.warning")}</Note>
			<CollectorChoices collector={collector} onChoose={onChoose} submitting={submitting} />
		</Screen>
	);
}
