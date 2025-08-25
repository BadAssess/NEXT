'use client';

import { useState, useRef, useEffect } from 'react';
import { AppConfig } from '../../config/app.config';

interface TraitTypeInputProps {
	value: string;
	onChange: (value: string) => void;
	placeholder?: string;
}

export function TraitTypeInput({ value, onChange, placeholder = "Select or enter attribute name" }: TraitTypeInputProps) {
	const [isDropdownOpen, setIsDropdownOpen] = useState(false);
	const [filteredOptions, setFilteredOptions] = useState<string[]>([]);
	const inputRef = useRef<HTMLInputElement>(null);
	const dropdownRef = useRef<HTMLDivElement>(null);

	const commonTraitTypes = AppConfig.nftAttributes.commonTraitTypes;

	useEffect(() => {
		const filtered = commonTraitTypes.filter(option =>
			option.toLowerCase().includes(value.toLowerCase())
		);
		setFilteredOptions(filtered);
	}, [value, commonTraitTypes]);

	useEffect(() => {
		function handleClickOutside(event: MouseEvent) {
			if (
				dropdownRef.current &&
				!dropdownRef.current.contains(event.target as Node) &&
				inputRef.current &&
				!inputRef.current.contains(event.target as Node)
			) {
				setIsDropdownOpen(false);
			}
		}

		document.addEventListener('mousedown', handleClickOutside);
		return () => document.removeEventListener('mousedown', handleClickOutside);
	}, []);

	const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		onChange(e.target.value);
		setIsDropdownOpen(true);
	};

	const handleOptionSelect = (option: string) => {
		onChange(option);
		setIsDropdownOpen(false);
		inputRef.current?.focus();
	};

	const handleInputFocus = () => {
		setIsDropdownOpen(true);
	};

	const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
		if (e.key === 'Escape') {
			setIsDropdownOpen(false);
		} else if (e.key === 'ArrowDown' && filteredOptions.length > 0) {
			e.preventDefault();
			setIsDropdownOpen(true);
		}
	};

	return (
		<div style={{ position: 'relative', width: '100%' }}>
			<input
				ref={inputRef}
				type="text"
				value={value}
				onChange={handleInputChange}
				onFocus={handleInputFocus}
				onKeyDown={handleKeyDown}
				placeholder={placeholder}
				style={{
					width: '100%',
					minWidth: 0,
					maxWidth: '100%',
					padding: '10px 14px',
					border: '2px solid #d1d5db',
					borderRadius: '8px',
					fontSize: '14px',
					color: '#1f2937',
					outline: 'none',
					transition: 'border-color 0.2s ease',
					borderColor: isDropdownOpen ? '#3b82f6' : '#d1d5db',
					boxSizing: 'border-box'
				}}
			/>
			
			{isDropdownOpen && filteredOptions.length > 0 && (
				<div
					ref={dropdownRef}
					style={{
						position: 'absolute',
						top: '100%',
						left: 0,
						right: 0,
						background: 'white',
						border: '2px solid #d1d5db',
						borderTop: 'none',
						borderRadius: '0 0 8px 8px',
						boxShadow: '0 8px 16px rgba(0, 0, 0, 0.1)',
						maxHeight: '200px',
						overflowY: 'auto',
						zIndex: 1000
					}}
				>
					{filteredOptions.map((option, index) => (
						<div
							key={option}
							onClick={() => handleOptionSelect(option)}
							style={{
								padding: '10px 14px',
								cursor: 'pointer',
								fontSize: '14px',
								color: '#1f2937',
								borderBottom: index < filteredOptions.length - 1 ? '1px solid #f3f4f6' : 'none',
								backgroundColor: 'white',
								transition: 'background-color 0.15s ease'
							}}
							onMouseEnter={(e) => {
								e.currentTarget.style.backgroundColor = '#f3f4f6';
							}}
							onMouseLeave={(e) => {
								e.currentTarget.style.backgroundColor = 'white';
							}}
						>
							{option}
						</div>
					))}
				</div>
			)}
		</div>
	);
}
