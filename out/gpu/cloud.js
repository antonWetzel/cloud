import * as GPU from './gpu.js';
import * as Module from './module.js';
let quadBuffer = undefined;
let pipeline = undefined;
export async function Render(position, radius, length, positions, colors) {
    if (pipeline == undefined || quadBuffer == undefined) {
        const src = await (await fetch('./render/cloud.wgsl')).text();
        const module = Module.New(src);
        pipeline = GPU.device.createRenderPipeline({
            vertex: {
                module: module,
                entryPoint: 'vertexMain',
                buffers: [
                    {
                        attributes: [
                            {
                                shaderLocation: 0,
                                offset: 0 * 4,
                                format: 'float32x2',
                            },
                        ],
                        arrayStride: 2 * 4,
                        stepMode: 'vertex',
                    },
                    {
                        attributes: [
                            {
                                shaderLocation: 1,
                                offset: 0 * 4,
                                format: 'float32x3',
                            },
                        ],
                        arrayStride: 4 * 4,
                        stepMode: 'instance',
                    },
                    {
                        attributes: [
                            {
                                shaderLocation: 2,
                                offset: 0 * 4,
                                format: 'float32x3',
                            },
                        ],
                        arrayStride: 4 * 4,
                        stepMode: 'instance',
                    },
                ],
            },
            fragment: {
                module: module,
                entryPoint: 'fragmentMain',
                targets: [
                    {
                        format: GPU.format,
                    },
                ],
            },
            depthStencil: {
                format: 'depth32float',
                depthWriteEnabled: true,
                depthCompare: 'less',
            },
            primitive: {
                topology: 'triangle-strip',
                stripIndexFormat: 'uint32',
                cullMode: 'back',
            },
        });
        quadBuffer = GPU.CreateBuffer(new Float32Array([-1.0, -1.0, 1.0, -1.0, -1.0, 1.0, 1.0, 1.0]), GPUBufferUsage.VERTEX);
    }
    const array = new Float32Array(16 + 2);
    position.Save(array, 0);
    array[16] = radius;
    array[17] = GPU.aspect();
    const buffer = GPU.CreateBuffer(array, GPUBufferUsage.UNIFORM);
    GPU.renderPass.setPipeline(pipeline);
    const group = GPU.device.createBindGroup({
        layout: pipeline.getBindGroupLayout(0),
        entries: [
            {
                binding: 0,
                resource: { buffer: GPU.cameraBuffer },
            },
            {
                binding: 1,
                resource: { buffer: buffer },
            },
        ],
    });
    GPU.renderPass.setBindGroup(0, group);
    GPU.renderPass.setVertexBuffer(0, quadBuffer);
    GPU.renderPass.setVertexBuffer(1, positions);
    GPU.renderPass.setVertexBuffer(2, colors);
    GPU.renderPass.draw(4, length);
}
