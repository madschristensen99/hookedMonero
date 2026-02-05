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

// ============================================
// State Management
// ============================================
let state = {
    provider: null,
    signer: null,
    contract: null,
    userAddress: null,
    isConnected: false,
    selectedLP: null,
};

// ============================================
// Contract ABI (Simplified - Add full ABI later)
// ============================================
const CONTRACT_ABI = [
    "function balanceOf(address) view returns (uint256)",
    "function lpInfo(address) view returns (tuple(uint256 collateralAmount, uint256 backedAmount, uint256 mintFeeBps, uint256 burnFeeBps, bool active))",
    "function createMintIntent(address lp, uint256 expectedAmount) payable returns (uint256)",
    "function requestBurn(address lp, uint256 amount, string xmrAddress) returns (uint256)",
    "function registerLP(uint256 mintFeeBps, uint256 burnFeeBps, bool active)",
    "function lpDeposit() payable",
    "function getXmrEthPrice() view returns (uint256)",
    "function getLPRatio(address lp) view returns (uint256)",
    "function getLPAvailableCapacity(address lp) view returns (uint256)",
    "function totalLPCollateral() view returns (uint256)",
    "event MintIntentCreated(uint256 indexed intentId, address indexed user, address indexed lp, uint256 expectedAmount)",
    "event BurnRequested(uint256 indexed burnId, address indexed user, address indexed lp, uint256 amount, string xmrAddress)",
];

// ============================================
// Initialization
// ============================================
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🌉 Hooked Monero Frontend Initialized');
    
    // Setup event listeners
    setupEventListeners();
    
    // Check if wallet is already connected
    if (typeof window.ethereum !== 'undefined') {
        const accounts = await window.ethereum.request({ method: 'eth_accounts' });
        if (accounts.length > 0) {
            await connectWallet();
        }
    }
    
    // Load initial data
    await loadInitialData();
});

// ============================================
// Event Listeners
// ============================================
function setupEventListeners() {
    // Wallet connection
    document.getElementById('connectWallet').addEventListener('click', connectWallet);
    
    // Tab switching - FIXED
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
    if (typeof window.ethereum !== 'undefined') {
        window.ethereum.on('accountsChanged', handleAccountsChanged);
        window.ethereum.on('chainChanged', () => window.location.reload());
    }
}

// ============================================
// Wallet Connection
// ============================================
async function connectWallet() {
    try {
        if (typeof window.ethereum === 'undefined') {
            showToast('Please install MetaMask or another Web3 wallet', 'error');
            return;
        }
        
        showLoading('Connecting wallet...');
        
        // Request account access
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        
        // Setup provider and signer
        state.provider = new ethers.providers.Web3Provider(window.ethereum);
        state.signer = state.provider.getSigner();
        state.userAddress = accounts[0];
        state.isConnected = true;
        
        // Check network
        const network = await state.provider.getNetwork();
        if (network.chainId !== CONFIG.CHAIN_ID) {
            await switchNetwork();
        }
        
        // Initialize contract
        state.contract = new ethers.Contract(CONFIG.CONTRACT_ADDRESS, CONTRACT_ABI, state.signer);
        
        // Update UI
        updateWalletUI();
        await loadUserData();
        
        hideLoading();
        showToast('Wallet connected successfully!', 'success');
        
    } catch (error) {
        console.error('Error connecting wallet:', error);
        hideLoading();
        showToast('Failed to connect wallet: ' + error.message, 'error');
    }
}

