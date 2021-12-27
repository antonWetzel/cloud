from typing import Tuple
from numpy.core.fromnumeric import shape
import scipy.sparse.linalg.eigen as eigen
import scipy.sparse as sparse
from numba import cuda, types, jit
from numba.core.errors import NumbaDeprecationWarning
import numpy as np
import warnings
from .shared import *
import time

warnings.simplefilter('ignore', category=NumbaDeprecationWarning)
Point = types.Tuple([types.float32, types.float32, types.float32])


def frequ(cloud: np.ndarray, sur: np.ndarray, n: int, k: int) -> np.ndarray:
	t = time.time()
	lapl = np.zeros((n, n), dtype=np.float32)
	#lapl = sparse.lil_matrix((n, n), dtype=np.float32)
	"""
	for i in range(n):
		for j in range(i * k, (i + 1) * k):
			x = sur[j]
			for c in range(x * k, (x + 1) * k):
				if (sur[c]) == i:
					lapl[i, i] -= 1
					lapl[x, x] -= 1
					lapl[i, x] += 1
					lapl[x, i] += 1
					break
	"""
	for i in range(n):

		for j in range(i * k, (i + 1) * k):
			x = sur[j]
			if i < x:
				lapl[i, i] -= 1
				lapl[x, x] -= 1
				lapl[i, x] += 1
				lapl[x, i] += 1

	c = 50
	t1 = time.time()
	print("\tgenerated laplace matrix", t1 - t)

	_, vectors = eigen.eigsh(lapl, c, sigma=0, which='LM')
	print("\tgenerated eigenvectors", time.time() - t1)
	m = vectors @ vectors.transpose() @ cloud.reshape(-1, 4)
	return m
