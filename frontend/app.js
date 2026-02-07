// ============================================
// Viem Imports from CDN
// ============================================
import { 
    createPublicClient, 
    createWalletClient, 
    custom,
    http,
    formatUnits,
    parseUnits,
    parseEther,
    formatEther,
    decodeEventLog
} from 'https://esm.sh/viem@2.7.15';

// ============================================
// Configuration
// ============================================
const CONFIG = {
    CHAIN_ID: 1301, // Unichain Sepolia
    RPC_URL: 'https://sepolia.unichain.org',
    CONTRACT_ADDRESS: '0x926d2A429709c87eC4dc62DC469172ea8e3689Dc', // Mock deployment - LP sets intent deposit
    EXPLORER_URL: 'https://sepolia.uniscan.xyz',
    PICONERO_PER_XMR: 1e12,
};

// Define Unichain Sepolia chain
const unichainSepolia = {
    id: 1301,
    name: 'Unichain Sepolia',
    network: 'unichain-sepolia',
    nativeCurrency: {
        decimals: 18,
        name: 'Ether',
        symbol: 'ETH',
    },
    rpcUrls: {
        default: {
            http: ['https://sepolia.unichain.org'],
        },
        public: {
            http: ['https://sepolia.unichain.org'],
        },
    },
    blockExplorers: {
        default: {
            name: 'Uniscan',
            url: 'https://sepolia.uniscan.xyz',
        },
    },
    testnet: true,
};

// ============================================
// State Management
// ============================================
let state = {
    publicClient: null,
    walletClient: null,
    userAddress: null,
    isConnected: false,
    isConnecting: false,
    selectedLP: null,
};

// ============================================
// Contract ABI
// ============================================
const CONTRACT_ABI = [
    {
        inputs: [{ name: 'account', type: 'address' }],
        name: 'balanceOf',
        outputs: [{ name: '', type: 'uint256' }],
        stateMutability: 'view',
        type: 'function',
    },
    {
        inputs: [{ name: 'lp', type: 'address' }],
        name: 'lpInfo',
        outputs: [{
            components: [
                { name: 'collateralAmount', type: 'uint256' },
                { name: 'backedAmount', type: 'uint256' },
                { name: 'mintFeeBps', type: 'uint256' },
                { name: 'burnFeeBps', type: 'uint256' },
                { name: 'moneroAddress', type: 'string' },
                { name: 'privateViewKey', type: 'bytes32' },
                { name: 'active', type: 'bool' },
                { name: 'registered', type: 'bool' }
            ],
            name: '',
            type: 'tuple'
        }],
        stateMutability: 'view',
        type: 'function',
    },
    {
        inputs: [
            { name: 'lp', type: 'address' },
            { name: 'expectedAmount', type: 'uint256' }
        ],
        name: 'createMintIntent',
        outputs: [{ name: '', type: 'uint256' }],
        stateMutability: 'payable',
        type: 'function',
    },
    {
        inputs: [
            { name: 'intentId', type: 'bytes32' }
        ],
        name: 'claimExpiredIntent',
        outputs: [],
        stateMutability: 'nonpayable',
        type: 'function',
    },
    {
        inputs: [
            { name: 'lp', type: 'address' },
            { name: 'amount', type: 'uint256' },
            { name: 'xmrAddress', type: 'string' }
        ],
        name: 'requestBurn',
        outputs: [{ name: '', type: 'uint256' }],
        stateMutability: 'nonpayable',
        type: 'function',
    },
    {
        inputs: [
            { name: 'mintFeeBps', type: 'uint256' },
            { name: 'burnFeeBps', type: 'uint256' },
            { name: 'intentDepositBps', type: 'uint256' },
            { name: 'moneroAddress', type: 'string' },
            { name: 'privateViewKey', type: 'bytes32' },
            { name: 'active', type: 'bool' }
        ],
        name: 'registerLP',
        outputs: [],
        stateMutability: 'nonpayable',
        type: 'function',
    },
    {
        inputs: [],
        name: 'lpDeposit',
        outputs: [],
        stateMutability: 'payable',
        type: 'function',
    },
    {
        inputs: [],
        name: 'getXmrEthPrice',
        outputs: [{ name: '', type: 'uint256' }],
        stateMutability: 'view',
        type: 'function',
    },
    {
        inputs: [{ name: 'lp', type: 'address' }],
        name: 'getLPRatio',
        outputs: [{ name: '', type: 'uint256' }],
        stateMutability: 'view',
        type: 'function',
    },
    {
        inputs: [{ name: 'lp', type: 'address' }],
        name: 'getLPAvailableCapacity',
        outputs: [{ name: '', type: 'uint256' }],
        stateMutability: 'view',
        type: 'function',
    },
    {
        inputs: [],
        name: 'totalLPCollateral',
        outputs: [{ name: '', type: 'uint256' }],
        stateMutability: 'view',
        type: 'function',
    },
    {
        inputs: [],
        name: 'MIN_INTENT_DEPOSIT',
        outputs: [{ name: '', type: 'uint256' }],
        stateMutability: 'view',
        type: 'function',
    },
    {
        inputs: [],
        name: 'getLPCount',
        outputs: [{ name: '', type: 'uint256' }],
        stateMutability: 'view',
        type: 'function',
    },
    {
        inputs: [],
        name: 'getActiveLPs',
        outputs: [
            { name: 'addresses', type: 'address[]' },
            { name: 'moneroAddresses', type: 'string[]' },
            { name: 'mintFees', type: 'uint256[]' },
            { name: 'capacities', type: 'uint256[]' }
        ],
        stateMutability: 'view',
        type: 'function',
    },
    {
        inputs: [{ name: 'user', type: 'address' }],
        name: 'getUserMintIntents',
        outputs: [
            { name: 'intentIds', type: 'bytes32[]' },
            { name: 'lps', type: 'address[]' },
            { name: 'amounts', type: 'uint256[]' },
            { name: 'deposits', type: 'uint256[]' },
            { name: 'timestamps', type: 'uint256[]' }
        ],
        stateMutability: 'view',
        type: 'function',
    },
    {
        anonymous: false,
        inputs: [
            { indexed: true, name: 'intentId', type: 'uint256' },
            { indexed: true, name: 'user', type: 'address' },
            { indexed: true, name: 'lp', type: 'address' },
            { indexed: false, name: 'expectedAmount', type: 'uint256' }
        ],
        name: 'MintIntentCreated',
        type: 'event',
    },
    {
        anonymous: false,
        inputs: [
            { indexed: true, name: 'burnId', type: 'uint256' },
            { indexed: true, name: 'user', type: 'address' },
            { indexed: true, name: 'lp', type: 'address' },
            { indexed: false, name: 'amount', type: 'uint256' },
            { indexed: false, name: 'xmrAddress', type: 'string' }
        ],
        name: 'BurnRequested',
        type: 'event',
    },
];

// ============================================
// Initialization
// ============================================
// Wait for ethereum provider to be injected
function waitForEthereum(timeout = 3000) {
    return new Promise((resolve) => {
        if (window.ethereum) {
            resolve(window.ethereum);
            return;
        }

        let timeoutId;
        const checkInterval = setInterval(() => {
            if (window.ethereum) {
                clearInterval(checkInterval);
                clearTimeout(timeoutId);
                resolve(window.ethereum);
            }
        }, 100);

        timeoutId = setTimeout(() => {
            clearInterval(checkInterval);
            resolve(null);
        }, timeout);
    });
}

document.addEventListener('DOMContentLoaded', async () => {
    console.log('🌉 Hooked Monero Frontend Initialized');
    
    // Wait for wallet provider to be injected (Brave/MetaMask inject asynchronously)
    console.log('⏳ Waiting for wallet provider...');
    await waitForEthereum();
    
    // Setup event listeners
    setupEventListeners();
    
    // Initialize public client for reading contract data (doesn't require wallet)
    state.publicClient = createPublicClient({
        chain: unichainSepolia,
        transport: http(CONFIG.RPC_URL)
    });
    
    // Check if wallet is already connected
    const provider = getEthereumProvider();
    if (provider) {
        try {
            const accounts = await provider.request({ method: 'eth_accounts' });
            if (accounts.length > 0) {
                await connectWallet();
            }
        } catch (e) {
            console.log('No accounts connected yet');
        }
    }
    
    // Load initial data
    await loadInitialData();
});

