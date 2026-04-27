import Link from 'next/link';

const SearchInput = ({ search }) => {
  return (
    <div>
      <form action="" method="GET">
        <input
          type="text"
          name="search" // name attribute links this field to query parameter on server
          className="mb-4 px-4 py-2 border rounded"
          placeholder="Search by Desk ID or Username"
          defaultValue={search} // Set the search input's default value
        />
        <button
          type="submit"
          className="bg-blue-500 text-white px-4 py-2 rounded ml-2"
        >
          Search
        </button>
      </form>
    </div>
  );
};

export default SearchInput;
