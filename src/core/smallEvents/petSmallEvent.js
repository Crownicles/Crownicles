import {giveRandomItem} from "../utils/ItemUtils";
import {PetEntities} from "../models/PetEntity";
import {smallEvent as doNothing} from "./doNothingSmallEvent";
import {Constants} from "../Constants";
import {Maps} from "../Maps";

/**
 * Main function of small event
 * @param {module:"discord.js".Message} message
 * @param {"fr"|"en"} language
 * @param {Entities} entity
 * @param {module:"discord.js".MessageEmbed} seEmbed - The template embed to send.
 *    The description already contains the emote so you have to get it and add your text
 * @returns {Promise<>}
 */
const executeSmallEvent = async function(message, language, entity, seEmbed) {

	if (!entity.Player.Pet) {
		// the player does not have a pet : do nothing
		return await doNothing.executeSmallEvent(message, language, entity, seEmbed);
	}

	const pet = entity.Player.Pet;
	let interaction = pickRandomInteraction(entity.Player.Pet);
	let amount = 0;
	let food = null;
	switch (interaction) {
	case "money":
		amount = randInt(20, 70);
		await entity.Player.addMoney(entity, amount, message.channel, language);
		await entity.Player.save();
		break;
	case "gainLife":
		amount = randInt(1, 5);
		await entity.addHealth(amount, message.channel, language);
		await entity.save();
		break;
	case "gainLove":
		amount = randInt(1, 3);
		await pet.changeLovePoints(amount, entity.discordUserId, message.channel, language);
		await pet.save();
		break;
	case "food":
		if (entity.Player.guildId) {
			food = draftbotRandom.pick([JsonReader.food.commonFood, JsonReader.food.herbivorousFood, JsonReader.food.carnivorousFood, JsonReader.food.ultimateFood]);
		}
		else {
			interaction = "nothing";
		}
		break;
	case "gainTime":
		amount = randInt(5, 20);
		Maps.advanceTime(entity.Player, amount);
		entity.Player.save();
		break;
	case "points":
		amount = randInt(20, 70);
		await entity.Player.addScore(entity, amount, message.channel, language);
		await entity.Player.save();
		break;
	case "badge":
		if (entity.Player.badges !== null) {
			if (entity.Player.badges.includes(Constants.BADGES.PET_TAMER)) {
				interaction = "nothing";
			}
			else {
				entity.Player.addBadge(Constants.BADGES.PET_TAMER);
				entity.Player.save();
			}
		}
		else {
			entity.Player.addBadge(Constants.BADGES.PET_TAMER);
			entity.Player.save();
		}

		break;
	case "loseLife":
		amount = randInt(1, 5);
		await entity.addHealth(-amount, message.channel, language);
		await entity.save();
		break;
	case "loseMoney":
		amount = randInt(20, 70);
		await entity.Player.addMoney(entity, -amount, message.channel, language);
		entity.Player.save();
		break;
	case "loseTime":
		amount = randInt(5, 20);
		await Maps.applyEffect(entity.Player, EFFECT.OCCUPIED, amount);
		entity.Player.save();
		break;
	case "petFlee":
		pet.destroy();
		entity.Player.petId = null;
		entity.Player.save();
		break;
	case "loseLove":
		amount = randInt(1, 3);
		await pet.changeLovePoints(-amount, entity.discordUserId, message.channel, language);
		await pet.save();
		break;
	default:
		break;
	}
	await generatePetEmbed(language, interaction, seEmbed, pet, amount, food);

	await message.channel.send({ embeds: [seEmbed] });
	switch (interaction) {
	case "item":
		await giveRandomItem(message.author, message.channel, language, entity);
		break;
	case "food":
		await giveFood(message, language, entity, message.author, food, 1);
		break;
	case "loseLife":
		await entity.Player.killIfNeeded(entity, message.channel, language);
		break;
	default:
		break;
	}
	log(entity.discordUserId + " got a pet interaction");
};

/**
 * Allow to generate the embed that will be displayed to the player
 * @param language
 * @param interaction
 * @param seEmbed - base small event embed
 * @param pet - The pet of the player
 * @param amount - amount of stuff gained
 * @param food - food earned
 * @returns {Promise<void>}
 */
const generatePetEmbed = async function(language, interaction, seEmbed, pet, amount, food) {
	const tr = JsonReader.smallEvents.pet.getTranslation(language);
	const sentence = tr[interaction][randInt(0, tr[interaction].length)];
	const randomAnimal = sentence.includes("{randomAnimal}") ? await PetEntities.generateRandomPetEntityNotGuild() : null;
	seEmbed.setDescription(format(sentence, {
		pet: pet.getPetEmote() + " " + (pet.nickname ? pet.nickname : pet.getPetTypeName(language)),
		nominative: tr.nominative[pet.sex],
		nominativeShift: tr.nominative[pet.sex].charAt(0).toUpperCase() + tr.nominative[pet.sex].slice(1),
		accusative: tr.accusative[pet.sex],
		accusativeShift: tr.accusative[pet.sex].charAt(0).toUpperCase() + tr.accusative[pet.sex].slice(1),
		determinant: tr.determinant[pet.sex],
		determinantShift: tr.determinant[pet.sex].charAt(0).toUpperCase() + tr.determinant[pet.sex].slice(1),
		amount: amount,
		food: food ? food.translations[language].name.toLowerCase() + " " + food.emote + " " : "",
		badge: Constants.BADGES.PET_TAMER,
		feminine: pet.sex === "f" ? "e" : "",
		randomAnimal: randomAnimal ? randomAnimal.getPetEmote() + " " + randomAnimal.getPetTypeName(language) : "",
		randomAnimalFeminine: randomAnimal ? randomAnimal.sex === "f" ? "e" : "" : "",
		petFemale: pet.sex === "f"
	}));
};

/**
 * Sélectionne une interaction aléatoire avec un pet
 * @param petEntity - le pet
 * @returns {string|null} - une interaction aléatoire
 */
const pickRandomInteraction = function(petEntity) {
	const section = petEntity.isFeisty() ? JsonReader.smallEvents.pet.rarities.feisty : JsonReader.smallEvents.pet.rarities.normal;
	const level = petEntity.PetModel.rarity + (petEntity.getLoveLevelNumber() === 5 ? 1 : 0);

	let total = 0;
	for (const key in section) {
		if (Object.prototype.hasOwnProperty.call(section, key)) {
			if (section[key].minLevel) {
				if (section[key].minLevel <= level) {
					total += section[key].probabilityWeight;
				}
			}
			else {
				total += section[key].probabilityWeight;
			}
		}
	}

	const pickedNumber = randInt(0, total);
	let cumulative = 0;

	for (const key in section) {
		if (Object.prototype.hasOwnProperty.call(section, key)) {
			if (section[key].minLevel) {
				if (section[key].minLevel <= level) {
					if (pickedNumber < cumulative + section[key].probabilityWeight) {
						return key;
					}
					cumulative += section[key].probabilityWeight;
				}
			}
			else if (pickedNumber < cumulative + section[key].probabilityWeight) {
				return key;
			}
			else {
				cumulative += section[key].probabilityWeight;
			}
		}
	}
	return null;
};

module.exports = {
	smallEvent: {
		executeSmallEvent: executeSmallEvent,
		canBeExecuted: () => Promise.resolve(true)
	}
};