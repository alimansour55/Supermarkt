import mongoose from 'mongoose';

const searchEventSchema = new mongoose.Schema(
  {
    query: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    normalizedQuery: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    resultCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    noResults: {
      type: Boolean,
      default: false,
      index: true,
    },
    sessionId: {
      type: String,
      trim: true,
      index: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    source: {
      type: String,
      enum: ['search', 'suggestion', 'trending', 'recent', 'category', 'chat'],
      default: 'search',
    },
    converted: {
      type: Boolean,
      default: false,
      index: true,
    },
    convertedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

searchEventSchema.index({ createdAt: -1 });
searchEventSchema.index({ normalizedQuery: 1, createdAt: -1 });

const SearchEvent = mongoose.model('SearchEvent', searchEventSchema);

export default SearchEvent;
