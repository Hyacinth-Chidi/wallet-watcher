import mongoose from 'mongoose';

const { Schema } = mongoose;

// User Schema
const userSchema = new Schema({
  telegramId: {
    type: Number,
    required: true,
    unique: true,
    index: true
  },
  username: {
    type: String,
    default: null
  },
  trackedWalletIds: [{
    type: Schema.Types.ObjectId,
    ref: 'TrackedWallet'
  }],
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Update timestamp on save
userSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Tracked Wallet Schema
const trackedWalletSchema = new Schema({
  address: {
    type: String,
    required: true,
    lowercase: true,
    index: true
  },
  chainTicker: {
    type: String,
    required: true,
    uppercase: true,
    index: true
  },
  alias: {
    type: String,
    default: null,
    maxlength: 32
  },
  trackingUserIds: [{
    type: Number,
    index: true
  }],
  moralisStreamId: {
    type: String,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Compound index for address + chain
trackedWalletSchema.index({ address: 1, chainTicker: 1 }, { unique: true });

// Update timestamp on save
trackedWalletSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Models
export const User = mongoose.model('User', userSchema);
export const TrackedWallet = mongoose.model('TrackedWallet', trackedWalletSchema);

// Database connection
export async function connectDatabase(uri) {
  try {
    await mongoose.connect(uri);
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    throw error;
  }
}

// Database disconnection
export async function disconnectDatabase() {
  try {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  } catch (error) {
    console.error('Error disconnecting from MongoDB:', error);
    throw error;
  }
}

export default {
  User,
  TrackedWallet,
  connectDatabase,
  disconnectDatabase
};