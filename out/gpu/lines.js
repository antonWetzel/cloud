import * as GPU from './gpu.js';
import * as Module from './module.js';
import * as Object from './node.js';
import { GetServerFile } from '../helper/file.js';
export class Lines extends Object.Node {
    static pipeline;
    static async Setup() {
        const src = await GetServerFile('../shaders/render/lines.wgsl');
        const module = Module.New(src);
        Lines.pipeline = GPU.device.createRenderPipeline({
            vertex: {
                module: module,
                entryPoint: 'vertexMain',
                buffers: [
                    {
                        attributes: [
                            {
                                shaderLocation: 0,
                                offset: 0 * 4,
                                format: 'float32x3',
                            },
                        ],
                        arrayStride: 3 * 4,
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
                        arrayStride: 3 * 4,
                        stepMode: 'vertex',
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
                topology: 'line-list',
            },
        });
    }
    static Grid(amount) {
        const positions = new Float32Array((amount * 4 + 3) * 6);
        const colors = new Float32Array((amount * 4 + 3) * 6);
        const addLine = (idx, start, end, color, endColor = undefined) => {
            if (endColor == undefined) {
                endColor = color;
            }
            idx *= 6;
            positions[idx + 0] = start.x;
            positions[idx + 1] = start.y;
            positions[idx + 2] = start.z;
            positions[idx + 3] = end.x;
            positions[idx + 4] = end.y;
            positions[idx + 5] = end.z;
            colors[idx + 0] = color.x;
            colors[idx + 1] = color.y;
            colors[idx + 2] = color.z;
            colors[idx + 3] = endColor.x;
            colors[idx + 4] = endColor.y;
            colors[idx + 5] = endColor.z;
        };
        for (let i = -amount; i <= amount; i++) {
            if (i == 0) {
                continue;
            }
            let idx;
            if (i < 0) {
                idx = i;
            }
            else if (i == 0) {
                continue;
            }
            else {
                idx = i - 1;
            }
            addLine(amount * 1 + idx, { x: i, y: 0, z: amount }, { x: i, y: 0, z: -amount }, { x: 1, y: 1, z: 1 });
            addLine(amount * 3 + idx, { x: amount, y: 0, z: i }, { x: -amount, y: 0, z: i }, { x: 1, y: 1, z: 1 });
        }
        addLine(amount * 4 + 0, { x: -amount, y: 0, z: 0 }, { x: amount, y: 0, z: 0 }, { x: 1, y: 1, z: 1 }, { x: 1, y: 0, z: 0 });
        addLine(amount * 4 + 1, { x: 0, y: -amount, z: 0 }, { x: 0, y: amount, z: 0 }, { x: 1, y: 1, z: 1 }, { x: 0, y: 1, z: 0 });
        addLine(amount * 4 + 2, { x: 0, y: 0, z: -amount }, { x: 0, y: 0, z: amount }, { x: 1, y: 1, z: 1 }, { x: 0, y: 0, z: 1 });
        return Lines.FromArray(positions, colors);
    }
    data;
    constructor(length, positions, colors) {
        super();
        this.data = {
            length: length,
            positions: positions,
            colors: colors,
        };
    }
    static FromArray(positions, colors) {
        return new Lines(positions.length / 3, GPU.CreateBuffer(positions, GPUBufferUsage.VERTEX), GPU.CreateBuffer(colors, GPUBufferUsage.VERTEX));
    }
    SubRender(projection, view, model, renderPass) {
        const array = new Float32Array(16 * 3);
        projection.Save(array, 0);
        view.Save(array, 16);
        model.Save(array, 32);
        const buffer = GPU.CreateBuffer(array, GPUBufferUsage.UNIFORM);
        renderPass.setPipeline(Lines.pipeline);
        const group = GPU.device.createBindGroup({
            layout: Lines.pipeline.getBindGroupLayout(0),
            entries: [
                {
                    binding: 0,
                    resource: { buffer: buffer },
                },
            ],
        });
        renderPass.setBindGroup(0, group);
        renderPass.setVertexBuffer(0, this.data.positions);
        renderPass.setVertexBuffer(1, this.data.colors);
        renderPass.draw(this.data.length);
    }
    SubShadow = undefined;
    SubMap = undefined;
    GetPipeline() {
        return Lines.pipeline;
    }
}
