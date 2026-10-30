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
 * Policy network of the king guards. The input normalization is folded into the first layer, which then only adds
 * the columns of the non-zero inputs (most inputs are one-hot): a decision costs a few thousand multiplications
 */
export class KingGuardNeuralModel {
	public readonly vocab: NeuralVocabulary;

	public readonly tieMargin: number;

	private readonly inputs: number;

	private readonly hiddenSize: number;

	private readonly actions: number;

	private readonly firstLayer: Float32Array;

	private readonly firstBias: Float32Array;

	private readonly policyWeights: Float32Array;

	private readonly policyBias: Float32Array;

	private readonly hidden: Float32Array;

	public constructor(file: NeuralModelFile) {
		const {
			F, H, A
		} = file;
		if (file.W1.length !== F * H || file.Wp.length !== A * H || file.vocab.actionIds.length !== A) {
			throw new Error("Malformed king guard model");
		}
		this.vocab = file.vocab;
		this.tieMargin = file.tieMargin ?? 0;
		this.inputs = F;
		this.hiddenSize = H;
		this.actions = A;
		this.firstLayer = new Float32Array(F * H);
		this.firstBias = Float32Array.from(file.b1);
		for (let j = 0; j < H; j++) {
			for (let i = 0; i < F; i++) {
				const weight = file.W1[j * F + i] / file.std[i];
				this.firstLayer[i * H + j] = weight;
				this.firstBias[j] -= weight * file.mean[i];
			}
		}
		this.policyWeights = Float32Array.from(file.Wp);
		this.policyBias = Float32Array.from(file.bp);
		this.hidden = new Float32Array(H);
	}

	public static fromFile(path: string): KingGuardNeuralModel {
		return new KingGuardNeuralModel(JSON.parse(readFileSync(path, "utf8")) as NeuralModelFile);
	}

	public get inputSize(): number {
		return this.inputs;
	}

	/**
	 * One score per action of the vocabulary: the higher, the better the network rates the move
	 */
	public scores(x: Float32Array): Float32Array {
		const {
			inputs, hiddenSize, actions, firstLayer, hidden
		} = this;
		hidden.set(this.firstBias);
		for (let i = 0; i < inputs; i++) {
			const xi = x[i];
			if (xi === 0) {
				continue;
			}
			const row = i * hiddenSize;
			for (let j = 0; j < hiddenSize; j++) {
				hidden[j] += firstLayer[row + j] * xi;
			}
		}
		for (let j = 0; j < hiddenSize; j++) {
			hidden[j] = Math.max(0, hidden[j]);
		}
		const scores = new Float32Array(actions);
		for (let k = 0; k < actions; k++) {
			let sum = this.policyBias[k];
			const row = k * hiddenSize;
			for (let j = 0; j < hiddenSize; j++) {
				sum += this.policyWeights[row + j] * hidden[j];
			}
			scores[k] = sum;
		}
		return scores;
	}
}
