import { useState, useMemo } from 'react';

export interface SortConfig<T = any> {
  key: keyof T | string;
  direction: 'asc' | 'desc';
}

export interface UseResponsiveTableOptions<T = any> {
  data: T[];
  defaultSort?: SortConfig<T>;
}

export function useResponsiveTable<T = any>({
  data,
  defaultSort,
}: UseResponsiveTableOptions<T>) {
  const [sortConfig, setSortConfig] = useState<SortConfig<T> | undefined>(defaultSort);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const sortedData = useMemo(() => {
    if (!sortConfig) return data;

    return [...data].sort((a, b) => {
      const aValue = (a as any)[sortConfig.key];
      const bValue = (b as any)[sortConfig.key];

      if (aValue === bValue) return 0;

      const comparison = aValue < bValue ? -1 : 1;
      return sortConfig.direction === 'asc' ? comparison : -comparison;
    });
  }, [data, sortConfig]);

  const filteredData = useMemo(() => {
    if (!searchQuery) return sortedData;

    return sortedData.filter((row) => {
      return Object.values(row as object).some((value) =>
        String(value).toLowerCase().includes(searchQuery.toLowerCase())
      );
    });
  }, [sortedData, searchQuery]);

  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return filteredData.slice(startIndex, endIndex);
  }, [filteredData, currentPage, pageSize]);

  const totalPages = Math.ceil(filteredData.length / pageSize);

  const handleSort = (key: keyof T | string) => {
    setSortConfig((current) => {
      if (!current || current.key !== key) {
        return { key, direction: 'asc' };
      }
      if (current.direction === 'asc') {
        return { key, direction: 'desc' };
      }
      return undefined;
    });
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    setCurrentPage(1); // Reset to first page on search
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  };

  const handlePageSizeChange = (size: number) => {
    setPageSize(size);
    setCurrentPage(1); // Reset to first page on page size change
  };

  return {
    // Data
    data: paginatedData,
    sortedData,
    filteredData,
    allData: data,
    
    // Sort
    sortConfig,
    handleSort,
    
    // Search
    searchQuery,
    handleSearch,
    
    // Pagination
    currentPage,
    pageSize,
    totalPages,
    totalItems: filteredData.length,
    handlePageChange,
    handlePageSizeChange,
  };
}

export default useResponsiveTable;
