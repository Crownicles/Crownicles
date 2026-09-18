import {ReactNode} from "react";
import {ReactionCollectorCreation} from "ws-packets/src/fromServer/common/ReactionCollectorCreation";
import {SMALL_EVENT_DATA_KINDS} from "ws-packets/src/fromServer/collectors";
import {formatMoney} from "@/src/display/Amounts";
import {CollectorChoices} from "@/src/collectors/CollectorPrompt";
import {collectorDescription, collectorTitle} from "@/src/collectors/CollectorLabels";
import {Hero, KeyValue, Panel, Screen} from "@/src/design/Primitives";
import {i18n} from "@/src/translations/i18n";

export function RecipeShopCollector({collector, onChoose, submitting}: {
	collector: ReactionCollectorCreation;
	onChoose: (reactionIndex: number) => void;
	submitting: boolean;
}): ReactNode {
	if (collector.data.type !== SMALL_EVENT_DATA_KINDS.RECIPE_SHOP) {
		return null;
	}
	const {recipe, recipeCost} = collector.data.data;
	return (
		<Screen>
			<Hero
				eyebrow={i18n.t("app:adventure.smallEvent.eyebrow")}
				title={collectorTitle(collector.data)}
				subtitle={collectorDescription(collector.data)}
			/>
			<Panel>
				<KeyValue
					label={i18n.t("app:collector.recipeShop.fields.recipe")}
					value={i18n.t("models:cooking.recipeDisplay", recipe)}
				/>
				<KeyValue label={i18n.t("app:collector.recipeShop.fields.price")} value={formatMoney(recipeCost)} />
			</Panel>
			<CollectorChoices collector={collector} onChoose={onChoose} submitting={submitting} />
		</Screen>
	);
}