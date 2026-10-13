import mongoose from 'mongoose';

/**
 * JWTs revoked before their natural expiry (logout).
 * Documents are removed automatically by MongoDB once the token would have expired anyway.
 */
const revokedTokenSchema = new mongoose.Schema({
  jti: { type: String, required: true, unique: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  expiresAt: { type: Date, required: true },
});

revokedTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const RevokedToken = mongoose.model('RevokedToken', revokedTokenSchema);

export default RevokedToken;
