const effects = new Map<string, Effect>();

export class Effect {
	public static readonly NOT_STARTED = new Effect("notStarted", ":baby:", 0);

	public static readonly DEAD = new Effect("dead", ":skull:", 16666667);

	public static readonly NO_EFFECT = new Effect("none", ":smiley:", 0);

	public static readonly SLEEPING = new Effect("sleeping", ":sleeping:", 180);

	public static readonly DRUNK = new Effect("drunk", ":zany_face:", 240);

	public static readonly FREEZING = new Effect("freezing", ":cold_face:", 60);

	public static readonly FEET_HURT = new Effect("feetHurt", ":foot:", 110);

	public static readonly HURT = new Effect("hurt", ":head_bandage:", 300);

	public static readonly SICK = new Effect("sick", ":sick:", 330);

	public static readonly JAILED = new Effect("jailed", ":lock:", 1440);

	public static readonly INJURED = new Effect("injured", ":dizzy_face:", 660);

	public static readonly OCCUPIED = new Effect("occupied", ":clock2:", 0);

	public static readonly STARVING = new Effect("starving", ":drooling_face:", 50);

	public static readonly CONFOUNDED = new Effect("confounded", ":confounded:", 40);

	public static readonly SCARED = new Effect("scared", ":scream:", 15);

	public static readonly LOST = new Effect("lost", ":face_with_monocle:", 270);

	public static readonly FISHED = new Effect("fished", ":fish:", 5);

	public static readonly WORKING = new Effect("working", ":hammer:", 75);


	public static getById(id: string): Effect | null {
		return effects.get(id) ?? null;
	}

	public static getAll(): IterableIterator<Effect> {
		return effects.values();
	}


	private readonly _id: string;

	private readonly _v4Id: string;

	private readonly _timeMinutes: number;

	private constructor(id: string, v4Id: string, timeMinutes: number) {
		this._id = id;
		this._timeMinutes = timeMinutes;
		this._v4Id = v4Id;
		effects.set(id, this);
	}

	get timeMinutes(): number {
		return this._timeMinutes;
	}

	get id(): string {
		return this._id;
	}

	get v4Id(): string {
		return this._v4Id;
	}
}
