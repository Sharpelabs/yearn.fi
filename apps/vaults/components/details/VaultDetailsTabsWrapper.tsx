import React, {Fragment, useEffect, useMemo, useState} from 'react';
import {useRouter} from 'next/router';
import useSWR from 'swr';
import {Listbox, Transition} from '@headlessui/react';
import {useIsMounted} from '@react-hookz/web';
import {VaultDetailsAbout} from '@vaults/components/details/tabs/VaultDetailsAbout';
import {VaultDetailsHistorical} from '@vaults/components/details/tabs/VaultDetailsHistorical';
import {VaultDetailsStrategies} from '@vaults/components/details/tabs/VaultDetailsStrategies';
import Renderable from '@yearn-finance/web-lib/components/Renderable';
import {useSettings} from '@yearn-finance/web-lib/contexts/useSettings';
import {useWeb3} from '@yearn-finance/web-lib/contexts/useWeb3';
import {useChainID} from '@yearn-finance/web-lib/hooks/useChainID';
import IconAddToMetamask from '@yearn-finance/web-lib/icons/IconAddToMetamask';
import IconLinkOut from '@yearn-finance/web-lib/icons/IconLinkOut';
import {baseFetcher} from '@yearn-finance/web-lib/utils/fetchers';
import {formatBN, formatToNormalizedValue} from '@yearn-finance/web-lib/utils/format.bigNumber';
import {formatDate} from '@yearn-finance/web-lib/utils/format.time';
import IconChevron from '@common/icons/IconChevron';

import type {ReactElement} from 'react';
import type {SWRResponse} from 'swr';
import type {TMetamaskInjectedProvider} from '@yearn-finance/web-lib/types';
import type {TSettingsForNetwork, TYearnVault} from '@common/types/yearn';

type TTabsOptions = {
	value: number;
	label: string;
	slug?: string;
}
type TTabs = {
	selectedAboutTabIndex: number,
	set_selectedAboutTabIndex: (arg0: number) => void
}

type TExplorerLinkProps = {
	explorerBaseURI?: string;
	currentVaultAddress: string;
}

function	Tabs({selectedAboutTabIndex, set_selectedAboutTabIndex}: TTabs): ReactElement {
	const router = useRouter();

	const tabs: TTabsOptions[] = useMemo((): TTabsOptions[] => [
		{value: 0, label: 'About', slug: 'about'},
		{value: 1, label: 'Strategies', slug: 'strategies'},
		{value: 2, label: 'Historical rates', slug: 'historical-rates'}
	], []);

	useEffect((): void => {
		const tab = tabs.find((tab): boolean => tab.slug === router.query.tab);
		if (tab?.value) {
			set_selectedAboutTabIndex(tab?.value);
		}
	}, [router.query.tab, set_selectedAboutTabIndex, tabs]);

	return (
		<>
			<nav className={'hidden flex-row items-center space-x-10 md:flex'}>
				{tabs.map((tab): ReactElement => (
					<button
						key={`desktop-${tab.value}`}
						onClick={(): void => {
							router.replace(
								{
									query: {
										...router.query,
										tab: tab.slug
									}
								},
								undefined,
								{
									shallow: true
								}
							);
							set_selectedAboutTabIndex(tab.value);
						}}>
						<p
							title={tab.label}
							aria-selected={selectedAboutTabIndex === tab.value}
							className={'hover-fix tab'}>
							{tab.label}
						</p>
					</button>
				))}
			</nav>
			<div className={'relative z-50'}>
				<Listbox
					value={selectedAboutTabIndex}
					onChange={(value): void => set_selectedAboutTabIndex(value)}>
					{({open}): ReactElement => (
						<>
							<Listbox.Button
								className={'flex h-10 w-40 flex-row items-center border-0 border-b-2 border-neutral-900 bg-neutral-100 p-0 font-bold focus:border-neutral-900 md:hidden'}>
								<div className={'relative flex flex-row items-center'}>
									{tabs[selectedAboutTabIndex]?.label || 'Menu'}
								</div>
								<div className={'absolute right-0'}>
									<IconChevron
										className={`h-6 w-6 transition-transform ${open ? '-rotate-180' : 'rotate-0'}`} />
								</div>
							</Listbox.Button>
							<Transition
								as={Fragment}
								show={open}
								enter={'transition duration-100 ease-out'}
								enterFrom={'transform scale-95 opacity-0'}
								enterTo={'transform scale-100 opacity-100'}
								leave={'transition duration-75 ease-out'}
								leaveFrom={'transform scale-100 opacity-100'}
								leaveTo={'transform scale-95 opacity-0'}>
								<Listbox.Options className={'yearn--listbox-menu'}>
									{tabs.map((tab): ReactElement => (
										<Listbox.Option
											className={'yearn--listbox-menu-item'}
											key={tab.value}
											value={tab.value}>
											{tab.label}
										</Listbox.Option>
									))}
								</Listbox.Options>
							</Transition>
						</>
					)}
				</Listbox>
			</div>
		</>
	);
}

