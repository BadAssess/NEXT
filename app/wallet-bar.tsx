'use client';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useEffect, useState } from 'react';

export function WalletBar() {
	const [mounted, setMounted] = useState(false);

	useEffect(() => {
		setMounted(true);
	}, []);

	if (!mounted) {
		return null;
	}

	return (
		<div style={{ position: 'fixed', top: 12, right: 12, zIndex: 1000 }}>
			<ConnectButton />
		</div>
	);
}


