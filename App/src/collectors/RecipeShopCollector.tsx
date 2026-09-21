import {ReactNode, useState} from "react";
import {ReactionCollectorCreation} from "ws-packets/src/fromServer/common/ReactionCollectorCreation";
import {GENERIC_REACTION_KINDS, SMALL_EVENT_DATA_KINDS} from "ws-packets/src/fromServer/collectors";
import {formatMoney} from "@/src/display/Amounts";
import {collectorDescription, collectorTitle} from "@/src/collectors/CollectorLabels";
import {Note, Screen} from "@/src/design/Primitives";
import {ActionBanner, BackButton, Figures, Standing} from "@/src/design/Sections";
import {SwipeBack} from "@/src/design/SwipeBack";
import {TwemojiIcon} from "@/src/design/TwemojiIcon";
import {Check} from "@/src/design/FightIcons";
import {plainStory} from "@/src/display/Markdown";
import {AppIcons} from "@/src/AppIcons";
import {i18n} from "@/src/translations/i18n";

const MERCHANT_EMBLEM_SIZE = 34;

/** A recipe seller makes a single offer, told the same way as any other travelling merchant. */
export function RecipeShopCollector({collector, onChoose, submitting}: {
	collector: ReactionCollectorCreation;
	onChoose: (reactionIndex: number) => void;
	submitting: boolean;
}): ReactNode {
	const [answered, setAnswered] = useState(false);
	if (collector.data.type !== SMALL_EVENT_DATA_KINDS.RECIPE_SHOP) {
		return null;
	}
	const {recipe, recipeCost} = collector.data.data;
	const recipeName = plainStory(i18n.t("models:cooking.recipeDisplay", recipe));
	const locked = answered || submitting;
	const choose = (index: number): void => {
		if (locked) {
			return;
		}
		setAnswered(true);
		onChoose(index);
	};
	const leave = (): void => choose(collector.reactions.findIndex(reaction => reaction.type === GENERIC_REACTION_KINDS.REFUSE));
	const emblem = AppIcons.getIconOrNull("smallEvents.recipeShop");

	return (
		<SwipeBack onClose={leave}>
			<Screen>
				<BackButton label={i18n.t("app:collector.refuse")} onClose={leave} />
				<Standing
					{...emblem ? {emblem: <TwemojiIcon emoji={emblem} size={MERCHANT_EMBLEM_SIZE} />} : {}}
					caption={i18n.t("app:adventure.smallEvent.eyebrow")}
					title={collectorTitle(collector.data)}
					subtitle={collectorDescription(collector.data)}
				/>
				<Note>{recipeName}</Note>
				<Figures items={[{caption: i18n.t("app:collector.recipeShop.fields.price"), value: formatMoney(recipeCost), unit: "money"}]} />
				<ActionBanner
					icon={Check}
					label={i18n.t("app:city.shop.buy", {item: recipeName, price: formatMoney(recipeCost)})}
					pending={locked}
					onPress={(): void => choose(collector.reactions.findIndex(reaction => reaction.type === GENERIC_REACTION_KINDS.ACCEPT))}
				/>
			</Screen>
		</SwipeBack>
	);
}
