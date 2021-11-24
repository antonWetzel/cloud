import * as GPU from './gpu/header.js';
import * as Loader from './loader/header.js';
document.body.onload = async () => {
    const mode = document.getElementById('mode');
    const color = document.getElementById('color');
    const gridCheckbox = document.getElementById('grid');
    const display = document.getElementById('display');
    const canvas = await GPU.Setup(display.clientWidth, display.clientHeight);
    if (canvas == undefined) {
        display.remove();
        const error = document.createElement('div');
        error.className = 'error';
        const topLine = document.createElement('div');
        topLine.className = 'large';
        topLine.innerHTML = 'WebGPU not available';
        error.append(topLine);
        const botLine = document.createElement('div');
        botLine.className = 'normal';
        botLine.innerHTML =
            'Only tested with <a href="https://www.google.com/chrome">Google Chrome</a>';
        error.append(botLine);
        document.body.append(error);
        return;
    }
    display.append(canvas);
    const cam = new GPU.Camera(Math.PI / 4);
    cam.Translate(0, 5, 30);
    const increase = new GPU.Position();
    increase.Scale(5, 5, 5);
    const normal = new GPU.Position();
    const grid = Loader.Grid(10);
    let k = 64;
    let length = 50_000;
    let cloud = Loader.Sphere(length);
    let colors = Loader.Color(length);
    let nearest = undefined;
    let normals = undefined;
    let curvature = undefined;
    window.CreateForm = async (name) => {
        const size = document.getElementById('size');
        length = parseInt(size.value);
        cloud.destroy();
        colors.destroy();
        switch (name) {
            case 'sphere':
                cloud = Loader.Sphere(length);
                break;
            case 'cube':
                cloud = Loader.Cube(length);
                break;
            case 'map':
                [cloud, length] = Loader.Map(length);
                break;
            case 'bunny': {
                const response = await fetch('https://raw.githubusercontent.com/PointCloudLibrary/pcl/master/test/bunny.pcd');
                const content = await (await response.blob()).arrayBuffer();
                const result = Loader.PCD(content);
                if (result != undefined) {
                    [cloud, length] = result;
                }
                else {
                    alert('pcd error');
                }
                break;
            }
            case 'statue': {
                const response = await fetch('https://raw.githubusercontent.com/PointCloudLibrary/pcl/master/test/rops_cloud.pcd');
                const content = await (await response.blob()).arrayBuffer();
                const result = Loader.PCD(content);
                if (result != undefined) {
                    [cloud, length] = result;
                }
                else {
                    alert('pcd error');
                }
                break;
            }
        }
        colors = Loader.Color(length);
        if (nearest != undefined) {
            nearest.destroy();
            nearest = undefined;
        }
        if (normals != undefined) {
            normals.destroy();
            normals = undefined;
        }
        if (curvature != undefined) {
            curvature.destroy();
            curvature = undefined;
        }
        mode.value = 'points';
        color.value = 'color';
    };
    window.ShowText = (text) => {
        const hint = document.createElement('div');
        hint.textContent = text;
        hint.className = 'hint';
        document.body.append(hint);
        setTimeout(() => {
            hint.remove();
        }, 5000);
    };
    window.Compute = async (name) => {
        switch (name) {
            case 'nearestList':
            case 'nearestIter':
            case 'nearestSort':
                if (nearest != undefined) {
                    nearest.destroy();
                }
                mode.value = 'connections';
                const kDiv = document.getElementById('k');
                k = parseInt(kDiv.value);
                nearest = GPU.CreateEmptyBuffer(length * k * 4, GPUBufferUsage.STORAGE);
                switch (name) {
                    case 'nearestList':
                        GPU.Compute('kNearestList', length, [[k], []], [cloud, nearest]);
                        break;
                    case 'nearestIter':
                        GPU.Compute('kNearestIter', length, [[k], []], [cloud, nearest]);
                        break;
                    case 'nearestSort':
                        const newCloud = GPU.CreateEmptyBuffer(length * 16, GPUBufferUsage.VERTEX | GPUBufferUsage.STORAGE);
                        const newColor = GPU.CreateEmptyBuffer(length * 16, GPUBufferUsage.VERTEX | GPUBufferUsage.STORAGE);
                        GPU.Compute('sort', length, [[], []], [cloud, colors, newCloud, newColor]);
                        cloud.destroy();
                        colors.destroy();
                        cloud = newCloud;
                        colors = newColor;
                        GPU.Compute('kNearestSorted', length, [[k], []], [cloud, nearest]);
                        break;
                }
                break;
            case 'triangulateAll':
                k = GPU.TriangulateK;
                if (nearest != undefined) {
                    nearest.destroy();
                }
                mode.value = 'connections';
                nearest = GPU.CreateEmptyBuffer(length * k * 4, GPUBufferUsage.STORAGE);
                GPU.Compute('triangulateAll', length, [[], []], [cloud, nearest]);
                break;
            case 'triangulateNear':
                if (nearest == undefined) {
                    alert('please calculate nearest first');
                }
                else {
                    const copy = GPU.CreateEmptyBuffer(length * GPU.TriangulateK * 4, GPUBufferUsage.STORAGE);
                    GPU.Compute('triangulateNearest', length, [[k], []], [cloud, nearest, copy]);
                    nearest.destroy();
                    nearest = copy;
                    k = GPU.TriangulateK;
                    mode.value = 'connections';
                    break;
                }
                break;
            case 'cleanDang':
            case 'cleanLong':
                if (nearest == undefined) {
                    alert('please calculate the connections first');
                    break;
                }
                mode.value = 'connections';
                switch (name) {
                    case 'cleanDang':
                        GPU.Compute('cleanDang', length, [[k], []], [nearest]);
                        break;
                    case 'cleanLong':
                        GPU.Compute('cleanLong', length, [[k], []], [cloud, nearest]);
                        break;
                }
                break;
            case 'normalPlane':
            case 'normalTriang':
                if (nearest == undefined) {
                    alert('please calculate the connections first');
                    break;
                }
                color.value = 'normal';
                if (normals == undefined) {
                    normals = GPU.CreateEmptyBuffer(length * 16, GPUBufferUsage.VERTEX | GPUBufferUsage.STORAGE);
                }
                switch (name) {
                    case 'normalPlane':
                        GPU.Compute('normalLinear', length, [[k], []], [cloud, nearest, normals]);
                        break;
                    case 'normalTriang':
                        GPU.Compute('normalTriang', length, [[k], []], [cloud, nearest, normals]);
                        break;
                }
                break;
            case 'curvaturePlane':
            case 'curvatureNormal':
                if (normals == undefined) {
                    alert('please calculate the normals first');
                    break;
                }
                color.value = 'curve';
                if (curvature == undefined) {
                    curvature = GPU.CreateEmptyBuffer(length * 16, GPUBufferUsage.VERTEX | GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC);
                }
                switch (name) {
                    case 'curvatureNormal':
                        GPU.Compute('curvatureAngle', length, [[k], []], [cloud, nearest, normals, curvature]);
                        break;
                    case 'curvaturePlane':
                        GPU.Compute('curvatureDist', length, [[k], []], [cloud, nearest, normals, curvature]);
                        break;
                }
                break;
            case 'filterCurve':
                if (curvature == undefined) {
                    alert('please calculate curvature first');
                    break;
                }
                const tDiv = document.getElementById('threshhold');
                const t = parseFloat(tDiv.value);
                const newCloud = GPU.CreateEmptyBuffer(length * 16, GPUBufferUsage.VERTEX | GPUBufferUsage.STORAGE);
                const newColor = GPU.CreateEmptyBuffer(length * 16, GPUBufferUsage.VERTEX | GPUBufferUsage.STORAGE);
                GPU.Compute('reduceP1', length, [[], [t]], [cloud, colors, curvature, newCloud, newColor]);
                const result = GPU.Compute('reduceP2', 1, [[length, 0], [t]], [curvature], true);
                length = new Uint32Array(await GPU.ReadBuffer(result, 3 * 4))[2];
                console.log('length:', length);
                result.destroy();
                cloud.destroy();
                colors.destroy();
                nearest.destroy();
                normals.destroy();
                curvature.destroy();
                cloud = newCloud;
                colors = newColor;
                nearest = undefined;
                normals = undefined;
                curvature = undefined;
                break;
            default:
                alert('wrong name: ' + name);
        }
    };
    display.onwheel = (ev) => {
        const scale = 1 + ev.deltaY / 1000;
        increase.Scale(scale, scale, scale);
        ev.preventDefault();
        ev.stopImmediatePropagation();
    };
    document.body.onresize = () => {
        GPU.Resize(display.clientWidth, display.clientHeight);
        cam.UpdateSize();
    };
    const keys = {};
    document.body.onkeydown = (ev) => {
        keys[ev.code] = true;
    };
    document.body.onkeyup = (ev) => {
        delete keys[ev.code];
    };
    display.onmousemove = (ev) => {
        if ((ev.buttons & 1) != 0) {
            cam.RotateX(-ev.movementY / 200);
            cam.RotateGlobalY(-ev.movementX / 200);
        }
    };
    let last = await new Promise(requestAnimationFrame);
    const run = true;
    while (run) {
        const time = await new Promise(requestAnimationFrame);
        const delta = time - last;
        if (delta > 25) {
            console.log(delta);
        }
        else {
            const dist = delta / 50;
            const move = (key, x, y, z) => {
                if (keys[key] != undefined) {
                    cam.Translate(x * dist, y * dist, z * dist);
                }
            };
            move('KeyW', 0, 0, -1);
            move('KeyA', -1, 0, 0);
            move('KeyS', 0, 0, 1);
            move('KeyD', 1, 0, 0);
        }
        let c = undefined;
        switch (color.value) {
            case 'color':
                c = colors;
                break;
            case 'normal':
                if (normals == undefined) {
                    c = colors;
                    color.value = 'color';
                    alert('normals not calculated');
                }
                else {
                    c = normals;
                }
                break;
            case 'curve':
                if (curvature == undefined) {
                    c = colors;
                    color.value = 'color';
                    alert('curvature not calculated');
                }
                else {
                    c = curvature;
                }
                break;
        }
        GPU.StartRender(cam);
        if (gridCheckbox.checked) {
            GPU.Lines(normal, grid.length, grid.positions, grid.colors);
        }
        switch (mode.value) {
            case 'points':
                GPU.Cloud(increase, 0.015, length, cloud, c);
                break;
            case 'connections':
                if (nearest == undefined) {
                    mode.value = 'points';
                    GPU.Cloud(increase, 0.015, length, cloud, c);
                    alert('connections not calculated');
                }
                else {
                    GPU.KNearest(increase, cloud, c, nearest, k, length);
                }
                break;
            case 'polygons':
                if (nearest == undefined) {
                    mode.value = 'points';
                    GPU.Cloud(increase, 0.015, length, cloud, c);
                    alert('connections not calculated');
                }
                else {
                    GPU.Triangulate(increase, cloud, c, nearest, k, length);
                }
                break;
        }
        GPU.FinishRender();
        last = time;
    }
};
