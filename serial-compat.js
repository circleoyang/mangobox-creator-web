// MangoBox Creator Web Serial compatibility shim
// Temporary deployment-layer bridge for MangoX2 while source fixes live in the private Creator repo.
(() => {
  const PATCH_FLAG = '__mangoboxCreatorSerialCompatV1';
  const serialProto = globalThis.SerialPort?.prototype;

  const describeError = (error) => {
    if (error && typeof error === 'object') {
      const name = error.name || 'Error';
      const message = error.message || String(error);
      return `${name}: ${message}`;
    }
    return String(error);
  };

  const describePort = (port) => {
    try {
      const info = port?.getInfo?.() || {};
      const fmt = (value) => Number.isFinite(Number(value))
        ? `0x${Number(value).toString(16).padStart(4, '0')} (${Number(value)})`
        : 'unknown';
      return `VID=${fmt(info.usbVendorId)}, PID=${fmt(info.usbProductId)}`;
    } catch {
      return 'VID/PID unavailable';
    }
  };

  if (serialProto?.open && !serialProto[PATCH_FLAG]) {
    const originalOpen = serialProto.open;
    Object.defineProperty(serialProto, PATCH_FLAG, { value: true });
    serialProto.open = async function mangoBoxSerialOpen(options = {}) {
      try {
        return await originalOpen.call(this, options);
      } catch (firstError) {
        const keys = Object.keys(options || {});
        const baudRate = Number(options?.baudRate) || 115200;
        if (keys.length <= 1 && keys.includes('baudRate')) {
          throw new Error(`[Web Serial open] ${describePort(this)}; open=${describeError(firstError)}`);
        }
        await new Promise((resolve) => setTimeout(resolve, 120));
        try {
          return await originalOpen.call(this, { baudRate });
        } catch (retryError) {
          throw new Error(`[Web Serial open] ${describePort(this)}; retry=${describeError(retryError)}; first open=${describeError(firstError)}`);
        }
      }
    };
  }

  // The currently deployed bundle predates the MangoX2-specific module probe.
  // Rewrite only the Creator identity probe before TextEncoder encodes it.
  const encoderProto = globalThis.TextEncoder?.prototype;
  if (encoderProto?.encode && !encoderProto[PATCH_FLAG]) {
    const originalEncode = encoderProto.encode;
    Object.defineProperty(encoderProto, PATCH_FLAG, { value: true });
    encoderProto.encode = function mangoBoxEncode(input = '') {
      let text = String(input);
      if (text.includes('@@MANGO_CREATOR_ID@@') && text.includes('    import mangobox as _pkg')) {
        text = text.replace(
          '    import mangobox as _pkg',
          "    if _b == 'mangox2':\n        import mangox2 as _pkg\n    else:\n        import mangobox as _pkg"
        );
      }
      return originalEncode.call(this, text);
    };
  }
})();
