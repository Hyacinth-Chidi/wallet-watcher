import { CHAIN_CONFIG } from '../config/index.js';
import { formatAddress } from './validators.js';

/**
 * Format token value from smallest unit to human-readable
 */
export function formatValue(value, decimals = 18) {
  try {
    const amount = BigInt(value) / BigInt(10 ** decimals);
    const remainder = BigInt(value) % BigInt(10 ** decimals);
    const decimalPart = remainder.toString().padStart(decimals, '0');
    
    if (amount === 0n && remainder === 0n) {
      return '0';
    }
    
    // Format with appropriate precision
    const amountStr = amount.toString();
    const decimalStr = decimalPart.slice(0, 8).replace(/0+$/, '');
    
    if (decimalStr) {
      return `${amountStr}.${decimalStr}`;
    }
    
    return amountStr;
  } catch (error) {
    return '0';
  }
}

/**
 * Get emoji for transaction direction
 */
export function getTransactionEmoji(isIncoming) {
  return isIncoming ? '📥' : '📤';
}

/**
 * Format native coin transaction alert
 */
export function formatNativeTransaction(txData, chainTicker, trackedAddress) {
  const chainConfig = CHAIN_CONFIG[chainTicker] || {};
  const chainName = chainConfig.name || chainTicker;
  const nativeSymbol = chainConfig.nativeSymbol || chainTicker;
  const decimals = chainConfig.decimals || 18;
  const explorer = chainConfig.explorer || '';
  const icon = chainConfig.icon || '🔗';

  const txHash = txData.hash || '';
  const fromAddr = (txData.fromAddress || '').toLowerCase();
  const toAddr = (txData.toAddress || '').toLowerCase();
  const value = txData.value || '0';
  const gasPrice = txData.gasPrice || '0';
  const gasUsed = txData.gas || '0';

  // Determine direction
  const isIncoming = toAddr === trackedAddress.toLowerCase();
  const directionEmoji = getTransactionEmoji(isIncoming);
  const directionText = isIncoming ? 'Received' : 'Sent';

  // Format amount
  const amount = formatValue(value, decimals);

  // Calculate gas fee
  let gasFeeStr = 'Unknown';
  try {
    const gasFee = (BigInt(gasPrice) * BigInt(gasUsed)) / BigInt(10 ** decimals);
    gasFeeStr = gasFee.toString();
  } catch (error) {
    // Keep default
  }

  return `
${icon} <b>${chainName} Transaction</b>

${directionEmoji} <b>${directionText}</b>
💰 Amount: <code>${amount} ${nativeSymbol}</code>

📍 From: <code>${formatAddress(fromAddr)}</code>
📍 To: <code>${formatAddress(toAddr)}</code>

⛽ Gas Fee: <code>${gasFeeStr} ${nativeSymbol}</code>
🔗 <a href="${explorer}/tx/${txHash}">View on Explorer</a>
`.trim();
}

/**
 * Format token transaction alert
 */
export function formatTokenTransaction(txData, chainTicker, trackedAddress) {
  const chainConfig = CHAIN_CONFIG[chainTicker] || {};
  const chainName = chainConfig.name || chainTicker;
  const explorer = chainConfig.explorer || '';
  const icon = chainConfig.icon || '🔗';

  const txHash = txData.transactionHash || '';
  const fromAddr = (txData.from || '').toLowerCase();
  const toAddr = (txData.to || '').toLowerCase();
  const tokenAddress = txData.address || '';
  const tokenName = txData.tokenName || 'Unknown Token';
  const tokenSymbol = txData.tokenSymbol || '???';
  const value = txData.value || '0';
  const decimals = parseInt(txData.tokenDecimals || 18);

  // Determine direction
  const isIncoming = toAddr === trackedAddress.toLowerCase();
  const directionEmoji = getTransactionEmoji(isIncoming);
  const directionText = isIncoming ? 'Received' : 'Sent';

  // Format amount
  const amount = formatValue(value, decimals);

  return `
${icon} <b>${chainName} Token Transaction</b>

${directionEmoji} <b>${directionText}</b>
🪙 Token: <b>${tokenName} (${tokenSymbol})</b>
💰 Amount: <code>${amount} ${tokenSymbol}</code>

📍 From: <code>${formatAddress(fromAddr)}</code>
📍 To: <code>${formatAddress(toAddr)}</code>

🔗 <a href="${explorer}/tx/${txHash}">View on Explorer</a>
📄 <a href="${explorer}/token/${tokenAddress}">Token Contract</a>
`.trim();
}

