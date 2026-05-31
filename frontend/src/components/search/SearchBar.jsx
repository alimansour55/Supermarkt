import SearchAutocomplete from './SearchAutocomplete';

/** Header / inline smart search with live autocomplete. */
export default function SearchBar({ className = '' }) {
  return <SearchAutocomplete className={className} />;
}
