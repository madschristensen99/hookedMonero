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
    CONTRACT_ADDRESS: '0x956d362086076b05Cf90CBf2EF30689b1172c9C5',
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
                { name: 'active', type: 'bool' }
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
    document.getElementById('createIntentBtn').addEventListener('click', createMintIntent);
    const copyBtn = document.getElementById('copyAddressBtn');
    if (copyBtn) copyBtn.addEventListener('click', copyMoneroAddress);
    
    // Burn tab
    document.getElementById('burnBtn').addEventListener('click', requestBurn);
    
    // LP tab
    document.getElementById('registerLpBtn').addEventListener('click', registerAsLP);
    document.getElementById('depositCollateralBtn').addEventListener('click', depositCollateral);
    
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
    // Load mock LP data for now
    const lpSelect = document.getElementById('lpSelect');
    const burnLpSelect = document.getElementById('burnLpSelect');
    
    // TODO: Load actual LPs from contract
    lpSelect.innerHTML = '<option value="">Select a liquidity provider...</option>';
    burnLpSelect.innerHTML = '<option value="">Select a liquidity provider...</option>';
    
    // Add placeholder
    const option = '<option value="0x0000000000000000000000000000000000000000">No LPs available yet</option>';
    lpSelect.innerHTML += option;
    burnLpSelect.innerHTML += option;
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
        
    } catch (error) {
        console.error('Error loading user data:', error);
    }
}

async function loadLPInfo() {
    if (!state.publicClient || !state.userAddress) return;
    
    try {
        const lpInfo = await state.publicClient.readContract({
            address: CONFIG.CONTRACT_ADDRESS,
            abi: CONTRACT_ABI,
            functionName: 'lpInfo',
            args: [state.userAddress]
        });
        
        if (lpInfo.collateralAmount > 0n) {
            // User is an LP
            const collateral = formatEther(lpInfo.collateralAmount);
            const backed = formatUnits(lpInfo.backedAmount, 12);
            
            document.getElementById('lpCollateral').textContent = parseFloat(collateral).toFixed(4) + ' wstETH';
            document.getElementById('lpBacked').textContent = parseFloat(backed).toFixed(4) + ' XMR';
            
            // Load ratio
            try {
                const ratio = await state.publicClient.readContract({
                    address: CONFIG.CONTRACT_ADDRESS,
                    abi: CONTRACT_ABI,
                    functionName: 'getLPRatio',
                    args: [state.userAddress]
                });
                document.getElementById('lpYourRatio').textContent = ratio.toString() + '%';
            } catch (e) {
                console.log('Could not load LP ratio:', e.message);
                document.getElementById('lpYourRatio').textContent = 'N/A';
            }
        }
    } catch (error) {
        // Silently fail if user is not an LP or contract has issues
        console.log('User is not an LP or LP info unavailable');
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
        const lpInfo = await state.publicClient.readContract({
            address: CONFIG.CONTRACT_ADDRESS,
            abi: CONTRACT_ABI,
            functionName: 'lpInfo',
            args: [lpAddress]
        });
        
        document.getElementById('lpMintFee').textContent = (Number(lpInfo.mintFeeBps) / 100).toFixed(2) + '%';
        
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
            document.getElementById('lpCapacity').textContent = 'N/A';
        }
        
        // Load ratio
        try {
            const ratio = await state.publicClient.readContract({
                address: CONFIG.CONTRACT_ADDRESS,
                abi: CONTRACT_ABI,
                functionName: 'getLPRatio',
                args: [lpAddress]
            });
            document.getElementById('lpRatio').textContent = ratio.toString() + '%';
        } catch (e) {
            document.getElementById('lpRatio').textContent = 'N/A';
        }
        
    } catch (error) {
        console.error('Error loading LP details:', error);
    }
}

async function createMintIntent() {
    if (!state.isConnected) {
        showToast('Please connect your wallet first', 'warning');
        return;
    }
    
    const lpAddress = document.getElementById('lpSelect').value;
    const amount = document.getElementById('mintAmount').value;
    const deposit = document.getElementById('intentDeposit').value;
    
    if (!lpAddress || !amount || !deposit) {
        showToast('Please fill in all fields', 'warning');
        return;
    }
    
    try {
        showLoading('Creating mint intent...');
        
        // Convert amount to piconero
        const amountPiconero = parseUnits(amount, 12);
        const depositWei = parseEther(deposit);
        
        const hash = await state.walletClient.writeContract({
            address: CONFIG.CONTRACT_ADDRESS,
            abi: CONTRACT_ABI,
            functionName: 'createMintIntent',
            args: [lpAddress, amountPiconero],
            value: depositWei
        });
        
        showLoading('Waiting for confirmation...');
        const receipt = await state.publicClient.waitForTransactionReceipt({ hash });
        
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
        
        // Show instructions
        document.getElementById('intentId').textContent = intentId;
        document.getElementById('xmrAddress').textContent = 'TODO: Get Monero address from LP';
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
            args: [lpAddress, amountPiconero, xmrAddress]
        });
        
        showLoading('Waiting for confirmation...');
        await state.publicClient.waitForTransactionReceipt({ hash });
        
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
    const active = document.getElementById('lpActiveCheckbox').checked;
    
    if (!mintFee || !burnFee) {
        showToast('Please fill in all fields', 'warning');
        return;
    }
    
    try {
        showLoading('Registering as LP...');
        
        const hash = await state.walletClient.writeContract({
            address: CONFIG.CONTRACT_ADDRESS,
            abi: CONTRACT_ABI,
            functionName: 'registerLP',
            args: [BigInt(mintFee), BigInt(burnFee), active]
        });
        
        showLoading('Waiting for confirmation...');
        await state.publicClient.waitForTransactionReceipt({ hash });
        
        hideLoading();
        showToast('Successfully registered as LP!', 'success');
        
        // Reload LP info
        await loadLPInfo();
        
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
            value: amountWei
        });
        
        showLoading('Waiting for confirmation...');
        await state.publicClient.waitForTransactionReceipt({ hash });
        
        hideLoading();
        showToast('Collateral deposited successfully!', 'success');
        
        // Reload LP info
        await loadLPInfo();
        
    } catch (error) {
        console.error('Error depositing collateral:', error);
        hideLoading();
        showToast('Failed to deposit collateral: ' + error.message, 'error');
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