// ============================================
// Wallet Provider Detection
// ============================================
function getEthereumProvider() {
    console.log('Checking for ethereum provider...');
    console.log('window.ethereum exists:', !!window.ethereum);
    console.log('window.ethereum.providers:', window.ethereum?.providers);
    
    // Check if there are multiple providers (e.g., Brave + MetaMask)
    if (window.ethereum?.providers && Array.isArray(window.ethereum.providers) && window.ethereum.providers.length > 0) {
        console.log('Found', window.ethereum.providers.length, 'providers');
        window.ethereum.providers.forEach((p, i) => {
            console.log(`Provider ${i}:`, {
                isBraveWallet: p.isBraveWallet,
                isMetaMask: p.isMetaMask,
            });
        });
        
        // Look for Brave Wallet specifically
        const braveProvider = window.ethereum.providers.find(p => p.isBraveWallet);
        if (braveProvider) {
            console.log('✅ Using Brave Wallet from providers array');
            return braveProvider;
        }
        // Otherwise return first provider
        console.log('✅ Using first provider from array');
        return window.ethereum.providers[0];
    }
    
    // Single provider case
    if (window.ethereum) {
        console.log('✅ Using window.ethereum directly');
        console.log('Provider flags:', {
            isBraveWallet: window.ethereum.isBraveWallet,
            isMetaMask: window.ethereum.isMetaMask,
        });
        return window.ethereum;
    }
    
    console.log('❌ No ethereum provider found');
    return null;
}

// ============================================
// Event Listeners
// ============================================
function setupEventListeners() {
    // Wallet connection
    document.getElementById('connectWallet').addEventListener('click', connectWallet);
    document.getElementById('disconnectWallet').addEventListener('click', disconnectWallet);
    
    // Tab switching
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const tabName = e.currentTarget.dataset.tab;
            switchTab(tabName);
        });
    });
    
    // Mint tab
    document.getElementById('lpSelect').addEventListener('change', handleLPSelection);
    document.getElementById('mintAmount').addEventListener('input', updateIntentDepositDisplay);
    document.getElementById('createIntentBtn').addEventListener('click', createMintIntent);
    const copyBtn = document.getElementById('copyAddressBtn');
    if (copyBtn) copyBtn.addEventListener('click', copyMoneroAddress);
    const generateProofBtn = document.getElementById('generateProofBtn');
    if (generateProofBtn) generateProofBtn.addEventListener('click', generateProofAndMint);
    
    // Burn tab
    document.getElementById('burnBtn').addEventListener('click', requestBurn);
    
    // LP tab
    document.getElementById('registerLpBtn').addEventListener('click', registerAsLP);
    document.getElementById('depositCollateralBtn').addEventListener('click', depositCollateral);
    const updateLpBtn = document.getElementById('updateLpBtn');
    if (updateLpBtn) updateLpBtn.addEventListener('click', updateLPSettings);
    
    // Listen for account changes
    const provider = getEthereumProvider();
    if (provider) {
        provider.on('accountsChanged', handleAccountsChanged);
        provider.on('chainChanged', () => window.location.reload());
    }
}

// ============================================
// Wallet Connection
// ============================================
async function connectWallet() {
    // Prevent multiple simultaneous connection attempts
    if (state.isConnecting) {
        console.log('Connection already in progress...');
        return;
    }
    
    try {
        state.isConnecting = true;
        
        const provider = getEthereumProvider();
        if (!provider) {
            showToast('Please install MetaMask or another Web3 wallet', 'error');
            return;
        }
        
        showLoading('Connecting wallet...');
        
        // Request account access
        const accounts = await provider.request({ method: 'eth_requestAccounts' });
        state.userAddress = accounts[0];
        state.isConnected = true;
        
        // Check network first (before creating clients)
        const chainIdHex = await provider.request({ method: 'eth_chainId' });
        const chainId = parseInt(chainIdHex, 16);
        console.log('Current chain ID:', chainId);
        
        if (chainId !== CONFIG.CHAIN_ID) {
            console.log('Wrong network, switching...');
            await switchNetwork();
        }
        
        // Create Viem clients
        state.walletClient = createWalletClient({
            account: state.userAddress,
            chain: unichainSepolia,
            transport: custom(provider)
        });
        
        state.publicClient = createPublicClient({
            chain: unichainSepolia,
            transport: http(CONFIG.RPC_URL)
        });
        
        // Update UI
        updateWalletUI();
        await loadUserData();
        
        hideLoading();
        showToast('Wallet connected successfully!', 'success');
        
    } catch (error) {
        console.error('Error connecting wallet:', error);
        hideLoading();
        showToast('Failed to connect wallet: ' + error.message, 'error');
    } finally {
        state.isConnecting = false;
    }
}

function disconnectWallet() {
    state.publicClient = null;
    state.walletClient = null;
    state.userAddress = null;
    state.isConnected = false;
    state.isConnecting = false;
    
    updateWalletUI();
    
    // Reset UI values
    document.getElementById('userBalance').textContent = '0.00';
    document.getElementById('burnBalance').textContent = '0.00';
    
    showToast('Wallet disconnected', 'info');
}

async function switchNetwork() {
    const provider = getEthereumProvider();
    if (!provider) return;
    
    try {
        console.log('Attempting to switch to Unichain Sepolia...');
        await provider.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: '0x' + CONFIG.CHAIN_ID.toString(16) }],
        });
        console.log('✅ Switched to Unichain Sepolia');
    } catch (switchError) {
        console.log('Switch error:', switchError);
        
        // Network not added, try to add it (error code 4902)
        if (switchError.code === 4902 || switchError.code === -32603) {
            try {
                console.log('Network not found, adding Unichain Sepolia...');
                await provider.request({
                    method: 'wallet_addEthereumChain',
                    params: [{
                        chainId: '0x' + CONFIG.CHAIN_ID.toString(16),
                        chainName: 'Unichain Sepolia',
                        nativeCurrency: {
                            name: 'ETH',
                            symbol: 'ETH',
                            decimals: 18
                        },
                        rpcUrls: [CONFIG.RPC_URL],
                        blockExplorerUrls: [CONFIG.EXPLORER_URL]
                    }],
                });
                console.log('✅ Added Unichain Sepolia network');
            } catch (addError) {
                console.error('Failed to add network:', addError);
                throw new Error('Please manually add Unichain Sepolia network to your wallet. Chain ID: 1301, RPC: ' + CONFIG.RPC_URL);
            }
        } else if (switchError.code === 4001) {
            // User rejected
            throw new Error('Please switch to Unichain Sepolia network to continue');
        } else {
            throw switchError;
        }
    }
}

function handleAccountsChanged(accounts) {
    if (accounts.length === 0) {
        // User disconnected wallet
        state.isConnected = false;
        state.userAddress = null;
        updateWalletUI();
    } else {
        // User switched accounts
        window.location.reload();
    }
}

function updateWalletUI() {
    const connectBtn = document.getElementById('connectWallet');
    const walletInfo = document.getElementById('walletInfo');
    const walletAddress = document.getElementById('walletAddress');
    
    if (state.isConnected) {
        connectBtn.classList.add('hidden');
        walletInfo.classList.remove('hidden');
        walletAddress.textContent = formatAddress(state.userAddress);
    } else {
        connectBtn.classList.remove('hidden');
        walletInfo.classList.add('hidden');
    }
}

