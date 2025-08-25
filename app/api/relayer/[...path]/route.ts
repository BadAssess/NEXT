import { NextRequest } from 'next/server';
import { AppConfig } from '../../../../config/app.config';

function resolveUpstreamBase(): string {
  const raw = AppConfig.zama?.relayerUrl;
  const isAbsolute = typeof raw === 'string' && /^https?:\/\//i.test(raw);
  const base = isAbsolute ? raw as string : 'https://relayer.testnet.zama.cloud';
  return base.replace(/\/+$/, '');
}
const RELAYER_BASE = resolveUpstreamBase();
const TIMEOUT_MS = 60000;

async function forward(method: string, req: NextRequest, params: Promise<{ path?: string[] }>) {
	const resolvedParams = await params;
	const pathSuffix = '/' + (resolvedParams.path?.join('/') ?? '');
	const url = new URL(req.url);
	const targetUrl = RELAYER_BASE + pathSuffix + (url.search || '');

	const headers: Record<string, string> = {};
	req.headers.forEach((v, k) => {
		const lower = k.toLowerCase();
		if (['host', 'connection', 'content-length', 'accept-encoding', 'transfer-encoding'].includes(lower)) return;
		headers[k] = v;
	});
	
	headers['accept-encoding'] = 'identity';
	headers['user-agent'] = 'Zama-FHE-Client/1.0';

	try {
		console.log(`[RelayerProxy] ${method} ${targetUrl}`);
		
		const body = method === 'GET' || method === 'HEAD' ? undefined : await req.arrayBuffer();
		if (body && body.byteLength > 0) {
			console.log(`[RelayerProxy] Request body size: ${body.byteLength} bytes`);
			
			if (pathSuffix.includes('input-proof')) {
				try {
					const bodyText = new TextDecoder().decode(body);
					console.log(`[RelayerProxy] input-proof body preview:`, bodyText.substring(0, 500));
					
					try {
						const bodyJson = JSON.parse(bodyText);
						console.log(`[RelayerProxy] input-proof JSON structure:`, {
							keys: Object.keys(bodyJson),
							hasChainId: 'chainId' in bodyJson,
							hasContract: 'contract' in bodyJson,
							hasUser: 'user' in bodyJson
						});
					} catch {
						console.log(`[RelayerProxy] input-proof body is not JSON`);
					}
				} catch {
					console.log(`[RelayerProxy] Could not decode input-proof body as text`);
				}
			}
		}
		
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
		
		const resp = await fetch(targetUrl, { 
			method, 
			headers, 
			body, 
			redirect: 'follow',
			signal: controller.signal
		});
		
		clearTimeout(timeoutId);
		console.log(`[RelayerProxy] Response: ${resp.status} ${resp.statusText}`);

		const respHeaders = new Headers(resp.headers);
		respHeaders.delete('content-encoding');
		respHeaders.delete('transfer-encoding');
		respHeaders.delete('content-length');
		respHeaders.set('Access-Control-Allow-Origin', '*');

		if (!resp.ok) {
			let upstreamText = '';
			try { 
				upstreamText = await resp.text(); 
			} catch (e) {
				console.error('[RelayerProxy] Failed to read error response:', e);
			}
			
			console.error('[RelayerProxy] Upstream error', { 
				method, 
				targetUrl, 
				status: resp.status,
				statusText: resp.statusText,
				headers: Object.fromEntries(resp.headers.entries()),
				upstreamText 
			});
			
			if (!respHeaders.has('content-type')) {
				respHeaders.set('content-type', 'text/plain; charset=utf-8');
			}
			
			return new Response(upstreamText || `Upstream error ${resp.status}`, { 
				status: resp.status, 
				headers: respHeaders 
			});
		}

		try {
			const responseBody = await resp.arrayBuffer();
			if (responseBody.byteLength === 0) {
				console.warn('[RelayerProxy] Received empty response body');
			}
			
			return new Response(responseBody, { 
				status: resp.status, 
				headers: respHeaders 
			});
		} catch (readError) {
			console.error('[RelayerProxy] Failed to read response body:', readError);
			return new Response(JSON.stringify({ 
				error: 'Failed to read response body',
				detail: String(readError)
			}), {
				status: 502,
				headers: {
					'content-type': 'application/json; charset=utf-8',
					'Access-Control-Allow-Origin': '*'
				}
			});
		}
		
	} catch (error) {
		console.error('[RelayerProxy] Request failed', { method, targetUrl, error });
		
		let errorMessage = 'Relayer proxy error';
		let statusCode = 502;
		
		if (error instanceof Error) {
			if (error.name === 'AbortError') {
				errorMessage = 'Request timeout';
				statusCode = 504;
			} else {
				errorMessage = error.message;
			}
		}
		
		return new Response(JSON.stringify({ 
			error: errorMessage, 
			detail: String(error) 
		}), {
			status: statusCode,
			headers: {
				'content-type': 'application/json; charset=utf-8',
				'Access-Control-Allow-Origin': '*'
			}
		});
	}
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ path?: string[] }> }) {
	return forward('GET', req, ctx.params);
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ path?: string[] }> }) {
	return forward('POST', req, ctx.params);
}

export async function PUT(req: NextRequest, ctx: { params: Promise<{ path?: string[] }> }) {
	return forward('PUT', req, ctx.params);
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ path?: string[] }> }) {
	return forward('DELETE', req, ctx.params);
}

export async function OPTIONS() {
	return new Response(null, {
		status: 204,
		headers: {
			'Access-Control-Allow-Origin': '*',
			'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
			'Access-Control-Allow-Headers': '*'
		}
	});
}


