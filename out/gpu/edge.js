import * as GPU from './gpu.js';
import * as Module from './module.js';
import { GetServerFile } from '../helper/file.js';
let computePipeline = undefined;
export async function Compute(cloud, nearest, colors, k, length) {
    if (computePipeline == undefined) {
        computePipeline = GPU.device.createComputePipeline({
            compute: {
                module: Module.New(await GetServerFile('../shaders/compute/edge.wgsl')),
                entryPoint: 'main',
            },
        });
    }
    const param = new Uint32Array([length, k]);
    const buffer = GPU.CreateBuffer(param, GPUBufferUsage.STORAGE);
    const group = GPU.device.createBindGroup({
        layout: computePipeline.getBindGroupLayout(0),
        entries: [
            {
                binding: 0,
                resource: { buffer: buffer },
            },
            {
                binding: 1,
                resource: { buffer: cloud },
            },
            {
                binding: 2,
                resource: { buffer: nearest },
            },
            {
                binding: 3,
                resource: { buffer: colors },
            },
        ],
    });
    const encoder = GPU.device.createCommandEncoder();
    const compute = encoder.beginComputePass({});
    compute.setPipeline(computePipeline);
    compute.setBindGroup(0, group);
    compute.dispatch(Math.ceil(length / 256));
    compute.endPass();
    GPU.device.queue.submit([encoder.finish()]);
}