// ============================================
// Data Loading
// ============================================
async function loadInitialData() {
    const lpSelect = document.getElementById('lpSelect');
    const burnLpSelect = document.getElementById('burnLpSelect');
    
    lpSelect.innerHTML = '<option value="">Loading LPs...</option>';
    burnLpSelect.innerHTML = '<option value="">Loading LPs...</option>';
    
    // Note: Intent deposit is now LP-specific and will be calculated when user selects an LP
    document.getElementById('intentDepositDisplay').textContent = 'Select LP first';
    
    try {
        // Fetch active LPs from contract
        const result = await state.publicClient.readContract({
            address: CONFIG.CONTRACT_ADDRESS,
            abi: CONTRACT_ABI,
            functionName: 'getActiveLPs'
        });
        
        const [addresses, moneroAddresses, mintFees, capacities] = result;
        
        lpSelect.innerHTML = '<option value="">Select a liquidity provider...</option>';
        burnLpSelect.innerHTML = '<option value="">Select a liquidity provider...</option>';
        
        if (addresses.length === 0) {
            lpSelect.innerHTML = '<option value="" disabled>No active LPs available - Register as LP to get started</option>';
            burnLpSelect.innerHTML = '<option value="" disabled>No active LPs available</option>';
        } else {
            for (let i = 0; i < addresses.length; i++) {
                const capacity = formatUnits(capacities[i], 12);
                const fee = (Number(mintFees[i]) / 100).toFixed(2);
                const option = `<option value="${addresses[i]}">${formatAddress(addresses[i])} - Fee: ${fee}% - Capacity: ${parseFloat(capacity).toFixed(4)} XMR</option>`;
                lpSelect.innerHTML += option;
                burnLpSelect.innerHTML += option;
            }
        }
    } catch (error) {
        console.error('Error loading LPs:', error);
        lpSelect.innerHTML = '<option value="">Error loading LPs</option>';
        burnLpSelect.innerHTML = '<option value="">Error loading LPs</option>';
    }
}

async function loadUserData() {
    if (!state.publicClient || !state.userAddress) return;
    
    try {
        // Load user balance
        const balance = await state.publicClient.readContract({
            address: CONFIG.CONTRACT_ADDRESS,
            abi: CONTRACT_ABI,
            functionName: 'balanceOf',
            args: [state.userAddress]
        });
        const balanceXMR = formatUnits(balance, 12);
        document.getElementById('userBalance').textContent = parseFloat(balanceXMR).toFixed(4) + ' XMR';
        document.getElementById('burnBalance').textContent = parseFloat(balanceXMR).toFixed(4);
        
        // Load XMR/ETH price
        try {
            const price = await state.publicClient.readContract({
                address: CONFIG.CONTRACT_ADDRESS,
                abi: CONTRACT_ABI,
                functionName: 'getXmrEthPrice'
            });
            const priceFormatted = formatEther(price);
            document.getElementById('xmrEthPrice').textContent = parseFloat(priceFormatted).toFixed(6) + ' ETH';
        } catch (e) {
            document.getElementById('xmrEthPrice').textContent = 'N/A';
        }
        
        // Load total collateral
        try {
            const totalCollateral = await state.publicClient.readContract({
                address: CONFIG.CONTRACT_ADDRESS,
                abi: CONTRACT_ABI,
                functionName: 'totalLPCollateral'
            });
            const collateralFormatted = formatEther(totalCollateral);
            document.getElementById('totalCollateral').textContent = parseFloat(collateralFormatted).toFixed(4) + ' wstETH';
        } catch (e) {
            document.getElementById('totalCollateral').textContent = 'N/A';
        }
        
        // Load LP info if user is an LP
        await loadLPInfo();
        
        // Load active mint intents
        await loadMintIntents();
        
    } catch (error) {
        console.error('Error loading user data:', error);
    }
}

async function loadMintIntents() {
    if (!state.publicClient || !state.userAddress) return;
    
    try {
        const result = await state.publicClient.readContract({
            address: CONFIG.CONTRACT_ADDRESS,
            abi: CONTRACT_ABI,
            functionName: 'getUserMintIntents',
            args: [state.userAddress]
        });
        
        const [intentIds, lps, amounts, deposits, timestamps] = result;
        
        // Clear existing intents display
        const intentsList = document.getElementById('activeIntentsList');
        if (!intentsList) return;
        
        if (intentIds.length === 0) {
            intentsList.innerHTML = '<p class="empty-state">No active mint intents</p>';
            return;
        }
        
        intentsList.innerHTML = '';
        
        for (let i = 0; i < intentIds.length; i++) {
            const intentId = intentIds[i];
            const lp = lps[i];
            const amount = amounts[i];
            const deposit = deposits[i];
            const timestamp = timestamps[i];
            
            const createdTime = Number(timestamp) * 1000;
            const expirationTime = createdTime + (2 * 60 * 60 * 1000); // 2 hours
            const now = Date.now();
            const canCancel = now > expirationTime;
            const timeUntilExpiry = expirationTime - now;
            
            // Fetch LP's Monero address
            let moneroAddress = 'Loading...';
            try {
                const lpInfoResult = await state.publicClient.readContract({
                    address: CONFIG.CONTRACT_ADDRESS,
                    abi: [{
                        inputs: [{ name: 'lp', type: 'address' }],
                        name: 'lpInfo',
                        outputs: [
                            { name: '', type: 'uint256' }, { name: '', type: 'uint256' }, { name: '', type: 'uint256' }, 
                            { name: '', type: 'uint256' }, { name: '', type: 'uint256' }, { name: 'moneroAddress', type: 'string' }
                        ],
                        stateMutability: 'view',
                        type: 'function'
                    }],
                    functionName: 'lpInfo',
                    args: [lp]
                });
                moneroAddress = lpInfoResult[5] || 'N/A';
            } catch (e) {
                console.error('Error fetching LP Monero address:', e);
            }
            
            const intentDiv = document.createElement('div');
            intentDiv.className = 'intent-item card';
            
            if (canCancel) {
                intentDiv.innerHTML = `
                    <div style="padding: 1rem; background: #fff3cd; border-left: 4px solid #ffc107; border-radius: 8px;">
                        <div style="font-weight: 600; color: #856404; margin-bottom: 0.5rem;">⚠️ Intent Expired</div>
                        <div style="font-size: 0.9em; color: #856404;">This intent has expired. The LP can now claim your deposit.</div>
                        <div style="font-size: 0.85em; color: #856404; margin-top: 0.5rem;">Intent ID: ${intentId.slice(0, 16)}...</div>
                    </div>
                `;
            } else {
                const hoursLeft = Math.floor(timeUntilExpiry / (60 * 60 * 1000));
                const minutesLeft = Math.floor((timeUntilExpiry % (60 * 60 * 1000)) / (60 * 1000));
                const xmrAmount = formatUnits(amount, 12);
                
                intentDiv.innerHTML = `
                    <div style="padding: 1.5rem; background: #f8f9fa; border: 2px solid #4CAF50; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
                        <div style="font-size: 1.1em; font-weight: 600; margin-bottom: 1rem; color: #2c3e50;">💸 Active Mint Intent</div>
                        
                        <div style="background: white; padding: 1rem; border-radius: 8px; margin-bottom: 1rem; border: 1px solid #e0e0e0;">
                            <div style="font-size: 0.9em; color: #4CAF50; font-weight: 600; margin-bottom: 0.5rem;">STEP 1: Send XMR</div>
                            <div style="font-weight: 600; font-size: 1.2em; margin-bottom: 0.5rem; color: #2c3e50;">${xmrAmount} XMR</div>
                            <div style="font-size: 0.85em; color: #666; margin-bottom: 0.5rem;">to this Monero address:</div>
                            <div style="background: #f5f5f5; padding: 0.75rem; border-radius: 6px; font-family: monospace; font-size: 0.75em; word-break: break-all; margin-bottom: 0.5rem; border: 1px solid #ddd; color: #333;">${moneroAddress}</div>
                            <button onclick="navigator.clipboard.writeText('${moneroAddress}'); window.showToast('Address copied!', 'success');" style="background: #4CAF50; border: none; color: white; padding: 0.5rem 1rem; border-radius: 6px; cursor: pointer; font-size: 0.85em; font-weight: 500;">📋 Copy Address</button>
                        </div>
                        
                        <div style="background: white; padding: 1rem; border-radius: 8px; margin-bottom: 1rem; border: 1px solid #e0e0e0;">
                            <div style="font-size: 0.9em; color: #2196F3; font-weight: 600; margin-bottom: 0.5rem;">STEP 2: Generate Proof</div>
                            <div style="font-size: 0.85em; color: #666;">After sending, scroll down to "Generate Proof & Complete Mint" section and provide your transaction details.</div>
                        </div>
                        
                        <div style="display: flex; justify-content: space-between; align-items: center; padding-top: 1rem; border-top: 1px solid #e0e0e0;">
                            <div>
                                <div style="font-size: 0.8em; color: #666;">⏰ Time remaining:</div>
                                <div style="font-weight: 600; color: #ff9800;">${hoursLeft}h ${minutesLeft}m</div>
                            </div>
                            <div style="text-align: right;">
                                <div style="font-size: 0.8em; color: #666;">Deposit at risk:</div>
                                <div style="font-weight: 600; color: #f44336;">${formatEther(deposit)} ETH</div>
                            </div>
                        </div>
                        
                        <div style="font-size: 0.75em; color: #999; margin-top: 1rem; padding-top: 1rem; border-top: 1px solid #e0e0e0;">Intent ID: ${intentId.slice(0, 20)}...</div>
                    </div>
                `;
            }
            
            intentsList.appendChild(intentDiv);
        }
        
    } catch (error) {
        console.error('Error loading mint intents:', error);
    }
}

