import mongoose from 'mongoose';

/**
 * Daily traffic counters for marketplace seller products (page views, add-to-cart), so sellers
 * can see views → carts → orders per product. One document per product per Cairo day.
 */
const productStatSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    seller: { type: mongoose.Schema.Types.ObjectId, ref: 'Seller', required: true },
    day: { type: String, required: true }, // YYYY-MM-DD (Africa/Cairo)
    views: { type: Number, default: 0 },
    carts: { type: Number, default: 0 },
  },
  { timestamps: false },
);

productStatSchema.index({ product: 1, day: 1 }, { unique: true });
productStatSchema.index({ seller: 1, day: 1 });

const ProductStat = mongoose.model('ProductStat', productStatSchema);

export default ProductStat;
