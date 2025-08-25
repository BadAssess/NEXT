import { AppConfig } from '../config/app.config';

type IpfsClientLite = {
	version: () => Promise<unknown>;
};

export async function getIpfsClient(): Promise<IpfsClientLite> {
	const cfg = AppConfig.ipfs as unknown as {
		provider?: string;
		apiBase?: string;
		gatewayBase?: string;
		jwt?: string;
		endpoint?: string;
		projectId?: string;
		projectSecret?: string;
	};

	if (cfg.provider === 'pinata') {
		const { apiBase, jwt } = getPinataConfig();
		const headers: Record<string, string> = { Authorization: `Bearer ${jwt}` };
		return {
			async version() {
				const res = await fetch(`${apiBase.replace(/\/$/, '')}/data/testAuthentication`, { headers });
				if (!res.ok) throw new Error(`Pinata auth failed: ${res.status} ${res.statusText}`);
				return res.json();
			}
		};
	}

	const { endpoint, projectId, projectSecret } = cfg;

	const toBase64 = (s: string): string | undefined => {
		if (typeof window !== 'undefined' && typeof window.btoa === 'function') {
			return window.btoa(s);
		}
		return undefined;
	};

	const encoded = projectId && projectSecret ? toBase64(projectId + ':' + projectSecret) : undefined;
	const headers: Record<string, string> = encoded ? { Authorization: 'Basic ' + encoded } : {};

	return {
		async version() {
			const res = await fetch(`${(endpoint || '').replace(/\/$/, '')}/api/v0/version`, { headers });
			if (!res.ok) throw new Error(`IPFS version failed: ${res.status} ${res.statusText}`);
			return res.json();
		}
	};
}

function getPinataConfig(): { apiBase: string; gatewayBase: string; jwt: string } {
	const cfg = AppConfig.ipfs as unknown as {
		apiBase?: string;
		gatewayBase?: string;
		jwt?: string;
	};
	if (!cfg.apiBase) throw new Error('Pinata configuration missing apiBase');
	if (!cfg.jwt) throw new Error('Pinata configuration missing jwt');
	if (!cfg.gatewayBase) throw new Error('Pinata configuration missing gatewayBase');
	return { apiBase: cfg.apiBase, gatewayBase: cfg.gatewayBase, jwt: cfg.jwt };
}

export async function pinJsonToIpfs(data: unknown, name?: string): Promise<{ cid: string; url: string; gatewayUrl: string }> {
	const { apiBase, jwt } = getPinataConfig();
	const body = {
		pinataOptions: { cidVersion: 1 },
		pinataMetadata: name ? { name } : {},
		pinataContent: data
	};
	const res = await fetch(`${apiBase!.replace(/\/$/, '')}/pinning/pinJSONToIPFS`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${jwt}`
		},
		body: JSON.stringify(body)
	});
	if (!res.ok) throw new Error(`pinJSONToIPFS failed: ${res.status} ${res.statusText}`);
	const out = await res.json() as { IpfsHash: string };
	const cid = out.IpfsHash;
	return { cid, url: `${apiBase}/ipfs/${cid}`, gatewayUrl: buildGatewayUrl(cid) };
}

export async function pinFileToIpfs(file: Blob | ArrayBuffer | Uint8Array, name?: string): Promise<{ cid: string; gatewayUrl: string }> {
	const { apiBase, jwt } = getPinataConfig();
	let blob: Blob;
	if (file instanceof Blob) {
		blob = file;
	} else if (file instanceof ArrayBuffer) {
		blob = new Blob([file]);
	} else {
		const src = file as Uint8Array;
		const copy = new Uint8Array(src.byteLength);
		copy.set(src);
		blob = new Blob([copy.buffer]);
	}
	const form = new FormData();
	form.append('file', blob, name || 'file.bin');
	if (name) form.append('pinataMetadata', JSON.stringify({ name }));
	form.append('pinataOptions', JSON.stringify({ cidVersion: 1 }));
	const res = await fetch(`${apiBase!.replace(/\/$/, '')}/pinning/pinFileToIPFS`, {
		method: 'POST',
		headers: { Authorization: `Bearer ${jwt}` },
		body: form
	});
	if (!res.ok) throw new Error(`pinFileToIPFS failed: ${res.status} ${res.statusText}`);
	const out = await res.json() as { IpfsHash: string };
	const cid = out.IpfsHash;
	return { cid, gatewayUrl: buildGatewayUrl(cid) };
}

export function buildGatewayUrl(cid: string): string {
	const cfg = AppConfig.ipfs as unknown as { 
		gatewayBase?: string; 
	};
	
	const baseUrl = cfg.gatewayBase;
	if (!baseUrl) throw new Error('Missing IPFS gateway configuration');
	
	const cleaned = String(cid || '').replace(/^ipfs:\/\//, '').trim();
	return `${baseUrl.replace(/\/$/, '/')}${cleaned}`;
}