function ExplorerLink({explorerBaseURI, currentVaultAddress}: TExplorerLinkProps): ReactElement | null {
	const isMounted = useIsMounted();

	if (!explorerBaseURI || !isMounted()) {
		return null;
	}

	return (
		<a
			href={`${explorerBaseURI}/address/${currentVaultAddress}`}
			target={'_blank'}
			rel={'noopener noreferrer'}>
			<span className={'sr-only'}>{'Open in explorer'}</span>
			<IconLinkOut className={'h-5 w-5 cursor-alias text-neutral-600 transition-colors hover:text-neutral-900 md:h-6 md:w-6'} />
		</a>
	);
}

function	VaultDetailsTabsWrapper({currentVault}: {currentVault: TYearnVault}): ReactElement {
	const {provider} = useWeb3();
	const {safeChainID} = useChainID();
	const {settings: baseAPISettings, networks} = useSettings();
	const [selectedAboutTabIndex, set_selectedAboutTabIndex] = useState(0);
	const networkSettings = useMemo((): TSettingsForNetwork => networks[safeChainID], [networks, safeChainID]);

	async function onAddTokenToMetamask(address: string, symbol: string, decimals: number, image: string): Promise<void> {
		try {
			await (provider as TMetamaskInjectedProvider).send('wallet_watchAsset', {
				type: 'ERC20',
				options: {
					address,
					symbol,
					decimals,
					image
				}
			});
		} catch (error) {
			// Token has not been added to MetaMask.
		}
	}

	const	{data: yDaemonHarvestsData} = useSWR(
		`${baseAPISettings.yDaemonBaseURI || process.env.YDAEMON_BASE_URI}/${safeChainID}/vaults/harvests/${currentVault.address}`,
		baseFetcher,
		{revalidateOnFocus: false}
	) as SWRResponse;

	const	harvestData = useMemo((): {name: string; value: number}[] => {
		const	_yDaemonHarvestsData = [...(yDaemonHarvestsData || [])].reverse();
		return (
			_yDaemonHarvestsData?.map((harvest): {name: string; value: number} => ({
				name: formatDate(Number(harvest.timestamp) * 1000),
				value: formatToNormalizedValue(formatBN(harvest.profit).sub(formatBN(harvest.loss)), currentVault.decimals)
			}))
		);
	}, [currentVault.decimals, yDaemonHarvestsData]);

	return (
		<div aria-label={'Vault Details'} className={'col-span-12 mb-4 flex flex-col bg-neutral-100'}>
			<div className={'relative flex w-full flex-row items-center justify-between px-4 pt-4 md:px-8'}>
				<Tabs
					selectedAboutTabIndex={selectedAboutTabIndex}
					set_selectedAboutTabIndex={set_selectedAboutTabIndex} />

				<div className={'flex flex-row items-center justify-end space-x-2 pb-0 md:pb-4 md:last:space-x-4'}>
					<button
						onClick={(): void => {
							onAddTokenToMetamask(
								currentVault.address,
								currentVault.symbol,
								currentVault.decimals,
								currentVault.icon
							);
						}
						}>
						<span className={'sr-only'}>{'Add to wallet'}</span>
						<IconAddToMetamask className={'h-5 w-5 text-neutral-600 transition-colors hover:text-neutral-900 md:h-6 md:w-6'} />
					</button>
					<ExplorerLink explorerBaseURI={networkSettings?.explorerBaseURI} currentVaultAddress={currentVault.address} />
				</div>
			</div>

			<div className={'-mt-0.5 h-0.5 w-full bg-neutral-300'} />

			<Renderable shouldRender={currentVault && selectedAboutTabIndex === 0}>
				<VaultDetailsAbout
					currentVault={currentVault}
					harvestData={harvestData} />
			</Renderable>

			<Renderable shouldRender={currentVault && selectedAboutTabIndex === 1}>
				<VaultDetailsStrategies
					currentVault={currentVault} />
			</Renderable>

			<Renderable shouldRender={currentVault && selectedAboutTabIndex === 2}>
				<VaultDetailsHistorical
					currentVault={currentVault}
					harvestData={harvestData} />
			</Renderable>

		</div>
	);
}

export {VaultDetailsTabsWrapper};
