import SearchAutocomplete from './SearchAutocomplete';

/** Header / inline smart search with live autocomplete — soft pill field. */
export default function SearchBar({ className = '', variant = 'pill' }) {
  return <SearchAutocomplete className={className} showCategorySelect={false} variant={variant} />;
}