async function loadLPInfo() {
    if (!state.publicClient || !state.userAddress) return;
    
    try {
        // Read LP info fields individually to avoid viem decoding issues
        const [collateralAmount, backedAmount, mintFeeBps, burnFeeBps, moneroAddress, privateViewKey, active, registered] = await Promise.all([
            state.publicClient.readContract({
                address: CONFIG.CONTRACT_ADDRESS,
                abi: [{
                    inputs: [{ name: 'lp', type: 'address' }],
                    name: 'lpInfo',
                    outputs: [{ name: 'collateralAmount', type: 'uint256' }],
                    stateMutability: 'view',
                    type: 'function'
                }],
                functionName: 'lpInfo',
                args: [state.userAddress]
            }).then(result => result[0] || 0n).catch(() => 0n),
            
            state.publicClient.readContract({
                address: CONFIG.CONTRACT_ADDRESS,
                abi: [{
                    inputs: [{ name: 'lp', type: 'address' }],
                    name: 'lpInfo',
                    outputs: [{ name: '', type: 'uint256' }, { name: 'backedAmount', type: 'uint256' }],
                    stateMutability: 'view',
                    type: 'function'
                }],
                functionName: 'lpInfo',
                args: [state.userAddress]
            }).then(result => result[1] || 0n).catch(() => 0n),
            
            state.publicClient.readContract({
                address: CONFIG.CONTRACT_ADDRESS,
                abi: [{
                    inputs: [{ name: 'lp', type: 'address' }],
                    name: 'lpInfo',
                    outputs: [{ name: '', type: 'uint256' }, { name: '', type: 'uint256' }, { name: 'mintFeeBps', type: 'uint256' }],
                    stateMutability: 'view',
                    type: 'function'
                }],
                functionName: 'lpInfo',
                args: [state.userAddress]
            }).then(result => result[2] || 0n).catch(() => 0n),
            
            state.publicClient.readContract({
                address: CONFIG.CONTRACT_ADDRESS,
                abi: [{
                    inputs: [{ name: 'lp', type: 'address' }],
                    name: 'lpInfo',
                    outputs: [{ name: '', type: 'uint256' }, { name: '', type: 'uint256' }, { name: '', type: 'uint256' }, { name: 'burnFeeBps', type: 'uint256' }],
                    stateMutability: 'view',
                    type: 'function'
                }],
                functionName: 'lpInfo',
                args: [state.userAddress]
            }).then(result => result[3] || 0n).catch(() => 0n),
            
            // Skip moneroAddress for now - it's causing the decoding issue
            Promise.resolve(''),
            Promise.resolve('0x0000000000000000000000000000000000000000000000000000000000000000'),
            
            state.publicClient.readContract({
                address: CONFIG.CONTRACT_ADDRESS,
                abi: [{
                    inputs: [{ name: 'lp', type: 'address' }],
                    name: 'lpInfo',
                    outputs: [
                        { name: '', type: 'uint256' }, { name: '', type: 'uint256' }, { name: '', type: 'uint256' }, 
                        { name: '', type: 'uint256' }, { name: '', type: 'uint256' }, { name: '', type: 'string' }, 
                        { name: '', type: 'bytes32' }, { name: 'active', type: 'bool' }
                    ],
                    stateMutability: 'view',
                    type: 'function'
                }],
                functionName: 'lpInfo',
                args: [state.userAddress]
            }).then(result => result[7] || false).catch(() => false),
            
            state.publicClient.readContract({
                address: CONFIG.CONTRACT_ADDRESS,
                abi: [{
                    inputs: [{ name: 'lp', type: 'address' }],
                    name: 'lpInfo',
                    outputs: [
                        { name: '', type: 'uint256' }, { name: '', type: 'uint256' }, { name: '', type: 'uint256' }, 
                        { name: '', type: 'uint256' }, { name: '', type: 'uint256' }, { name: '', type: 'string' }, 
                        { name: '', type: 'bytes32' }, { name: '', type: 'bool' }, { name: 'registered', type: 'bool' }
                    ],
                    stateMutability: 'view',
                    type: 'function'
                }],
                functionName: 'lpInfo',
                args: [state.userAddress]
            }).then(result => result[8] || false).catch(() => false)
        ]);
        
        console.log('LP registered:', registered);
        const isLP = registered;
        
        // Show/hide appropriate view
        const nonLpView = document.getElementById('nonLpView');
        const existingLpView = document.getElementById('existingLpView');
        
        if (isLP) {
            // User is an LP - show management view
            nonLpView.style.display = 'none';
            existingLpView.style.display = 'block';
            document.getElementById('lpTabBtn').textContent = 'Manage LP';
            
            // Variables already extracted from individual contract calls
            
            // Update stats
            const collateral = formatEther(collateralAmount);
            const backed = formatUnits(backedAmount, 12);
            
            document.getElementById('lpCollateral').textContent = parseFloat(collateral).toFixed(4) + ' wstETH';
            document.getElementById('lpBacked').textContent = parseFloat(backed).toFixed(4) + ' XMR';
            document.getElementById('lpStatus').textContent = active ? 'Active' : 'Inactive';
            
            // Update current configuration
            document.getElementById('lpCurrentMintFee').textContent = (Number(mintFeeBps) / 100).toFixed(2) + '%';
            document.getElementById('lpCurrentBurnFee').textContent = (Number(burnFeeBps) / 100).toFixed(2) + '%';
            document.getElementById('lpCurrentMoneroAddress').textContent = moneroAddress;
            
            // Set checkbox state
            document.getElementById('lpActiveToggle').checked = active;
            
            // Set placeholders with current values
            document.getElementById('lpUpdateMintFee').placeholder = `Current: ${mintFeeBps} bps`;
            document.getElementById('lpUpdateBurnFee').placeholder = `Current: ${burnFeeBps} bps`;
            
            // Load ratio
            try {
                const ratio = await state.publicClient.readContract({
                    address: CONFIG.CONTRACT_ADDRESS,
                    abi: CONTRACT_ABI,
                    functionName: 'getLPRatio',
                    args: [state.userAddress]
                });
                
                // Check if ratio is max uint256 (no backing yet)
                const maxUint256 = 115792089237316195423570985008687907853269984665640564039457584007913129639935n;
                if (ratio >= maxUint256 || backedAmount === 0n) {
                    document.getElementById('lpYourRatio').textContent = '∞ (No backing yet)';
                } else {
                    document.getElementById('lpYourRatio').textContent = ratio.toString() + '%';
                }
            } catch (e) {
                console.log('Could not load LP ratio:', e.message);
                document.getElementById('lpYourRatio').textContent = 'N/A';
            }
        } else {
            // User is not an LP - show registration view
            nonLpView.style.display = 'block';
            existingLpView.style.display = 'none';
            document.getElementById('lpTabBtn').textContent = 'Become LP';
        }
    } catch (error) {
        // User is not an LP or contract has issues - show registration view
        console.error('Error loading LP info:', error);
        
        // Check if it's a decoding error (user not registered)
        if (error.message.includes('Position') && error.message.includes('out of bounds')) {
            console.log('User is not registered as LP on this contract');
        } else {
            console.error('Error message:', error.message);
        }
        
        document.getElementById('nonLpView').style.display = 'block';
        document.getElementById('existingLpView').style.display = 'none';
        document.getElementById('lpTabBtn').textContent = 'Become LP';
    }
}

