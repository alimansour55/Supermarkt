import mongoose from 'mongoose';

/**
 * Customer questions on a marketplace seller's product ("Is it raw honey?"), answered by the
 * seller from Seller Center. Only answered, visible questions show on the product page.
 */
const productQuestionSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    seller: { type: mongoose.Schema.Types.ObjectId, ref: 'Seller', required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    userName: { type: String, trim: true, default: '' },
    question: { type: String, trim: true, required: true, maxlength: 500 },
    answer: { type: String, trim: true, default: '', maxlength: 1500 },
    answeredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    answeredAt: { type: Date, default: null },
    /** Sellers can hide spam / off-topic questions. */
    status: { type: String, enum: ['visible', 'hidden'], default: 'visible' },
  },
  { timestamps: true },
);

productQuestionSchema.index({ product: 1, status: 1, answeredAt: -1 });
productQuestionSchema.index({ seller: 1, answeredAt: 1, createdAt: -1 });

const ProductQuestion = mongoose.model('ProductQuestion', productQuestionSchema);

export default ProductQuestion;
