import * as GPU from '../gpu/gpu.js';
export function CreateGrid(amount) {
    const positions = new Float32Array((amount * 4 + 3) * 8);
    const colors = new Float32Array((amount * 4 + 3) * 8);
    const addLine = (idx, start, end, color, endColor = undefined) => {
        if (endColor == undefined) {
            endColor = color;
        }
        idx *= 8;
        positions[idx + 0] = start.x;
        positions[idx + 1] = start.y;
        positions[idx + 2] = start.z;
        colors[idx + 0] = color.x;
        colors[idx + 1] = color.y;
        colors[idx + 2] = color.z;
        positions[idx + 4] = end.x;
        positions[idx + 5] = end.y;
        positions[idx + 6] = end.z;
        colors[idx + 4] = endColor.x;
        colors[idx + 5] = endColor.y;
        colors[idx + 6] = endColor.z;
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
    return {
        length: (amount * 4 + 3) * 2,
        positions: GPU.CreateBuffer(positions, GPUBufferUsage.VERTEX | GPUBufferUsage.STORAGE),
        colors: GPU.CreateBuffer(colors, GPUBufferUsage.VERTEX | GPUBufferUsage.STORAGE),
    };
}
