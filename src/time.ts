import * as GPU from './gpu/header.js'
import * as Loader from './loader/header.js'


const forms = ['sphere', 'cube', 'map', 'bunny', 'statue'] as const
const iterations = 50
let result = ''

function Save(name: string) {
	const element = document.createElement('a')
	element.setAttribute('href','data:text/plain;charset=utf-8,' + encodeURIComponent(result))
	element.setAttribute('download', name + '.csv')
	document.body.appendChild(element)
	element.click()
	result = ''
}
export async function MeasureTimes(): Promise<void> {
	for (let c = 0; c < 3; c++) {
		for (let i = 1; i <= 32; i *= 2) {
			const name = forms[c]
			await WithK(name, i * 1024)
			Save(name + ' ' + i.toString())
		}
	}
	for (let c = 3; c < 5; c++) {
		const name = forms[c]
		await WithK(name, 0)
		Save(name)
	}
}

async function Generate(name: typeof forms[number], length = 1024) : Promise<[GPUBuffer, number]>{
	switch (name) {
	case 'sphere':
		return [Loader.Sphere(length), length]
	case 'cube':
		return [Loader.Cube(length), length]
	case 'map':
		return Loader.Map(length)
	case 'bunny':
	case 'statue':
		let url = ''
		switch (name) {
		case 'bunny':
			url = 'https://raw.githubusercontent.com/PointCloudLibrary/pcl/master/test/bunny.pcd'
			break
		case 'statue':
			url = 'https://raw.githubusercontent.com/PointCloudLibrary/pcl/master/test/rops_cloud.pcd'
			break
		}
		const response = await fetch(url)
		const content = await (await response.blob()).arrayBuffer()
		const result = Loader.PCD(content)
		if (result != undefined) {
			return result
		} else {
			console.log('generate pcd error')
			return undefined as [GPUBuffer, number]
		}
	}
}

async function WithK(name: typeof forms[number], l: number) {
	for (let k = 64; k >= 1; k /= 2) {
		const [cloud, length] = await Generate(name, l)
		await Order(cloud, length , k, name)
		cloud.destroy()
	}
}

async function Order(cloud: GPUBuffer, length: number, k: number, name: string) {

	const nearest = GPU.CreateEmptyBuffer(length * k * 4, GPUBufferUsage.STORAGE)
	const color = GPU.CreateEmptyBuffer(length*4*3, GPUBufferUsage.STORAGE)
	const triangulate = GPU.CreateEmptyBuffer(length*16*3, GPUBufferUsage.STORAGE)
	const cloudSorted = GPU.CreateEmptyBuffer(length*4*3, GPUBufferUsage.STORAGE)
	const colorSorted = GPU.CreateEmptyBuffer(length*4*3, GPUBufferUsage.STORAGE)
	const nearestDummy = GPU.CreateEmptyBuffer(length * k * 4, GPUBufferUsage.STORAGE)
	const normal = GPU.CreateEmptyBuffer(length*4*3, GPUBufferUsage.STORAGE)
	const curve = GPU.CreateEmptyBuffer(length*4*3, GPUBufferUsage.STORAGE)

	await Compute(length, k, name, 'kNearestIter',  [[k], []], [cloud, nearest], 'unsorted')
	await Compute(length, k, name, 'kNearestList',  [[k], []], [cloud, nearest], 'unsorted')
	await Compute(length, k, name, 'triangulateAll',  [[], []], [cloud, nearest], 'unsorted')

	await Compute(length, k, name, 'sort',  [[], []], [cloud, color, cloudSorted, colorSorted])
	await Compute(length, k, name, 'kNearestSorted',  [[k], []], [cloudSorted, nearest], 'sorted')
	await Compute(length, k, name, 'kNearestIter',  [[k], []], [cloudSorted, nearest], 'sorted')
	await Compute(length, k, name, 'kNearestList',  [[k], []], [cloudSorted, nearest], 'sorted')
	await Compute(length, k, name, 'triangulateAll',  [[], []], [cloudSorted, triangulate], 'sorted')
	
	await Compute(length, k, name, 'triangulateNearest', [[], []], [cloud, nearest, triangulate])

	await Compute(length, k, name, 'cleanDang', [[k], []], [nearest, nearestDummy])
	await Compute(length, k, name, 'cleanLong', [[k], []], [cloud, nearest, nearestDummy])

	await Compute(length, k, name, 'normalLinear', [[k], []], [cloud, nearest, normal])
	await Compute(length, k, name, 'normalTriang', [[k], []], [cloud, nearest, normal])

	await Compute(length, k, name, 'curvaturePoints', [[k], []], [cloud, nearest, normal, curve])
	await Compute(length, k, name, 'curvatureNormal', [[k], []], [cloud, nearest, normal, curve])

	await Compute(length, k, name, 'reduceAnomaly', [[0], [0.1]], [cloud, color, curve, colorSorted, colorSorted], '0.2')
	await Compute(length, k, name, 'reduceAnomaly', [[0], [0.1]], [cloud, color, curve, cloudSorted, colorSorted], '0.5')
	await Compute(length, k, name, 'reduceLow', [[0], [0.1]], [cloud, color, curve, cloudSorted, colorSorted], '0.1')
	await Compute(length, k, name, 'reduceLow', [[0], [0.1]], [cloud, color, curve, cloudSorted, colorSorted], '0.2')
	await Compute(length, k, name, 'noise', [[k], [0.5]], [cloud, normal, curve, cloudSorted], '0.5')
	await Compute(length, k, name, 'noise', [[k], [1.0]], [cloud, normal, curve, cloudSorted], '1.0')

	nearest.destroy()
	color.destroy()
	triangulate.destroy()
	colorSorted.destroy()
	cloudSorted.destroy()
	nearestDummy.destroy()
	normal.destroy()
	curve.destroy()
}

async function Compute(
	length: number,
	k: number,
	name: string,
	compute: (typeof GPU.Compute extends (...args: infer A) => any? A : never)[0],
	parameter: (typeof GPU.Compute extends (...args: infer A) => any? A : never)[2],
	buffers: (typeof GPU.Compute extends (...args: infer A) => any? A : never)[3],
	note = '-',
) {
	const start = Date.now()
	for (let i = 0; i < iterations; i++) {
		const buffer = GPU.Compute(compute, length, parameter, buffers, true)
		await GPU.ReadBuffer(buffer, 0)
		buffer.destroy()
	}
	const r =
		name+','+
		length.toString()+','+
		compute +','+
		k.toString()+','+
		((Date.now() - start) / iterations).toString()+','+
		note+'\n'
	result += r
	console.log(r)
}
