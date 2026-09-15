import {ReactNode} from "react";
import {ReactionCollectorCreation} from "ws-packets/src/fromServer/common/ReactionCollectorCreation";
import {SMALL_EVENT_DATA_KINDS} from "ws-packets/src/fromServer/collectors";
import {AppIcons} from "@/src/AppIcons";
import {CollectorChoices} from "@/src/collectors/CollectorPrompt";
import {AMOUNT_UNITS, formatAmount, formatNumber} from "@/src/display/Amounts";
import {Hero, KeyValue, Notice, Panel, Screen, StatBar} from "@/src/design/Primitives";
import {Theme} from "@/src/design/Theme";
import {TwemojiIcon} from "@/src/design/TwemojiIcon";
import {i18n} from "@/src/translations/i18n";

export function PveIslandInvitationCollector({collector, onChoose, submitting}: {
	collector: ReactionCollectorCreation;
	onChoose: (reactionIndex: number) => void;
	submitting: boolean;
}): ReactNode {
	if (collector.data.type !== SMALL_EVENT_DATA_KINDS.PVE_ISLAND) {
		return null;
	}
	const {energy, price} = collector.data.data;
	const energyRatio = energy.max === 0 ? 0 : energy.current / energy.max;
	const islandIcon = AppIcons.getIconOrNull("smallEvents.goToPVEIsland");

	return (
		<Screen>
			<Hero
				eyebrow={i18n.t("app:adventure.smallEvent.eyebrow")}
				title={i18n.t("app:collector.pveIsland.title")}
				subtitle={i18n.t("app:collector.pveIsland.description")}
			/>
			<Panel>
				<StatBar
					label={i18n.t("app:collector.pveIsland.energy")}
					value={`${formatNumber(energy.current)} / ${formatNumber(energy.max)}`}
					ratio={energyRatio}
					color={Theme.colors.green}
				/>
				<KeyValue
					label={i18n.t("app:collector.pveIsland.crossing")}
					value={price === 0 ? i18n.t("app:collector.pveIsland.free") : formatAmount(price, AMOUNT_UNITS.GEM)}
				/>
			</Panel>
			<Notice
				icon={islandIcon ? <TwemojiIcon emoji={islandIcon} size={Theme.dimensions.headerIcon} /> : undefined}
				title={i18n.t("app:collector.pveIsland.warningTitle")}
				text={i18n.t("app:collector.pveIsland.warning")}
			/>
			<CollectorChoices collector={collector} onChoose={onChoose} submitting={submitting} />
		</Screen>
	);
}