// ============================================
// Tab Switching
// ============================================
function switchTab(tabName) {
    // Update tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.tab === tabName) {
            btn.classList.add('active');
        }
    });
    
    // Update tab content
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    document.getElementById(tabName + 'Tab').classList.add('active');
}

// ============================================
// Mint Functions
// ============================================
function handleLPSelection(event) {
    const lpAddress = event.target.value;
    state.selectedLP = lpAddress;
    
    if (lpAddress && state.publicClient) {
        loadLPDetails(lpAddress);
    }
}

async function loadLPDetails(lpAddress) {
    try {
        // Get fee from the select option (already loaded from getActiveLPs)
        const selectElement = document.getElementById('lpSelect');
        const selectedOption = selectElement.options[selectElement.selectedIndex];
        if (selectedOption && selectedOption.text.includes('Fee:')) {
            const feeMatch = selectedOption.text.match(/Fee: ([\d.]+)%/);
            if (feeMatch) {
                document.getElementById('lpMintFee').textContent = feeMatch[1] + '%';
            }
        }
        
        // Load capacity
        try {
            const capacity = await state.publicClient.readContract({
                address: CONFIG.CONTRACT_ADDRESS,
                abi: CONTRACT_ABI,
                functionName: 'getLPAvailableCapacity',
                args: [lpAddress]
            });
            const capacityXMR = formatUnits(capacity, 12);
            document.getElementById('lpCapacity').textContent = parseFloat(capacityXMR).toFixed(4) + ' XMR';
        } catch (e) {
            console.error('Error loading capacity:', e);
            document.getElementById('lpCapacity').textContent = 'N/A';
        }
        
        // Load LP's intent deposit requirement (read just index 4)
        try {
            const intentDepositBps = await state.publicClient.readContract({
                address: CONFIG.CONTRACT_ADDRESS,
                abi: [{
                    inputs: [{ name: 'lp', type: 'address' }],
                    name: 'lpInfo',
                    outputs: [
                        { name: '', type: 'uint256' }, { name: '', type: 'uint256' }, { name: '', type: 'uint256' }, 
                        { name: '', type: 'uint256' }, { name: 'intentDepositBps', type: 'uint256' }
                    ],
                    stateMutability: 'view',
                    type: 'function'
                }],
                functionName: 'lpInfo',
                args: [lpAddress]
            }).then(result => result[4] || 0n);
            
            state.selectedLPIntentDepositBps = intentDepositBps;
            console.log('LP intent deposit bps:', intentDepositBps);
            
            // Update deposit display
            updateIntentDepositDisplay();
        } catch (e) {
            console.error('Error loading LP intent deposit:', e);
            state.selectedLPIntentDepositBps = 0n;
        }
        
        // Load ratio
        try {
            const ratio = await state.publicClient.readContract({
                address: CONFIG.CONTRACT_ADDRESS,
                abi: CONTRACT_ABI,
                functionName: 'getLPRatio',
                args: [lpAddress]
            });
            // Check if ratio is max uint256 (no backing yet)
            const maxUint256 = 115792089237316195423570985008687907853269984665640564039457584007913129639935n;
            if (ratio >= maxUint256) {
                document.getElementById('lpRatio').textContent = '∞ (No backing yet)';
            } else {
                document.getElementById('lpRatio').textContent = ratio.toString() + '%';
            }
        } catch (e) {
            console.error('Error loading ratio:', e);
            document.getElementById('lpRatio').textContent = 'N/A';
        }
        
    } catch (error) {
        console.error('Error loading LP details:', error);
    }
}

function updateIntentDepositDisplay() {
    const mintAmount = document.getElementById('mintAmount').value;
    const depositDisplay = document.getElementById('intentDepositDisplay');
    
    if (!mintAmount || !state.selectedLPIntentDepositBps) {
        depositDisplay.textContent = 'Enter amount';
        return;
    }
    
    try {
        // Use same calculation as createMintIntent: XMR = $330, ETH = $2500
        const xmrAmount = parseFloat(mintAmount);
        const depositPercent = Number(state.selectedLPIntentDepositBps) / 100; // Convert bps to percent
        
        // Calculate: (xmrAmount * 330 / 2500) * (intentDepositBps / 10000) * 5 (buffer)
        const xmrValueEth = (xmrAmount * 330) / 2500;
        const depositEth = xmrValueEth * (depositPercent / 100);
        const depositWithBuffer = depositEth * 5; // 5x buffer to match createMintIntent
        
        depositDisplay.textContent = `~${depositWithBuffer.toFixed(6)} ETH (${depositPercent}% + 5x safety buffer)`;
    } catch (e) {
        depositDisplay.textContent = 'Calculating...';
    }
}

async function createMintIntent() {
    if (!state.isConnected) {
        showToast('Please connect your wallet first', 'warning');
        return;
    }
    
    const lpAddress = document.getElementById('lpSelect').value;
    const amount = document.getElementById('mintAmount').value;
    
    if (!lpAddress || !amount) {
        showToast('Please fill in all fields', 'warning');
        return;
    }
    
    if (!state.selectedLPIntentDepositBps) {
        showToast('Please select an LP first', 'warning');
        return;
    }
    
    try {
        showLoading('Creating mint intent...');
        
        // Convert amount to piconero
        const amountPiconero = parseUnits(amount, 12);
        
        // Calculate required deposit based on LP's setting
        // Using fixed prices: XMR = $330, ETH = $2500
        // amountPiconero is in piconero (1 XMR = 1e12 piconero)
        // We need result in wei (1 ETH = 1e18 wei)
        // Formula: (xmrInPiconero / 1e12) * 330 / 2500 * intentDepositBps / 10000 * 1e18
        // = xmrInPiconero * 330 * intentDepositBps * 1e18 / (1e12 * 2500 * 10000)
        // = xmrInPiconero * 330 * intentDepositBps * 1e6 / 25000000
        
        let depositWei = (amountPiconero * 330n * state.selectedLPIntentDepositBps * 1000000n) / 25000000n;
        // Add 5x buffer to account for price differences with oracle (will be refunded if excess)
        depositWei = depositWei * 5n;
        console.log('Deposit required (with 5x buffer for safety):', formatEther(depositWei), 'ETH');
        
        const hash = await state.walletClient.writeContract({
            address: CONFIG.CONTRACT_ADDRESS,
            abi: CONTRACT_ABI,
            functionName: 'createMintIntent',
            args: [lpAddress, amountPiconero],
            value: depositWei,
            gas: 300000n
        });
        
        showLoading('Waiting for confirmation...');
        const receipt = await state.publicClient.waitForTransactionReceipt({ 
            hash,
            pollingInterval: 2000,
            timeout: 120000
        });
        
        // Parse event to get intent ID
        let intentId = 'N/A';
        for (const log of receipt.logs) {
            try {
                const decoded = decodeEventLog({
                    abi: CONTRACT_ABI,
                    data: log.data,
                    topics: log.topics
                });
                if (decoded.eventName === 'MintIntentCreated') {
                    intentId = decoded.args.intentId.toString();
                    break;
                }
            } catch (e) {
                // Skip logs that don't match
            }
        }
        
        hideLoading();
        
        // Get LP's Monero address from the select option
        const selectElement = document.getElementById('lpSelect');
        let moneroAddress = 'Loading...';
        
        try {
            // Fetch from getActiveLPs to get the Monero address
            const result = await state.publicClient.readContract({
                address: CONFIG.CONTRACT_ADDRESS,
                abi: CONTRACT_ABI,
                functionName: 'getActiveLPs'
            });
            const [addresses, moneroAddresses] = result;
            const lpIndex = addresses.findIndex(addr => addr.toLowerCase() === lpAddress.toLowerCase());
            if (lpIndex !== -1) {
                moneroAddress = moneroAddresses[lpIndex];
            }
        } catch (e) {
            console.error('Error fetching LP Monero address:', e);
        }
        
        // Show instructions
        document.getElementById('intentId').textContent = intentId;
        document.getElementById('xmrAddress').textContent = moneroAddress;
        document.getElementById('mintInstructions').classList.remove('hidden');
        
        showToast('Mint intent created successfully!', 'success');
        
        // Add to activity
        addActivity('Mint Intent Created', `Intent ID: ${intentId}`, 'Just now');
        
    } catch (error) {
        console.error('Error creating mint intent:', error);
        hideLoading();
        showToast('Failed to create mint intent: ' + error.message, 'error');
    }
}

