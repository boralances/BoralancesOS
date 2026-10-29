"""Windows CurrentUser DPAPI fallback. JSON is exchanged only over private pipes."""
import ctypes
from ctypes import wintypes
import hashlib
import base64
import json
import sys
import winreg

class Blob(ctypes.Structure):
    _fields_ = [("size", wintypes.DWORD), ("data", ctypes.POINTER(ctypes.c_ubyte))]

def transform(value, decrypt=False):
    raw = base64.b64decode(value, validate=True) if decrypt else value.encode("utf-8")
    buf = ctypes.create_string_buffer(raw)
    source = Blob(len(raw), ctypes.cast(buf, ctypes.POINTER(ctypes.c_ubyte)))
    result = Blob()
    crypt = ctypes.WinDLL("crypt32", use_last_error=True)
    fn = crypt.CryptUnprotectData if decrypt else crypt.CryptProtectData
    fn.argtypes = [ctypes.POINTER(Blob), ctypes.c_void_p, ctypes.c_void_p, ctypes.c_void_p, ctypes.c_void_p, wintypes.DWORD, ctypes.POINTER(Blob)]
    fn.restype = wintypes.BOOL
    if not fn(ctypes.byref(source), None, None, None, None, 1, ctypes.byref(result)):
        raise OSError("DPAPI failed")
    kernel = ctypes.WinDLL("kernel32", use_last_error=True)
    kernel.LocalFree.argtypes = [ctypes.c_void_p]
    kernel.LocalFree.restype = ctypes.c_void_p
    try:
        output = ctypes.string_at(result.data, result.size)
        return output.decode("utf-8") if decrypt else base64.b64encode(output).decode("ascii")
    finally:
        kernel.LocalFree(result.data)

def identity():
    adv = ctypes.WinDLL("advapi32", use_last_error=True)
    kernel = ctypes.WinDLL("kernel32", use_last_error=True)
    kernel.GetCurrentProcess.restype = wintypes.HANDLE
    kernel.CloseHandle.argtypes = [wintypes.HANDLE]
    adv.OpenProcessToken.argtypes = [wintypes.HANDLE, wintypes.DWORD, ctypes.POINTER(wintypes.HANDLE)]
    adv.GetTokenInformation.argtypes = [wintypes.HANDLE, ctypes.c_int, ctypes.c_void_p, wintypes.DWORD, ctypes.POINTER(wintypes.DWORD)]
    adv.ConvertSidToStringSidW.argtypes = [ctypes.c_void_p, ctypes.POINTER(wintypes.LPWSTR)]
    kernel.LocalFree.argtypes = [ctypes.c_void_p]
    token = wintypes.HANDLE()
    if not adv.OpenProcessToken(kernel.GetCurrentProcess(), 8, ctypes.byref(token)):
        raise OSError("Identity unavailable")
    try:
        needed = wintypes.DWORD()
        adv.GetTokenInformation(token, 1, None, 0, ctypes.byref(needed))
        buf = ctypes.create_string_buffer(needed.value)
        if not adv.GetTokenInformation(token, 1, buf, needed.value, ctypes.byref(needed)):
            raise OSError("Identity unavailable")
        sid_pointer = ctypes.cast(buf, ctypes.POINTER(ctypes.c_void_p))[0]
        sid_text = wintypes.LPWSTR()
        if not adv.ConvertSidToStringSidW(sid_pointer, ctypes.byref(sid_text)):
            raise OSError("Identity unavailable")
        try:
            sid = sid_text.value
        finally:
            kernel.LocalFree(ctypes.cast(sid_text, ctypes.c_void_p))
    finally:
        kernel.CloseHandle(token)
    with winreg.OpenKey(winreg.HKEY_LOCAL_MACHINE, r"SOFTWARE\Microsoft\Cryptography", 0, winreg.KEY_READ | winreg.KEY_WOW64_64KEY) as key:
        machine = winreg.QueryValueEx(key, "MachineGuid")[0]
    return hashlib.sha256((machine + "|" + sid).encode("utf-8")).hexdigest()

try:
    request = json.load(sys.stdin)
    operation = request["operation"]
    if operation == "identity":
        output = identity()
    elif operation in ("protect", "unprotect"):
        output = transform(request["value"], operation == "unprotect")
    else:
        raise ValueError("Unknown operation")
    print(json.dumps({"value": output}))
except Exception:
    print("Windows native credential reader is unavailable.", file=sys.stderr)
    sys.exit(1)
