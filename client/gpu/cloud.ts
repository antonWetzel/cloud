import { aspect, cameraBuffer, ConvertURI, CreateBuffer, device, format, NewModule, renderPass } from './gpu.js'
import { Position } from './position.js'
import srcURI from 'render/cloud.wgsl'

let quadBuffer = undefined as GPUBuffer | undefined

let pipeline: GPURenderPipeline | undefined = undefined

export function Render(
	position: Position,
	radius: number,
	length: number,
	positions: GPUBuffer,
	colors: GPUBuffer,
): void {
	if (pipeline == undefined || quadBuffer == undefined) {
		const module = NewModule(ConvertURI(srcURI))
		pipeline = device.createRenderPipeline({
			vertex: {
				module:     module,
				entryPoint: 'vertexMain',
				buffers:    [
					{
						attributes: [
							{
								shaderLocation: 0,
								offset:         0 * 4,
								format:         'float32x2',
							},
						],
						arrayStride: 2 * 4,
						stepMode:    'vertex',
					},
					{
						attributes: [
							{
								shaderLocation: 1,
								offset:         0 * 4,
								format:         'float32x3',
							},
						],
						arrayStride: 4 * 4,
						stepMode:    'instance',
					},
					{
						attributes: [
							{
								shaderLocation: 2,
								offset:         0 * 4,
								format:         'float32x3',
							},
						],
						arrayStride: 4 * 4,
						stepMode:    'instance',
					},
				],
			},
			fragment: {
				module:     module,
				entryPoint: 'fragmentMain',
				targets:    [
					{
						format: format,
					},
				],
			},
			depthStencil: {
				format:            'depth32float',
				depthWriteEnabled: true,
				depthCompare:      'less',
			},
			primitive: {
				topology:         'triangle-strip',
				stripIndexFormat: 'uint32',
				cullMode:         'back',
			},
		})
		quadBuffer = CreateBuffer(
			new Float32Array([-1.0, -1.0, 1.0, -1.0, -1.0, 1.0, 1.0, 1.0]),
			GPUBufferUsage.VERTEX,
		)
	}

	const array = new Float32Array(16 + 2)
	position.Save(array, 0)
	array[16] = radius
	array[17] = aspect()
	const buffer = CreateBuffer(array, GPUBufferUsage.UNIFORM)
	renderPass.setPipeline(pipeline)
	const group = device.createBindGroup({
		layout:  pipeline.getBindGroupLayout(0),
		entries: [
			{
				binding:  0,
				resource: { buffer: cameraBuffer },
			},
			{
				binding:  1,
				resource: { buffer: buffer },
			},
		],
	})
	renderPass.setBindGroup(0, group)
	renderPass.setVertexBuffer(0, quadBuffer)
	renderPass.setVertexBuffer(1, positions)
	renderPass.setVertexBuffer(2, colors)
	renderPass.draw(4, length)
}
