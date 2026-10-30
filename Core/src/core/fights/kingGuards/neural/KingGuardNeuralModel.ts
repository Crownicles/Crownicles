import { readFileSync } from "fs";

/**
 * Vocabularies the network was trained with: the position of every action, alteration, pet assistance, class, role
 * and style in its inputs and outputs
 */
export type NeuralVocabulary = {
	actionIds: string[];
	alterationIds: string[];
	assistIds: string[];
	classes: number[];
	roles: string[];
	styles: string[];
};

/**
 * Model file written by the training (solver/train_z.py): one hidden ReLU layer shared by a policy head
 */
export type NeuralModelFile = {
	F: number;
	H: number;
	A: number;
	vocab: NeuralVocabulary;
	W1: number[];
	b1: number[];
	Wp: number[];
	bp: number[];
	mean: number[];
	std: number[];
	tieMargin?: number;
};

/**
 * Check that the weights have the sizes announced by the file
 * @param file
 */
function assertModelShape(file: NeuralModelFile): void {
	const sizes: [actual: number, expected: number][] = [
		[file.W1.length, file.F * file.H],
		[file.b1.length, file.H],
		[file.Wp.length, file.A * file.H],
		[file.bp.length, file.A],
		[file.vocab.actionIds.length, file.A]
	];
	if (sizes.some(([actual, expected]) => actual !== expected)) {
		throw new Error("Malformed king guard model");
	}
}

/**
 * First layer with the input normalization folded in, stored input by input: (x - mean) / std * W + b becomes x * W' + b'
 * @param file
 */
function foldNormalization(file: NeuralModelFile): {
	weights: Float32Array;
	bias: Float32Array;
} {
	const {
		F, H
	} = file;
	const weights = new Float32Array(F * H);
	const bias = Float32Array.from(file.b1);
	for (let input = 0; input < F; input++) {
		for (let unit = 0; unit < H; unit++) {
			const weight = file.W1[unit * F + input] / file.std[input];
			weights[input * H + unit] = weight;
			bias[unit] -= weight * file.mean[input];
		}
	}
	return {
		weights, bias
	};
}

/**
 * Policy network of the king guards. The first layer only adds the columns of the non-zero inputs (most inputs are
 * one-hot): a decision costs a few thousand multiplications
 */
export class KingGuardNeuralModel {
	public readonly vocab: NeuralVocabulary;

	public readonly tieMargin: number;

	private readonly hiddenSize: number;

	private readonly actions: number;

	private readonly firstLayer: Float32Array;

	private readonly firstBias: Float32Array;

	private readonly policyWeights: Float32Array;

	private readonly policyBias: Float32Array;

	private readonly hidden: Float32Array;

	public constructor(file: NeuralModelFile) {
		assertModelShape(file);
		this.vocab = file.vocab;
		this.tieMargin = file.tieMargin ?? 0;
		this.hiddenSize = file.H;
		this.actions = file.A;
		const folded = foldNormalization(file);
		this.firstLayer = folded.weights;
		this.firstBias = folded.bias;
		this.policyWeights = Float32Array.from(file.Wp);
		this.policyBias = Float32Array.from(file.bp);
		this.hidden = new Float32Array(file.H);
	}

	/**
	 * Load a model written by the training
	 * @param path
	 */
	public static fromFile(path: string): KingGuardNeuralModel {
		return new KingGuardNeuralModel(JSON.parse(readFileSync(path, "utf8")) as NeuralModelFile);
	}

	/**
	 * One score per action of the vocabulary: the higher, the better the network rates the move
	 * @param x The inputs (see computeNeuralFeatures)
	 */
	public scores(x: Float32Array): Float32Array {
		this.computeHidden(x);
		const scores = new Float32Array(this.actions);
		for (let action = 0; action < this.actions; action++) {
			scores[action] = this.policyBias[action] + this.dotHidden(action * this.hiddenSize);
		}
		return scores;
	}

	/**
	 * Hidden layer (ReLU) for the inputs, left in `this.hidden`
	 * @param x
	 */
	private computeHidden(x: Float32Array): void {
		this.hidden.set(this.firstBias);
		x.forEach((value, input) => {
			if (value !== 0) {
				this.addInputColumn(input, value);
			}
		});
		for (let unit = 0; unit < this.hiddenSize; unit++) {
			this.hidden[unit] = Math.max(0, this.hidden[unit]);
		}
	}

	/**
	 * Adds the contribution of one input to the hidden layer
	 * @param input
	 * @param value
	 */
	private addInputColumn(input: number, value: number): void {
		const row = input * this.hiddenSize;
		for (let unit = 0; unit < this.hiddenSize; unit++) {
			this.hidden[unit] += this.firstLayer[row + unit] * value;
		}
	}

	/**
	 * Dot product of the hidden layer with a row of the policy weights
	 * @param row Offset of the row
	 */
	private dotHidden(row: number): number {
		let sum = 0;
		for (let unit = 0; unit < this.hiddenSize; unit++) {
			sum += this.policyWeights[row + unit] * this.hidden[unit];
		}
		return sum;
	}
}