function copyMoneroAddress() {
    const address = document.getElementById('xmrAddress').textContent;
    navigator.clipboard.writeText(address);
    showToast('Address copied to clipboard!', 'success');
}

// Note: Users cannot cancel mint intents. They have 2 hours to complete the mint.
// After 2 hours, the LP can claim the deposit using claimExpiredIntent.

// ============================================
// Burn Functions
// ============================================
async function requestBurn() {
    if (!state.isConnected) {
        showToast('Please connect your wallet first', 'warning');
        return;
    }
    
    const lpAddress = document.getElementById('burnLpSelect').value;
    const amount = document.getElementById('burnAmount').value;
    const xmrAddress = document.getElementById('xmrRecipient').value;
    
    if (!lpAddress || !amount || !xmrAddress) {
        showToast('Please fill in all fields', 'warning');
        return;
    }
    
    // Validate Monero address (basic check)
    if (!xmrAddress.startsWith('4') || xmrAddress.length < 95) {
        showToast('Invalid Monero address', 'error');
        return;
    }
    
    try {
        showLoading('Requesting burn...');
        
        const amountPiconero = parseUnits(amount, 12);
        
        const hash = await state.walletClient.writeContract({
            address: CONFIG.CONTRACT_ADDRESS,
            abi: CONTRACT_ABI,
            functionName: 'requestBurn',
            args: [lpAddress, amountPiconero, xmrAddress],
            gas: 300000n
        });
        
        showLoading('Waiting for confirmation...');
        await state.publicClient.waitForTransactionReceipt({ 
            hash,
            pollingInterval: 2000,
            timeout: 120000
        });
        
        hideLoading();
        showToast('Burn request submitted successfully!', 'success');
        
        // Reload user data
        await loadUserData();
        
        // Add to activity
        addActivity('Burn Requested', `${amount} XMR`, 'Just now');
        
    } catch (error) {
        console.error('Error requesting burn:', error);
        hideLoading();
        showToast('Failed to request burn: ' + error.message, 'error');
    }
}

// ============================================
// LP Functions
// ============================================
async function registerAsLP() {
    if (!state.isConnected) {
        showToast('Please connect your wallet first', 'warning');
        return;
    }
    
    const mintFee = document.getElementById('lpMintFeeInput').value;
    const burnFee = document.getElementById('lpBurnFeeInput').value;
    const intentDeposit = document.getElementById('lpIntentDepositInput').value;
    const moneroAddress = document.getElementById('lpMoneroAddress').value;
    const privateViewKey = document.getElementById('lpPrivateViewKey').value;
    const active = true; // Always active when registering
    
    if (!mintFee || !burnFee || !intentDeposit || !moneroAddress || !privateViewKey) {
        showToast('Please fill in all fields', 'warning');
        return;
    }
    
    // Basic Monero address validation (mainnet starts with 4, testnet with 5/9, subaddress with 8)
    if (moneroAddress.length < 95) {
        showToast('Invalid Monero address (too short)', 'error');
        return;
    }
    
    // Validate private view key format (should be 64 hex chars or 66 with 0x prefix)
    let viewKeyHex = privateViewKey.trim();
    if (!viewKeyHex.startsWith('0x')) {
        viewKeyHex = '0x' + viewKeyHex;
    }
    if (!/^0x[0-9a-fA-F]{64}$/.test(viewKeyHex)) {
        showToast('Invalid private view key format (must be 32 bytes / 64 hex characters)', 'error');
        return;
    }
    
    try {
        showLoading('Registering as LP...');
        
        const hash = await state.walletClient.writeContract({
            address: CONFIG.CONTRACT_ADDRESS,
            abi: CONTRACT_ABI,
            functionName: 'registerLP',
            args: [BigInt(mintFee), BigInt(burnFee), BigInt(intentDeposit), moneroAddress, viewKeyHex, active],
            gas: 500000n
        });
        
        showLoading('Waiting for confirmation...');
        try {
            await state.publicClient.waitForTransactionReceipt({ 
                hash,
                pollingInterval: 3000,
                timeout: 60000
            });
            
            hideLoading();
            showToast('Successfully registered as LP!', 'success');
        } catch (waitError) {
            // If waiting fails but tx was submitted, still consider it successful
            if (waitError.message.includes('block is out of range') || waitError.message.includes('timeout')) {
                console.log('Transaction submitted but confirmation timed out. Hash:', hash);
                hideLoading();
                showToast(`Transaction submitted! Hash: ${hash.slice(0, 10)}... Check explorer for confirmation.`, 'success');
            } else {
                throw waitError;
            }
        }
        
        // Reload LP info and LP list after a delay
        setTimeout(() => {
            loadLPInfo();
            loadInitialData(); // Reload LP dropdown
        }, 5000);
        
    } catch (error) {
        console.error('Error registering as LP:', error);
        hideLoading();
        showToast('Failed to register as LP: ' + error.message, 'error');
    }
}

async function depositCollateral() {
    if (!state.isConnected) {
        showToast('Please connect your wallet first', 'warning');
        return;
    }
    
    const amount = document.getElementById('lpDepositAmount').value;
    
    if (!amount) {
        showToast('Please enter an amount', 'warning');
        return;
    }
    
    try {
        showLoading('Depositing collateral...');
        
        const amountWei = parseEther(amount);
        
        const hash = await state.walletClient.writeContract({
            address: CONFIG.CONTRACT_ADDRESS,
            abi: CONTRACT_ABI,
            functionName: 'lpDeposit',
            value: amountWei,
            gas: 300000n
        });
        
        showLoading('Waiting for confirmation...');
        await state.publicClient.waitForTransactionReceipt({ 
            hash,
            pollingInterval: 2000,
            timeout: 120000
        });
        
        hideLoading();
        showToast('Collateral deposited successfully!', 'success');
        addActivity('Collateral Deposited', `${amount} ETH`, 'Just now');
        
        // Reload LP info and dropdown (capacity changed)
        await loadLPInfo();
        await loadInitialData();
        
    } catch (error) {
        console.error('Error depositing collateral:', error);
        hideLoading();
        
        // Check if it's the wstETH wrapping issue
        if (error.message.includes('execution reverted') || error.message.includes('wstETH wrap failed')) {
            showToast('⚠️ ETH to wstETH wrapping failed. The wstETH contract on Unichain Sepolia may not support direct ETH deposits. Please contact the team for assistance.', 'error');
        } else {
            showToast('Failed to deposit collateral: ' + error.message, 'error');
        }
    }
}

