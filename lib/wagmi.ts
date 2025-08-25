import { sepolia } from 'wagmi/chains';
import { http, createConfig } from 'wagmi';
import { injected, walletConnect } from 'wagmi/connectors';
import { AppConfig } from '../config/app.config';

const connectors = AppConfig.walletConnectProjectId
	? [injected(), walletConnect({ projectId: AppConfig.walletConnectProjectId })]
	: [injected()];

export const wagmiConfig = createConfig({
	chains: [sepolia],
	connectors,
	transports: {
		[sepolia.id]: http(AppConfig.rpcUrl || '')
	}
});


