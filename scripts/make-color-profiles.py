"""Developer-only: generate standard SDR RGB profiles using an existing Little CMS DLL.
The generated files are committed; production and CI require no Python or DLL.
Usage: python scripts/make-color-profiles.py PATH_TO_LCMS_DLL
"""
import ctypes as c
import sys
from pathlib import Path
class xyY(c.Structure):
    _fields_ = [('x', c.c_double), ('y', c.c_double), ('Y', c.c_double)]
class Primaries(c.Structure):
    _fields_ = [('red', xyY), ('green', xyY), ('blue', xyY)]
cms = c.CDLL(sys.argv[1])
cms.cmsBuildParametricToneCurve.argtypes = [c.c_void_p, c.c_int, c.POINTER(c.c_double)]
cms.cmsBuildParametricToneCurve.restype = c.c_void_p
cms.cmsCreateRGBProfile.argtypes = [c.POINTER(xyY), c.POINTER(Primaries), c.POINTER(c.c_void_p)]
cms.cmsCreateRGBProfile.restype = c.c_void_p
cms.cmsSaveProfileToMem.argtypes = [c.c_void_p, c.c_void_p, c.POINTER(c.c_uint32)]
cms.cmsCloseProfile.argtypes = [c.c_void_p]
cms.cmsFreeToneCurve.argtypes = [c.c_void_p]
cms.cmsSetProfileVersion.argtypes = [c.c_void_p, c.c_double]
cms.cmsMLUalloc.argtypes = [c.c_void_p, c.c_uint32]
cms.cmsMLUalloc.restype = c.c_void_p
cms.cmsMLUsetASCII.argtypes = [c.c_void_p, c.c_char_p, c.c_char_p, c.c_char_p]
cms.cmsWriteTag.argtypes = [c.c_void_p, c.c_uint32, c.c_void_p]
cms.cmsMLUfree.argtypes = [c.c_void_p]
white = xyY(.3127, .3290, 1.)
gamut = {
    1: Primaries(xyY(.64,.33,1),xyY(.30,.60,1),xyY(.15,.06,1)),
    12: Primaries(xyY(.68,.32,1),xyY(.265,.69,1),xyY(.15,.06,1)),
    9: Primaries(xyY(.708,.292,1),xyY(.170,.797,1),xyY(.131,.046,1)),
}
for primaries, transfer in [(1,1),(12,13),(12,1),(9,13),(9,1)]:
    params = [2.4,1/1.055,.055/1.055,1/12.92,.04045] if transfer == 13 else [1/.45,1/1.099,.099/1.099,1/4.5,.081]
    curve = cms.cmsBuildParametricToneCurve(None,4,(c.c_double*5)(*params))
    profile = cms.cmsCreateRGBProfile(c.byref(white),c.byref(gamut[primaries]),(c.c_void_p*3)(curve,curve,curve))
    if not profile: raise RuntimeError('Profile creation failed')
    cms.cmsSetProfileVersion(profile,2.1)
    text = cms.cmsMLUalloc(None,1)
    cms.cmsMLUsetASCII(text,b'en',b'US',('CICP SDR ' + str(primaries) + '/' + str(transfer)).encode())
    cms.cmsWriteTag(profile,0x64657363,text)
    cms.cmsMLUfree(text)
    size = c.c_uint32()
    if not cms.cmsSaveProfileToMem(profile,None,c.byref(size)): raise RuntimeError('Cannot serialize')
    buffer = c.create_string_buffer(size.value)
    cms.cmsSaveProfileToMem(profile,buffer,c.byref(size))
    Path('src/assets/cicp-' + str(primaries) + '-' + str(transfer) + '.icc').write_bytes(buffer.raw)
    cms.cmsCloseProfile(profile)
    cms.cmsFreeToneCurve(curve)