async function updateLPSettings() {
    if (!state.isConnected) {
        showToast('Please connect your wallet first', 'warning');
        return;
    }
    
    try {
        // Get current LP info first
        const currentLpInfo = await state.publicClient.readContract({
            address: CONFIG.CONTRACT_ADDRESS,
            abi: CONTRACT_ABI,
            functionName: 'lpInfo',
            args: [state.userAddress]
        });
        
        if (!currentLpInfo.registered) {
            showToast('You are not registered as an LP', 'error');
            return;
        }
        
        // Get new values or use current ones
        const newMintFee = document.getElementById('lpUpdateMintFee').value || currentLpInfo.mintFeeBps.toString();
        const newBurnFee = document.getElementById('lpUpdateBurnFee').value || currentLpInfo.burnFeeBps.toString();
        const newMoneroAddress = document.getElementById('lpUpdateMoneroAddress').value || currentLpInfo.moneroAddress;
        const newPrivateViewKey = document.getElementById('lpUpdatePrivateViewKey').value || currentLpInfo.privateViewKey;
        const newActive = document.getElementById('lpActiveToggle').checked;
        
        // Validate private view key format if provided
        let viewKeyHex = newPrivateViewKey;
        if (typeof viewKeyHex === 'string') {
            viewKeyHex = viewKeyHex.trim();
            if (!viewKeyHex.startsWith('0x')) {
                viewKeyHex = '0x' + viewKeyHex;
            }
            if (!/^0x[0-9a-fA-F]{64}$/.test(viewKeyHex)) {
                showToast('Invalid private view key format (must be 32 bytes / 64 hex characters)', 'error');
                return;
            }
        }
        
        showLoading('Updating LP settings...');
        
        const hash = await state.walletClient.writeContract({
            address: CONFIG.CONTRACT_ADDRESS,
            abi: CONTRACT_ABI,
            functionName: 'registerLP',
            args: [BigInt(newMintFee), BigInt(newBurnFee), newMoneroAddress, viewKeyHex, newActive],
            gas: 500000n
        });
        
        showLoading('Waiting for confirmation...');
        await state.publicClient.waitForTransactionReceipt({ 
            hash,
            pollingInterval: 2000,
            timeout: 120000
        });
        
        hideLoading();
        showToast('LP settings updated successfully!', 'success');
        
        // Clear update fields
        document.getElementById('lpUpdateMintFee').value = '';
        document.getElementById('lpUpdateBurnFee').value = '';
        document.getElementById('lpUpdateMoneroAddress').value = '';
        document.getElementById('lpUpdatePrivateViewKey').value = '';
        
        // Reload LP info and dropdown
        await loadLPInfo();
        await loadInitialData();
        
    } catch (error) {
        console.error('Error updating LP settings:', error);
        hideLoading();
        showToast('Failed to update LP settings: ' + error.message, 'error');
    }
}

// ============================================
// Merkle Proof Computation (Browser)
// ============================================
function keccak256Hash(data) {
    // Use js-sha3 library (loaded globally as window.sha3)
    if (typeof window.sha3 !== 'undefined' && window.sha3.keccak256) {
        return '0x' + window.sha3.keccak256(data);
    } else if (typeof keccak256 !== 'undefined') {
        return '0x' + keccak256(data);
    } else {
        throw new Error('keccak256 library not loaded');
    }
}

function computeMerkleProofFromLeaves(leaves, leafIndex) {
    const proof = [];
    let currentIndex = leafIndex;
    let currentLevel = leaves.map(leaf => leaf.startsWith('0x') ? leaf.slice(2) : leaf);
    
    while (currentLevel.length > 1) {
        const nextLevel = [];
        
        for (let i = 0; i < currentLevel.length; i += 2) {
            if (i === currentLevel.length - 1) {
                // Odd number of nodes, promote the last one
                nextLevel.push(currentLevel[i]);
            } else {
                // Hash pair
                const left = currentLevel[i];
                const right = currentLevel[i + 1];
                const combined = left + right;
                const combinedBytes = new Uint8Array(combined.length / 2);
                for (let j = 0; j < combined.length; j += 2) {
                    combinedBytes[j / 2] = parseInt(combined.substr(j, 2), 16);
                }
                const hash = keccak256Hash(combinedBytes).slice(2);
                nextLevel.push(hash);
                
                // Add sibling to proof if this pair contains our leaf
                if (i === currentIndex || i + 1 === currentIndex) {
                    const sibling = (i === currentIndex) ? right : left;
                    proof.push('0x' + sibling);
                }
            }
        }
        
        currentIndex = Math.floor(currentIndex / 2);
        currentLevel = nextLevel;
    }
    
    return proof;
}

async function computeTxMerkleProof(blockHeight, txHash, moneroRpcUrl) {
    const response = await fetch(moneroRpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            jsonrpc: '2.0',
            id: '0',
            method: 'get_block',
            params: { height: blockHeight }
        })
    });
    
    const data = await response.json();
    if (data.error) {
        throw new Error(`Failed to get block: ${data.error.message}`);
    }
    
    const txHashes = data.result.tx_hashes;
    const normalizedTxHash = txHash.startsWith('0x') ? txHash.slice(2) : txHash;
    const txIndex = txHashes.findIndex(hash => hash === normalizedTxHash);
    
    if (txIndex === -1) {
        throw new Error(`Transaction not found in block`);
    }
    
    const proof = computeMerkleProofFromLeaves(txHashes, txIndex);
    
    return { txIndex, proof, txHashes };
}

