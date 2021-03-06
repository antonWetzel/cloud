from numba import cuda, types, jit
import numpy as np
from .shared import *


@cuda.jit(types.void(types.float32[:], types.uint32[:], types.float32[:], types.uint32, types.uint32))
def edge_normal(cloud, sur, normal, n, k):
	"calculate normal with triangulation"
	id = cuda.grid(1)
	if id >= n: return
	offset = id * k
	p = get_point(cloud, id)
	last = get_point(cloud, sur[offset])
	n = (0.0, 0.0, 0.0)
	for i in range(1, k):
		other = sur[offset + i]
		if other == id:
			break
		current = get_point(cloud, other)
		n = add(n, cross(sub(last, p), sub(current, p)))
		last = current
	n = normalize(n)
	normal[id * 4 + 0] = n[0]
	normal[id * 4 + 1] = n[1]
	normal[id * 4 + 2] = n[2]
	normal[id * 4 + 3] = 0


@cuda.jit(types.void(types.float32[:], types.uint32[:], types.float32[:], types.float32[:], types.uint32, types.uint32))
def edge_curve(cloud, sur, normal, edge, n, k):
	"calculate curvature with normal and triangulation"
	id = cuda.grid(1)
	if id >= n: return
	offset = id * k
	p = get_point(cloud, id)
	nor = get_point(normal, id)
	off = 0.0
	for i in range(k):
		other = sur[offset + i]
		if other == id:
			break
		off += abs(dot(normalize(sub(p, get_point(cloud, other))), nor))
	off /= i
	edge[id * 4 + 0] = off
	edge[id * 4 + 1] = 0
	edge[id * 4 + 2] = 0
	edge[id * 4 + 3] = 0


@cuda.jit(types.void(types.float32[:], types.int32[:], types.float32[:], types.uint32, types.uint32))
def edge_max(curve, sur, new_curve, n, k):
	"find lines with maximal curvature"
	id = cuda.grid(1)
	if id >= n: return
	mode = False
	threshold = curve[id * 4]
	offset = id * k
	new_curve[id * 4 + 1] = 0
	new_curve[id * 4 + 2] = 0
	new_curve[id * 4 + 3] = 0
	res = threshold
	for i in range(k):
		other = sur[offset + i]
		if other == id:
			break
		new_mode = curve[other * 4] > threshold
		if mode and new_mode:
			res = 0
			break
		mode = new_mode
	if mode and curve[sur[offset] * 4] > threshold:
		res = 0
	new_curve[id * 4 + 0] = res


@cuda.jit(types.void(types.float32[:], types.float32[:], types.float32, types.uint32))
def edge_threshold(curve, new_curve, threshold, n):
	"binary classification with curvature"
	id = cuda.grid(1)
	if id >= n: return
	new_curve[id * 4 + 0] = 1 if (curve[id * 4] >= threshold) else 0
	new_curve[id * 4 + 1] = 0
	new_curve[id * 4 + 2] = 0
	new_curve[id * 4 + 3] = 0


@jit(types.Tuple([types.int32, types.float32[:]])(types.float32[:], types.float32[:], types.int32))
def edge_reduce(cloud, edge, n):
	"remove points with low curvature, use edge_threshold first"
	c = 0
	for i in range(n):
		if edge[i * 4] >= 1:
			c += 1
	new_cloud = np.empty(c * 4, dtype=np.float32)
	c = 0
	for i in range(n):
		if edge[i * 4] >= 0.5:
			new_cloud[c * 4 + 0] = cloud[i * 4 + 0]
			new_cloud[c * 4 + 1] = cloud[i * 4 + 1]
			new_cloud[c * 4 + 2] = cloud[i * 4 + 2]
			c += 1
	return (c, new_cloud)
