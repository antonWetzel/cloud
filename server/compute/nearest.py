from numba import cuda, types
import numpy as np
from .shared import *


@cuda.jit(types.void(types.float32[:], types.uint32[:], types.uint32, types.uint32))
def nearest_iter(cloud, sur, n, k):
	"calculate k-nearest from nearest to farthest"
	id = cuda.grid(1)
	if id >= n: return
	offset = (id + 1) * k - 1
	p = get_point(cloud, id)
	last = 0.0
	last_idx = n

	#repeat k times
	for c in range(k):
		current: int
		dist = np.Infinity

		#iterate all points
		for i in range(n):
			o = get_point(cloud, i)
			d = dist_pow_2(p, o)
			if d < dist:
				if last < d:
					#current is nearer
					current = i
					dist = d
				elif last == d and last_idx < i:
					#same distance but smaller index
					current = i
					dist = d
					break
		sur[offset - c] = current
		last = dist
		last_idx = current


@cuda.jit(types.void(types.float32[:], types.uint32[:], types.uint32, types.uint32))
def nearest_list(cloud, sur, n, k):
	"calculate k-nearest with a sorted list of current nearest"
	id = cuda.grid(1)
	if id >= n: return
	offset = id * k
	p = get_point(cloud, id)
	i = 0 #current point

	#fill list with the first points
	for c in range(k):
		if (i == id):
			i += 1
		o = get_point(cloud, i)
		d = dist_pow_2(p, o)
		idx = 0
		for _ in range(c):
			if dist_pow_2(p, get_point(cloud, sur[offset + idx])) < d:
				break
			idx += 1
		for x in range(c, idx, -1):
			sur[offset + x] = sur[offset + x - 1]
		sur[offset + idx] = i
		i += 1
	dist = dist_pow_2(p, get_point(cloud, sur[offset]))

	#iterate remaining points
	while i < n:
		if (i == id):
			i += 1
			continue
		d = dist_pow_2(p, get_point(cloud, i))
		if d < dist:
			idx = 0
			while idx + 1 < k:
				next = sur[offset + idx + 1]
				if dist_pow_2(p, get_point(cloud, next)) < d:
					break
				sur[offset + idx] = next
				idx += 1
			sur[offset + idx] = i
			dist = dist_pow_2(p, get_point(cloud, sur[offset]))
		i += 1


@cuda.jit(types.void(types.float32[:], types.uint32[:], types.uint32, types.uint32))
def nearest_iter_sorted(cloud, sur, n, k):
	"calculate k-nearest from nearest to farthest with sorted input"
	id = cuda.grid(1)
	if id >= n: return
	offset = (id + 1) * k - 1
	p = get_point(cloud, id)
	last = 0
	last_idx = n

	#repeat k times
	for c in range(k):
		best: int
		dist = np.Infinity

		#iterate points with smaller index
		for i in range(id - 1, -1, -1):
			o = get_point(cloud, i)
			x_d = o[0] - p[0]
			if (x_d * x_d) > dist:
				break
			d = dist_pow_2(p, o)
			if d <= dist:
				if last < d:
					best = i
					dist = d
				elif last == d and last_idx < i:
					best = i
					dist = d
					break

		#iterate points with larger index
		for i in range(id + 1, n):
			o = get_point(cloud, i)
			x_d = o[0] - p[0]
			if (x_d * x_d) > dist:
				break
			d = dist_pow_2(p, o)
			if d < dist:
				if last < d:
					best = i
					dist = d
				elif last == d and last_idx < i:
					best = i
					dist = d
					break
		sur[offset - c] = best
		last = dist
		last_idx = best


@cuda.jit(types.void(types.float32[:], types.uint32[:], types.uint32, types.uint32))
def nearest_list_sorted(cloud, sur, n, k):
	"calculate k-nearest with a sorted list of current nearest with sorted input"
	id = cuda.grid(1)
	if id >= n: return
	offset = id * k
	p = get_point(cloud, id)
	if id < n / 2: #initialize with larger index
		dir = 1
		low = id - 1
		high = id + k + 1
	else: #initialize with smaller index
		dir = -1
		low = id - 1 - k
		high = id + 1
	for c in range(k): #initialize the list
		i = id + (1 + c) * dir
		o = get_point(cloud, i)
		d = dist_pow_2(p, o)
		idx = 0
		for _ in range(c):
			if dist_pow_2(p, get_point(cloud, sur[offset + idx])) < d: break
			idx += 1
		for x in range(c, idx, -1):
			sur[offset + x] = sur[offset + x - 1]
		sur[offset + idx] = i
	dist = dist_pow_2(p, get_point(cloud, sur[offset]))
	for i in range(low, -1, -1): #iterate remaining points with smaller index
		o = get_point(cloud, i)
		x_d = o[0] - p[0]
		if (x_d * x_d) > dist: break
		d = dist_pow_2(p, o)
		if d < dist:
			idx = 0
			while idx + 1 < k:
				next = sur[offset + idx + 1]
				if dist_pow_2(p, get_point(cloud, next)) < d: break
				sur[offset + idx] = next
				idx += 1
			sur[offset + idx] = i
			dist = dist_pow_2(p, get_point(cloud, sur[offset]))
	for i in range(high, n): #iterate remaining points with larger index
		o = get_point(cloud, i)
		x_d = o[0] - p[0]
		if (x_d * x_d) > dist: break
		d = dist_pow_2(p, o)
		if d < dist:
			idx = 0
			while idx + 1 < k:
				next = sur[offset + idx + 1]
				if dist_pow_2(p, get_point(cloud, next)) < d: break
				sur[offset + idx] = next
				idx += 1
			sur[offset + idx] = i
			dist = dist_pow_2(p, get_point(cloud, sur[offset]))
