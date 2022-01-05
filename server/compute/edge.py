from numba import cuda, types
import numpy as np
from .shared import *


@cuda.jit(types.void(types.float32[:], types.uint32[:], types.float32[:], types.uint32, types.uint32))
def edge(cloud, sur, edge, n, k):
	id = cuda.grid(1)
	if id >= n:
		return
	p = get_point(cloud, id)
	avg = (0.0, 0.0, 0.0)
	dist = 0
	offset = id * k
	for i in range(k):
		other = sur[offset + i]
		other = get_point(cloud, other)
		avg = add(avg, other)
		dist += length(sub(p, other))
	norm = 1 / k
	avg = (avg[0] * norm, avg[1] * norm, avg[2] * norm)
	dist *= norm

	edge[id * 4 + 0] = length(sub(p, avg)) / dist
	edge[id * 4 + 1] = 0
	edge[id * 4 + 2] = 0
	edge[id * 4 + 3] = 0


@cuda.jit(types.void(types.float32[:], types.float32, types.uint32))
def threshhold(curve, threshhold, n):
	id = cuda.grid(1)
	if id >= n:
		return
	if curve[id * 4] > threshhold:
		curve[id * 4] = 1
	else:
		curve[id * 4] = 0
