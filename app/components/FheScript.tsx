'use client';

import Script from 'next/script';

declare global {
	var __ZAMA_SDK_LOADED__: boolean | undefined;
	var __ZAMA_SDK_ERROR__: string | undefined;
}

export function FheScript() {
	return (
		<Script
			src="https://cdn.zama.ai/relayer-sdk-js/0.1.0-9/relayer-sdk-js.umd.cjs"
			strategy="afterInteractive"
			onLoad={() => {
				globalThis.__ZAMA_SDK_LOADED__ = true;
				globalThis.__ZAMA_SDK_ERROR__ = undefined;
			}}
			onError={(e) => {
				globalThis.__ZAMA_SDK_LOADED__ = false;
				const errorMsg = `Script loading failed: ${e instanceof Event ? 'Network or resource error' : String(e)}`;
				globalThis.__ZAMA_SDK_ERROR__ = errorMsg;
				console.error('[FheScript] Script loading failed:', e);
				console.error('[FheScript] Please check network connection or CDN accessibility');
			}}
		/>
	);
}


