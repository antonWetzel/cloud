import * as GPU from '../gpu/header.js'

export function Create(points: number): GPUBuffer {
	const colors = new Float32Array(points * 4)

	for (let i = 0; i < points; i++) {
		colors[i * 4 + 0] = 0.2 + 0.5 * Math.random()
		colors[i * 4 + 1] = 0.2 + 0.5 * Math.random()
		colors[i * 4 + 2] = 0.2 + 0.5 * Math.random()
	}

	return GPU.CreateBuffer(colors, GPUBufferUsage.VERTEX | GPUBufferUsage.STORAGE)
}
