'use client';
import '@rainbow-me/rainbowkit/styles.css';
import { RainbowKitProvider } from '@rainbow-me/rainbowkit';
import { WagmiProvider } from 'wagmi';
import { wagmiConfig } from '../lib/wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect } from 'react';
import { getFheInstance } from '../lib/fhe';
import { WalletBar } from './wallet-bar';
import { setFheStatus, setIpfsStatus, getInitState } from '../lib/init-state';

const queryClient = new QueryClient();

export function Providers({ children }: { children: React.ReactNode }) {
	useEffect(() => {
		(async () => {
			setFheStatus('loading');
			try {
				await getFheInstance();
				setFheStatus('ready');
			} catch (e) {
				const error = e instanceof Error ? e.message : String(e);
				setFheStatus('error', error);
				console.error('[FHE] Initialization failed, all operations disabled:', error);
				return;
			}

			setIpfsStatus('loading');
			try {
				const { getIpfsClient, pinJsonToIpfs, pinFileToIpfs, buildGatewayUrl } = await import('../lib/ipfs');
				const ipfs = await getIpfsClient();
				await ipfs.version();
				setIpfsStatus('ready');
			} catch (e) {
				const error = e instanceof Error ? e.message : String(e);
				setIpfsStatus('error', error);
				console.error('[IPFS] Initialization failed:', error);
			}

			const finalState = getInitState();
			if (finalState.overall === 'ready') {
				console.log('[Init] All services initialized successfully');
			} else if (finalState.overall === 'error') {
				console.error('[Init] Critical services initialization failed, application unavailable');
			}
		})();
	}, []);
	return (
		<WagmiProvider config={wagmiConfig}>
			<QueryClientProvider client={queryClient}>
				<RainbowKitProvider>
					<WalletBar />
					{children}
				</RainbowKitProvider>
			</QueryClientProvider>
		</WagmiProvider>
	);
}


