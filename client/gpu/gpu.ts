import { Camera } from './camera.js'

let adapter: GPUAdapter
export let device: GPUDevice

export const clearColor = { r: 1.0, g: 1.0, b: 1.0, a: 1.0 }
//export const clearColor = { r: 0.0, g: 0.1, b: 0.2, a: 1.0 }
export let format: GPUTextureFormat

let canvas: HTMLCanvasElement
let context: GPUCanvasContext

let depth: GPUTexture

export let cameraBuffer: GPUBuffer
export let renderPass: GPURenderPassEncoder
let encoder: GPUCommandEncoder

export function aspect(): number {
	return canvas.width / canvas.height
}

export async function Setup(width: number, height: number): Promise<HTMLCanvasElement | undefined> {
	if (window.navigator.gpu == undefined) {
		console.log('no navigator gpu')
		return undefined
	}
	adapter = await window.navigator.gpu.requestAdapter()
	if (adapter == null) {
		console.log('no adapter')
		return undefined
	}
	device = await adapter.requestDevice()
	if (device == null) {
		console.log('no device')
		return undefined
	}
	canvas = document.createElement('canvas')
	context = canvas.getContext('webgpu')

	format = context.getPreferredFormat(adapter)

	Resize(width, height)

	return canvas
}

export function Resize(width: number, height: number): void {
	context.configure({
		device:               device,
		format:               format,
		size:                 { width: width, height: height },
		compositingAlphaMode: 'opaque',
	})
	canvas.width = width
	canvas.height = height

	depth = device.createTexture({
		size: {
			width:  canvas.width,
			height: canvas.height,
		},
		format: 'depth32float',
		usage:  GPUTextureUsage.RENDER_ATTACHMENT,
	})
}

export function StartRender(camera: Camera): void {
	encoder = device.createCommandEncoder()
	renderPass = encoder.beginRenderPass({
		colorAttachments: [
			{
				clearValue: clearColor,
				storeOp:    'store',
				loadOp:     'clear',
				loadValue:  'load',
				view:       context.getCurrentTexture().createView(),
			},
		],
		depthStencilAttachment: {
			depthLoadOp:      'clear',
			depthClearValue:  1.0,
			depthStoreOp:     'store',
			stencilLoadOp:    'load',
			stencilStoreOp:   'store',
			depthLoadValue:   'load',
			stencilLoadValue: 'load',
			view:             depth.createView(),
		},
	})
	cameraBuffer = camera.Buffer()
}

export function FinishRender(): void {
	renderPass.end()
	device.queue.submit([encoder.finish()])
}

export function CreateBuffer(data: Float32Array | Uint32Array | Uint8Array, usage: GPUFlagsConstant): GPUBuffer {
	const size = data.byteLength < 80? 80: data.byteLength
	const buffer = device.createBuffer({
		size:             size,
		usage:            GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC | usage,
		mappedAtCreation: true,
	})
	new Uint8Array(buffer.getMappedRange()).set(new Uint8Array(data.buffer))
	buffer.unmap()
	return buffer
}

export function CreateEmptyBuffer(length: number, usage: GPUFlagsConstant): GPUBuffer {
	const buffer = device.createBuffer({
		size:             length,
		usage:            GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC | usage,
		mappedAtCreation: false,
	})
	return buffer
}

export function CopyBuffer(source: GPUBuffer, target: GPUBuffer, size: number) {
	const copyEncoder = device.createCommandEncoder()
	copyEncoder.copyBufferToBuffer(
		source /* source buffer */,
		0 /* source offset */,
		target /* destination buffer */,
		0 /* destination offset */,
		size /* size */,
	)
	const copyCommands = copyEncoder.finish()
	device.queue.submit([copyCommands])
}

export async function ReadBuffer(buffer: GPUBuffer, size: number): Promise<ArrayBuffer> {
	const temp = device.createBuffer({
		size:             size,
		usage:            GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
		mappedAtCreation: false,
	})
	// Encode commands for copying buffer to buffer.
	const copyEncoder = device.createCommandEncoder()
	copyEncoder.copyBufferToBuffer(
		buffer /* source buffer */,
		0 /* source offset */,
		temp /* destination buffer */,
		0 /* destination offset */,
		size /* size */,
	)
	const copyCommands = copyEncoder.finish()
	device.queue.submit([copyCommands])
	await temp.mapAsync(GPUMapMode.READ)
	const copyArrayBuffer = temp.getMappedRange()
	return copyArrayBuffer
}

export function NewModule(src: string): GPUShaderModule {
	const module = device.createShaderModule({
		code: src,
	})
	return module
}

export function ConvertURI(uri: string): string {
	return window.atob(uri.split(',')[1])
}