async function switchNetwork() {
    try {
        await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: '0x' + CONFIG.CHAIN_ID.toString(16) }],
        });
    } catch (switchError) {
        // Network not added, try to add it
        if (switchError.code === 4902) {
            try {
                await window.ethereum.request({
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
            } catch (addError) {
                throw new Error('Failed to add Unichain Sepolia network');
            }
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
    if (!state.contract || !state.userAddress) return;
    
    try {
        // Load user balance
        const balance = await state.contract.balanceOf(state.userAddress);
        const balanceXMR = ethers.utils.formatUnits(balance, 12);
        document.getElementById('userBalance').textContent = parseFloat(balanceXMR).toFixed(4) + ' XMR';
        document.getElementById('burnBalance').textContent = parseFloat(balanceXMR).toFixed(4);
        
        // Load XMR/ETH price
        try {
            const price = await state.contract.getXmrEthPrice();
            const priceFormatted = ethers.utils.formatEther(price);
            document.getElementById('xmrEthPrice').textContent = parseFloat(priceFormatted).toFixed(6) + ' ETH';
        } catch (e) {
            document.getElementById('xmrEthPrice').textContent = 'N/A';
        }
        
        // Load total collateral
        try {
            const totalCollateral = await state.contract.totalLPCollateral();
            const collateralFormatted = ethers.utils.formatEther(totalCollateral);
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
    if (!state.contract || !state.userAddress) return;
    
    try {
        const lpInfo = await state.contract.lpInfo(state.userAddress);
        
        if (lpInfo.collateralAmount.gt(0)) {
            // User is an LP
            const collateral = ethers.utils.formatEther(lpInfo.collateralAmount);
            const backed = ethers.utils.formatUnits(lpInfo.backedAmount, 12);
            
            document.getElementById('lpCollateral').textContent = parseFloat(collateral).toFixed(4) + ' wstETH';
            document.getElementById('lpBacked').textContent = parseFloat(backed).toFixed(4) + ' XMR';
            
            // Load ratio
            try {
                const ratio = await state.contract.getLPRatio(state.userAddress);
                document.getElementById('lpYourRatio').textContent = ratio.toString() + '%';
            } catch (e) {
                document.getElementById('lpYourRatio').textContent = 'N/A';
            }
        }
    } catch (error) {
        console.error('Error loading LP info:', error);
    }
}

// ============================================
// Tab Switching - FIXED
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
    
    if (lpAddress && state.contract) {
        loadLPDetails(lpAddress);
    }
}

async function loadLPDetails(lpAddress) {
    try {
        const lpInfo = await state.contract.lpInfo(lpAddress);
        
        document.getElementById('lpMintFee').textContent = (lpInfo.mintFeeBps / 100).toFixed(2) + '%';
        
        // Load capacity
        try {
            const capacity = await state.contract.getLPAvailableCapacity(lpAddress);
            const capacityXMR = ethers.utils.formatUnits(capacity, 12);
            document.getElementById('lpCapacity').textContent = parseFloat(capacityXMR).toFixed(4) + ' XMR';
        } catch (e) {
            document.getElementById('lpCapacity').textContent = 'N/A';
        }
        
        // Load ratio
        try {
            const ratio = await state.contract.getLPRatio(lpAddress);
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
        const amountPiconero = ethers.utils.parseUnits(amount, 12);
        const depositWei = ethers.utils.parseEther(deposit);
        
        const tx = await state.contract.createMintIntent(lpAddress, amountPiconero, {
            value: depositWei
        });
        
        showLoading('Waiting for confirmation...');
        const receipt = await tx.wait();
        
        // Parse event to get intent ID
        const event = receipt.events?.find(e => e.event === 'MintIntentCreated');
        const intentId = event?.args?.intentId?.toString();
        
        hideLoading();
        
        // Show instructions
        document.getElementById('intentId').textContent = intentId || 'N/A';
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
        
        const amountPiconero = ethers.utils.parseUnits(amount, 12);
        
        const tx = await state.contract.requestBurn(lpAddress, amountPiconero, xmrAddress);
        
        showLoading('Waiting for confirmation...');
        const receipt = await tx.wait();
        
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
        
        const tx = await state.contract.registerLP(mintFee, burnFee, active);
        
        showLoading('Waiting for confirmation...');
        await tx.wait();
        
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
        
        const amountWei = ethers.utils.parseEther(amount);
        
        const tx = await state.contract.lpDeposit({ value: amountWei });
        
        showLoading('Waiting for confirmation...');
        await tx.wait();
        
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