/**
 * Format list of tracked wallets
 */
export function formatWalletList(wallets, chainFilter = null) {
  if (!wallets || wallets.length === 0) {
    return "You're not tracking any wallets yet.\n\nUse /track to start monitoring a wallet!";
  }

  // Filter by chain if specified
  let filteredWallets = wallets;
  if (chainFilter) {
    filteredWallets = wallets.filter(w => w.chainTicker === chainFilter.toUpperCase());
    if (filteredWallets.length === 0) {
      return `You're not tracking any wallets on ${chainFilter.toUpperCase()}.`;
    }
  }

  let message = '<b>📊 Your Tracked Wallets</b>\n\n';

  // Group by chain
  const byChain = {};
  for (const wallet of filteredWallets) {
    const chain = wallet.chainTicker || 'UNKNOWN';
    if (!byChain[chain]) {
      byChain[chain] = [];
    }
    byChain[chain].push(wallet);
  }

  // Format each chain
  for (const [chain, chainWallets] of Object.entries(byChain).sort()) {
    const chainConfig = CHAIN_CONFIG[chain] || {};
    const icon = chainConfig.icon || '🔗';
    const chainName = chainConfig.name || chain;

    message += `${icon} <b>${chainName}</b>\n`;

    for (const wallet of chainWallets) {
      const displayName = wallet.alias || formatAddress(wallet.address);
      message += `  • <code>${displayName}</code>\n`;
      if (wallet.alias) {
        message += `    <i>${formatAddress(wallet.address)}</i>\n`;
      }
    }

    message += '\n';
  }

  message += 'Use /untrack to stop monitoring a wallet';

  return message;
}

/**
 * Format help message
 */
export function formatHelpMessage() {
  return `
<b>🤖 Wallet Tracker Bot - Help</b>

<b>📝 Commands:</b>

/start - Start the bot and see welcome message
/help - Show this help message

/track &lt;CHAIN&gt; &lt;ADDRESS&gt; [ALIAS] - Start tracking a wallet
  Example: <code>/track ETH 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb MyWallet</code>

/list [CHAIN] - Show all tracked wallets
  Example: <code>/list</code> or <code>/list ETH</code>

/untrack &lt;CHAIN&gt; &lt;ADDRESS&gt; - Stop tracking a wallet
  Example: <code>/untrack ETH 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb</code>

/stats - Show your tracking statistics

<b>🔗 Supported Chains:</b>
${Object.entries(CHAIN_CONFIG).map(([ticker, config]) => 
  `${config.icon} ${ticker} - ${config.name}`
).join('\n')}

<b>💡 Tips:</b>
• Add an alias to easily identify wallets
• You can track the same wallet as other users
• Alerts are sent in real-time as transactions occur
• Click transaction links to view on block explorers

Need help? Contact support or report issues!
`.trim();
}

/**
 * Format user statistics
 */
export function formatStatsMessage(user, wallets) {
  const walletCount = wallets.length;

  // Count by chain
  const byChain = {};
  for (const wallet of wallets) {
    const chain = wallet.chainTicker || 'UNKNOWN';
    byChain[chain] = (byChain[chain] || 0) + 1;
  }

  let message = '<b>📊 Your Statistics</b>\n\n';
  message += `👤 User ID: <code>${user.telegramId}</code>\n`;
  message += `📱 Username: @${user.username || 'N/A'}\n`;
  message += `💼 Tracked Wallets: <b>${walletCount}</b>\n\n`;

  if (Object.keys(byChain).length > 0) {
    message += '<b>By Chain:</b>\n';
    for (const [chain, count] of Object.entries(byChain).sort()) {
      const chainConfig = CHAIN_CONFIG[chain] || {};
      const icon = chainConfig.icon || '🔗';
      message += `  ${icon} ${chain}: ${count}\n`;
    }
  }

  return message;
}

export default {
  formatValue,
  getTransactionEmoji,
  formatNativeTransaction,
  formatTokenTransaction,
  formatWalletList,
  formatHelpMessage,
  formatStatsMessage
};