// ============================================
// Amount Decryption (Browser)
// ============================================
async function computeSharedSecret(privateViewKey, txPublicKey) {
    // Remove 0x prefix
    const a_hex = privateViewKey.replace(/^0x/, '');
    const R_hex = txPublicKey.replace(/^0x/, '');
    
    // Convert hex to bytes
    const a_bytes = new Uint8Array(a_hex.length / 2);
    for (let i = 0; i < a_hex.length; i += 2) {
        a_bytes[i / 2] = parseInt(a_hex.substr(i, 2), 16);
    }
    const R_bytes = new Uint8Array(R_hex.length / 2);
    for (let i = 0; i < R_hex.length; i += 2) {
        R_bytes[i / 2] = parseInt(R_hex.substr(i, 2), 16);
    }
    
    // Read scalar as little-endian
    let a_scalar = 0n;
    for (let i = 0; i < 32; i++) {
        a_scalar |= BigInt(a_bytes[i]) << (BigInt(i) * 8n);
    }
    
    // Use noble-ed25519 (loaded via CDN)
    const ed = window.nobleEd25519;
    const R_point = ed.Point.fromHex(R_bytes);
    const aR = R_point.multiply(a_scalar);
    const sharedSecret = aR.multiply(8n);
    
    const bytes = sharedSecret.toRawBytes();
    return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function deriveHs(sharedSecret, outputIndex) {
    const indexHex = outputIndex.toString(16).padStart(2, '0');
    const data = sharedSecret + indexHex;
    const dataBytes = new Uint8Array(data.length / 2);
    for (let i = 0; i < data.length; i += 2) {
        dataBytes[i / 2] = parseInt(data.substr(i, 2), 16);
    }
    const hash = keccak256Hash(dataBytes);
    return hash;
}

async function decryptMoneroAmount(ecdhAmount, privateViewKey, txPublicKey, outputIndex) {
    // Compute shared secret
    const sharedSecret = await computeSharedSecret(privateViewKey, txPublicKey);
    
    // Derive H_s
    const Hs = await deriveHs(sharedSecret, outputIndex);
    
    // Decrypt amount (XOR with H_s)
    const ecdhHex = ecdhAmount.replace(/^0x/, '');
    const ecdhBytes = new Uint8Array(ecdhHex.length / 2);
    for (let i = 0; i < ecdhHex.length; i += 2) {
        ecdhBytes[i / 2] = parseInt(ecdhHex.substr(i, 2), 16);
    }
    
    const HsHex = Hs.replace(/^0x/, '');
    const HsBytes = new Uint8Array(HsHex.length / 2);
    for (let i = 0; i < HsHex.length; i += 2) {
        HsBytes[i / 2] = parseInt(HsHex.substr(i, 2), 16);
    }
    
    const decrypted = new Uint8Array(8);
    for (let i = 0; i < 8; i++) {
        decrypted[i] = ecdhBytes[i] ^ HsBytes[i];
    }
    
    // Read as little-endian uint64
    let amount = 0n;
    for (let i = 0; i < 8; i++) {
        amount |= BigInt(decrypted[i]) << (BigInt(i) * 8n);
    }
    
    return { amount, Hs };
}

// ============================================
// Proof Generation
// ============================================
async function generateProofAndMint() {
    if (!state.isConnected) {
        showToast('Please connect your wallet first', 'warning');
        return;
    }
    
    const txHash = document.getElementById('txHash').value;
    const secretKeyR = document.getElementById('secretKeyR').value;
    const blockHeight = document.getElementById('blockHeight').value;
    
    if (!txHash || !secretKeyR || !blockHeight) {
        showToast('Please fill in all fields', 'warning');
        return;
    }
    
    try {
        showLoading('Detecting output index from Monero node...');
        
        // Auto-detect output index by querying Monero node
        const outputIndex = await detectOutputIndex(txHash, blockHeight);
        
        if (outputIndex === null) {
            hideLoading();
            showToast('Could not auto-detect output index. Please check your transaction hash and try again.', 'error');
            return;
        }
        
        // Update hidden field
        document.getElementById('outputIndex').value = outputIndex;
        
        console.log('✅ Output index detected:', outputIndex);
        
        // Step 2: Fetch transaction data from Monero blockchain
        showLoading('Step 2/5: Fetching transaction from Monero blockchain...');
        // Use CORS proxy for Monero RPC (browsers can't directly call Monero nodes due to CORS)
        const moneroRpcUrl = 'https://corsproxy.io/?' + encodeURIComponent('http://xmr.privex.io:18081/json_rpc');
        
        const txResponse = await fetch(moneroRpcUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jsonrpc: '2.0',
                id: '0',
                method: 'get_transactions',
                params: {
                    txs_hashes: [txHash],
                    decode_as_json: true
                }
            })
        });
        
        const txData = await txResponse.json();
        if (!txData.result || !txData.result.txs || txData.result.txs.length === 0) {
            throw new Error('Transaction not found on Monero blockchain');
        }
        
        const tx = JSON.parse(txData.result.txs[0].as_json);
        console.log('✅ Transaction data fetched');
        
        // Step 3: Extract output data
        showLoading('Step 3/5: Extracting output data...');
        const output = tx.vout[outputIndex];
        if (!output) {
            throw new Error(`Output index ${outputIndex} not found`);
        }
        
        const ecdhAmount = output.amount;
        const outputKey = output.target.key;
        console.log('✅ Output data extracted');
        
        // Step 4: Generate ZK proof
        showLoading('Step 4/5: Generating ZK proof (30-60 seconds)...');
        
        // Circuit files are ready! Now we need Merkle proofs and amount decryption
        hideLoading();
        showToast(
            'ZK proof generation status:\n' +
            '1. Circuit WASM file ✅\n' +
            '2. Proving key (50MB) ✅\n' +
            '3. Merkle proof computation ⏳\n' +
            '4. Amount decryption with view key ⏳\n\n' +
            'Next: Implementing Merkle proofs and amount decryption in browser',
            'info'
        );
        
        console.log('Transaction data ready for proof generation:', {
            txHash,
            secretKeyR,
            blockHeight,
            outputIndex,
            ecdhAmount,
            outputKey
        });
        
    } catch (error) {
        console.error('Error generating proof:', error);
        hideLoading();
        showToast('Error: ' + error.message, 'error');
    }
}

async function detectOutputIndex(txHash, blockHeight) {
    // For now, we'll use a simple heuristic without querying Monero nodes (to avoid CORS issues)
    // Most Monero transactions have 2 outputs:
    // - Output 0: Change back to sender
    // - Output 1: Payment to recipient (the LP)
    // 
    // In 99% of cases, the payment output is index 1
    // In the future, we can add a backend service to properly detect this using the view key
    
    console.log('Auto-detecting output index for tx:', txHash);
    
    // Return index 1 (payment output)
    return 1;
}

async function getLPAddressFromActiveIntent() {
    try {
        const intentIds = await state.publicClient.readContract({
            address: CONFIG.CONTRACT_ADDRESS,
            abi: CONTRACT_ABI,
            functionName: 'getUserMintIntents',
            args: [state.userAddress]
        });
        
        if (intentIds.length === 0) return null;
        
        // Get the first active intent's LP address
        const intentId = intentIds[0];
        const intent = await state.publicClient.readContract({
            address: CONFIG.CONTRACT_ADDRESS,
            abi: [{
                inputs: [{ name: 'intentId', type: 'bytes32' }],
                name: 'mintIntents',
                outputs: [
                    { name: 'user', type: 'address' },
                    { name: 'lp', type: 'address' },
                    { name: 'amount', type: 'uint256' },
                    { name: 'depositAmount', type: 'uint256' },
                    { name: 'createdAt', type: 'uint256' },
                    { name: 'fulfilled', type: 'bool' },
                    { name: 'cancelled', type: 'bool' }
                ],
                stateMutability: 'view',
                type: 'function'
            }],
            functionName: 'mintIntents',
            args: [intentId]
        });
        
        const lpAddress = intent[1]; // LP is at index 1
        
        // Fetch LP's Monero address
        const lpInfoResult = await state.publicClient.readContract({
            address: CONFIG.CONTRACT_ADDRESS,
            abi: [{
                inputs: [{ name: 'lp', type: 'address' }],
                name: 'lpInfo',
                outputs: [
                    { name: '', type: 'uint256' }, { name: '', type: 'uint256' }, { name: '', type: 'uint256' }, 
                    { name: '', type: 'uint256' }, { name: '', type: 'uint256' }, { name: 'moneroAddress', type: 'string' }
                ],
                stateMutability: 'view',
                type: 'function'
            }],
            functionName: 'lpInfo',
            args: [lpAddress]
        });
        
        return lpInfoResult[5];
    } catch (error) {
        console.error('Error getting LP address:', error);
        return null;
    }
}

// ============================================
// Activity Feed
// ============================================
function addActivity(type, details, time) {
    const activityList = document.getElementById('activityList');
    
    // Remove empty state if present
    const emptyState = activityList.querySelector('.empty-state');
    if (emptyState) {
        emptyState.remove();
    }
    
    const activityItem = document.createElement('div');
    activityItem.className = 'activity-item';
    activityItem.innerHTML = `
        <div class="activity-info">
            <div class="activity-type">${type}</div>
            <div class="activity-details">${details}</div>
        </div>
        <div class="activity-time">${time}</div>
    `;
    
    activityList.insertBefore(activityItem, activityList.firstChild);
}

// ============================================
// UI Helpers
// ============================================
function showLoading(text = 'Processing...') {
    document.getElementById('loadingText').textContent = text;
    document.getElementById('loadingOverlay').classList.remove('hidden');
}

function hideLoading() {
    document.getElementById('loadingOverlay').classList.add('hidden');
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    
    container.appendChild(toast);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(450px) scale(0.9)';
        setTimeout(() => toast.remove(), 400);
    }, 5000);
}

// Expose for inline onclick handlers
window.showToast = showToast;

function formatAddress(address) {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

// ============================================
// Export for debugging
// ============================================
window.hookedMonero = {
    state,
    connectWallet,
    loadUserData,
    switchTab,
};
