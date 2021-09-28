import * as GPU from './gpu/gpu.js';
import { Lines } from './gpu/lines.js';
import { CreateSphere } from './loader/sphere.js';
import { Camera } from './gpu/camera.js';
import { Empty } from './gpu/empty.js';
import { Light } from './gpu/light.js';
document.body.onload = async () => {
    const display = document.getElementById('display');
    const canvas = await GPU.Setup(display.clientWidth, display.clientHeight, 1.0);
    display.append(canvas);
    const scene = new Empty();
    const cam = new Camera(Math.PI / 4);
    cam.Translate(0, 5, 30);
    const light = new Light(50);
    light.Translate(0, 0, 10);
    const light2 = new Light(50);
    const cloud = (await CreateSphere(100_000, 0.5, 1.0, 1.0, 0.01)).node;
    cloud.Scale(25, 25, 25);
    scene.children.push(cloud);
    const grid = Lines.Grid(10);
    //scene.children.push(grid)
    display.onwheel = (ev) => {
        let fov = cam.fieldOfView * (1 + ev.deltaY / 1000);
        if (fov < Math.PI / 10) {
            fov = Math.PI / 10;
        }
        if (fov > (Math.PI * 9) / 10) {
            fov = (Math.PI * 9) / 10;
        }
        cam.fieldOfView = fov;
    };
    document.body.onresize = () => {
        GPU.Resize(display.clientWidth, display.clientHeight);
        cam.UpdateSize();
    };
    let lights = 0;
    const key = {};
    document.body.onkeydown = (ev) => {
        key[ev.code] = true;
        switch (ev.code) {
            case 'KeyL':
                lights = (lights + 1) % 4;
                break;
            case 'KeyH':
                makeHint('Left mouse button + move: rotate camera\n' +
                    'Middle mouse button + move: rotate first light\n' +
                    'Mouse wheel: change field of view (zoom)\n' +
                    'Key QWER: move camera\n' +
                    'Key L: switch active lights');
                break;
            case 'KeyX': {
                const k = 2;
                const lines = cloud.kNearest(k, 0.5, 1.0, 1.0);
                const x = new Lines(cloud.buffer.length * 2 * k, lines.positions, lines.colors);
                cloud.children.push(x);
                break;
            }
        }
    };
    document.body.onkeyup = (ev) => {
        key[ev.code] = undefined;
    };
    makeHint("press 'Key H' for help");
    display.onmousemove = (ev) => {
        if ((ev.buttons & 1) != 0) {
            cam.RotateX(-ev.movementY / 200);
            cam.RotateGlobalY(-ev.movementX / 200);
        }
        else if ((ev.buttons & 4) != 0) {
            light.RotateX(ev.movementY / 200);
            light.RotateGlobalY(ev.movementX / 200);
        }
    };
    let last = undefined;
    requestAnimationFrame((time) => {
        last = time;
    });
    function Draw(time) {
        const delta = time - last;
        const dist = delta / 50;
        if (key['KeyW'] != undefined) {
            cam.Translate(0, 0, -dist);
        }
        if (key['KeyD'] != undefined) {
            cam.Translate(dist, 0, 0);
        }
        if (key['KeyS'] != undefined) {
            cam.Translate(0, 0, dist);
        }
        if (key['KeyA'] != undefined) {
            cam.Translate(-dist, 0, 0);
        }
        if (key['KeyF'] != undefined) {
            cam.Translate(0, -dist, 0);
        }
        if (key['KeyR'] != undefined) {
            cam.Translate(0, dist, 0);
        }
        const l = [];
        if (lights % 2 != 0) {
            l.push(light);
        }
        if ((lights >> 1) % 2 != 0) {
            l.push(light2);
        }
        cam.Render(scene, l);
        last = time;
        requestAnimationFrame(Draw);
    }
    requestAnimationFrame(Draw);
};
function makeHint(text) {
    const hint = document.createElement('div');
    hint.textContent = text;
    hint.className = 'hint';
    setTimeout(() => {
        hint.remove();
    }, 5000);
    document.body.append(hint);
}
