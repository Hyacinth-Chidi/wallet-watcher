import axios from 'axios';
import config, { CHAIN_CONFIG } from '../config/index.js';
import logger from '../utils/logger.js';

const MORALIS_BASE_URL = 'https://api.moralis-streams.com/streams';

class MoralisService {
  constructor() {
    this.apiKey = config.moralis.apiKey;
    this.headers = {
      'X-API-Key': this.apiKey,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };
  }

  /**
   * Create a new Moralis stream for an address
   */
  async createStream(address, chainTicker, webhookUrl, description = null) {
    try {
      const chainConfig = CHAIN_CONFIG[chainTicker.toUpperCase()];
      if (!chainConfig) {
        logger.error(`Unsupported chain: ${chainTicker}`);
        return null;
      }

      const isSolana = chainTicker.toUpperCase() === 'SOL';
      const baseUrl = isSolana ? 
        `${MORALIS_BASE_URL}/solana` : 
        `${MORALIS_BASE_URL}/evm`;

      // Build stream configuration
      const streamConfig = {
        webhookUrl,
        description: description || `Track ${address.slice(0, 8)}... on ${chainConfig.name}`,
        tag: `${chainTicker}_${address.slice(0, 8)}`,
        includeNativeTxs: true,
        includeContractLogs: true,
        includeInternalTxs: true
      };

      if (isSolana) {
        // Solana-specific configuration
        streamConfig.network = 'mainnet';
        streamConfig.address = [address];
      } else {
        // EVM-specific configuration
        streamConfig.chains = [chainConfig.moralisChain];
        streamConfig.address = address;
        streamConfig.allAddresses = false;
        streamConfig.includeAllTxLogs = true;
        streamConfig.getNativeBalances = [{
          selectors: ['$fromAddress', '$toAddress'],
          type: 'tx'
        }];
      }

      const response = await axios.post(baseUrl, streamConfig, {
        headers: this.headers,
        timeout: 30000
      });

      if (response.status === 200 || response.status === 201) {
        logger.info(`✅ Created Moralis stream: ${response.data.id} for ${address}`);
        return response.data;
      }

      logger.error(`Failed to create stream: ${response.status}`);
      return null;

    } catch (error) {
      logger.error(`Error creating Moralis stream: ${error.message}`);
      if (error.response) {
        logger.error(`Response: ${JSON.stringify(error.response.data)}`);
      }
      return null;
    }
  }

  /**
   * Get stream details by ID
   */
  async getStream(streamId, isSolana = false) {
    try {
      const baseUrl = isSolana ? 
        `${MORALIS_BASE_URL}/solana` : 
        `${MORALIS_BASE_URL}/evm`;

      const response = await axios.get(`${baseUrl}/${streamId}`, {
        headers: this.headers,
        timeout: 30000
      });

      if (response.status === 200) {
        return response.data;
      }

      logger.warn(`Stream not found: ${streamId}`);
      return null;

    } catch (error) {
      logger.error(`Error getting stream: ${error.message}`);
      return null;
    }
  }

  /**
   * Update existing stream
   */
  async updateStream(streamId, address, chainTicker, webhookUrl) {
    try {
      const chainConfig = CHAIN_CONFIG[chainTicker.toUpperCase()];
      const isSolana = chainTicker.toUpperCase() === 'SOL';
      const baseUrl = isSolana ? 
        `${MORALIS_BASE_URL}/solana` : 
        `${MORALIS_BASE_URL}/evm`;

      const streamConfig = {
        webhookUrl,
        includeNativeTxs: true,
        includeContractLogs: true
      };

      if (isSolana) {
        streamConfig.address = [address];
      } else {
        streamConfig.chains = [chainConfig.moralisChain];
      }

      const response = await axios.patch(
        `${baseUrl}/${streamId}`,
        streamConfig,
        {
          headers: this.headers,
          timeout: 30000
        }
      );

      if (response.status === 200) {
        logger.info(`✅ Updated Moralis stream: ${streamId}`);
        return true;
      }

      logger.error(`Failed to update stream: ${response.status}`);
      return false;

    } catch (error) {
      logger.error(`Error updating stream: ${error.message}`);
      return false;
    }
  }

  /**
   * Delete a stream
   */
  async deleteStream(streamId, isSolana = false) {
    try {
      const baseUrl = isSolana ? 
        `${MORALIS_BASE_URL}/solana` : 
        `${MORALIS_BASE_URL}/evm`;

      const response = await axios.delete(`${baseUrl}/${streamId}`, {
        headers: this.headers,
        timeout: 30000
      });

      if (response.status === 200 || response.status === 204) {
        logger.info(`✅ Deleted Moralis stream: ${streamId}`);
        return true;
      }

      logger.error(`Failed to delete stream: ${response.status}`);
      return false;

    } catch (error) {
      logger.error(`Error deleting stream: ${error.message}`);
      return false;
    }
  }

  /**
   * Get all active streams
   */
  async getAllStreams() {
    try {
      const streams = [];

      // Get EVM streams
      const evmResponse = await axios.get(`${MORALIS_BASE_URL}/evm`, {
        headers: this.headers,
        timeout: 30000
      });

      if (evmResponse.status === 200) {
        streams.push(...(evmResponse.data.result || []));
      }

      // Get Solana streams
      const solResponse = await axios.get(`${MORALIS_BASE_URL}/solana`, {
        headers: this.headers,
        timeout: 30000
      });

      if (solResponse.status === 200) {
        streams.push(...(solResponse.data.result || []));
      }

      return streams;

    } catch (error) {
      logger.error(`Error getting all streams: ${error.message}`);
      return [];
    }
  }
}

export default new MoralisService();