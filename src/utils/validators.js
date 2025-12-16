import { isAddress, getAddress } from 'ethers';
import bs58 from 'bs58';

/**
 * Validate EVM (Ethereum-compatible) address
 */
export function validateEvmAddress(address) {
  try {
    if (isAddress(address)) {
      // Return checksummed address
      return {
        isValid: true,
        normalizedAddress: getAddress(address),
        error: null
      };
    }
    return {
      isValid: false,
      normalizedAddress: null,
      error: 'Invalid EVM address format'
    };
  } catch (error) {
    return {
      isValid: false,
      normalizedAddress: null,
      error: 'Invalid EVM address format'
    };
  }
}

/**
 * Validate Solana address
 */
export function validateSolanaAddress(address) {
  try {
    // Solana addresses are base58 encoded and typically 32-44 characters
    const solanaAddressRegex = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
    
    if (!solanaAddressRegex.test(address)) {
      return {
        isValid: false,
        normalizedAddress: null,
        error: 'Invalid Solana address format'
      };
    }

    // Try to decode base58
    const decoded = bs58.decode(address);

    // Solana public keys are 32 bytes
    if (decoded.length === 32) {
      return {
        isValid: true,
        normalizedAddress: address,
        error: null
      };
    }

    return {
      isValid: false,
      normalizedAddress: null,
      error: 'Invalid Solana address length'
    };
  } catch (error) {
    return {
      isValid: false,
      normalizedAddress: null,
      error: 'Invalid Solana address format'
    };
  }
}

/**
 * Validate address for any supported chain
 */
export function validateAddress(address, chainTicker) {
  const chain = chainTicker.toUpperCase();

  // EVM chains
  if (['ETH', 'BSC', 'POLYGON', 'AVALANCHE', 'ARBITRUM', 'OPTIMISM', 'BASE'].includes(chain)) {
    const result = validateEvmAddress(address);
    if (!result.isValid) {
      return {
        ...result,
        error: `Invalid ${chain} address format. Expected 0x... format.`
      };
    }
    return result;
  }

  // Solana
  if (chain === 'SOL') {
    const result = validateSolanaAddress(address);
    if (!result.isValid) {
      return {
        ...result,
        error: 'Invalid Solana address format. Expected Base58 encoded address.'
      };
    }
    return result;
  }

  return {
    isValid: false,
    normalizedAddress: null,
    error: `Unsupported chain: ${chain}`
  };
}

/**
 * Format address for display
 */
export function formatAddress(address, short = true) {
  if (!address) return '';
  
  if (short && address.length > 12) {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  }
  
  return address;
}

/**
 * Validate wallet alias
 */
export function validateAlias(alias) {
  if (!alias) {
    return { isValid: true, error: null };
  }

  if (alias.length > 32) {
    return {
      isValid: false,
      error: 'Alias must be 32 characters or less'
    };
  }

  const aliasRegex = /^[a-zA-Z0-9_\-\s]+$/;
  if (!aliasRegex.test(alias)) {
    return {
      isValid: false,
      error: 'Alias can only contain letters, numbers, spaces, hyphens, and underscores'
    };
  }

  return { isValid: true, error: null };
}

export default {
  validateEvmAddress,
  validateSolanaAddress,
  validateAddress,
  formatAddress,
  validateAlias
};