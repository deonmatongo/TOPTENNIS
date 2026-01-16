import React, { useState } from 'react';
import { ChevronDown, ChevronRight, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from './button';
import { SortConfig } from '@/hooks/useResponsiveTable';

export interface ResponsiveTableColumn<T = any> {
  key: string;
  label: string;
  /** Render function for the cell */
  render?: (value: any, row: T, index: number) => React.ReactNode;
  /** Hide on specific breakpoints */
  hideOn?: 'mobile' | 'tablet' | 'desktop' | 'mobile-tablet';
  /** Column width class */
  className?: string;
  /** Is this column sortable? */
  sortable?: boolean;
  /** Alignment */
  align?: 'left' | 'center' | 'right';
}

export interface ResponsiveTableProps<T = any> {
  /** Table data */
  data: T[];
  /** Column definitions */
  columns: ResponsiveTableColumn<T>[];
  /** Row key accessor */
  getRowKey: (row: T, index: number) => string;
  /** Expandable row content renderer */
  renderExpandedRow?: (row: T, index: number) => React.ReactNode;
  /** Enable collapsible rows on mobile */
  collapsible?: boolean;
  /** Loading state */
  loading?: boolean;
  /** Empty state message */
  emptyMessage?: React.ReactNode;
  /** Custom class for table container */
  className?: string;
  /** On row click */
  onRowClick?: (row: T, index: number) => void;
  /** Highlight condition */
  highlightRow?: (row: T, index: number) => boolean;
  /** Sort configuration */
  sortConfig?: SortConfig<T>;
  /** Sort handler */
  onSort?: (key: keyof T | string) => void;
}

export function ResponsiveTable<T = any>({
  data,
  columns,
  getRowKey,
  renderExpandedRow,
  collapsible = true,
  loading = false,
  emptyMessage = 'No data available',
  className,
  onRowClick,
  highlightRow,
  sortConfig,
  onSort,
}: ResponsiveTableProps<T>) {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const toggleRow = (key: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(key)) {
      newExpanded.delete(key);
    } else {
      newExpanded.add(key);
    }
    setExpandedRows(newExpanded);
  };

  const getHideClass = (hideOn?: string) => {
    switch (hideOn) {
      case 'mobile':
        return 'hidden sm:table-cell';
      case 'tablet':
        return 'hidden lg:table-cell';
      case 'mobile-tablet':
        return 'hidden xl:table-cell';
      default:
        return '';
    }
  };

  const getAlignClass = (align?: string) => {
    switch (align) {
      case 'center':
        return 'text-center';
      case 'right':
        return 'text-right';
      default:
        return 'text-left';
    }
  };

  const getSortIcon = (columnKey: string) => {
    if (!sortConfig || sortConfig.key !== columnKey) {
      return <ArrowUpDown className="h-3 w-3 ml-1 opacity-40" />;
    }
    return sortConfig.direction === 'asc' 
      ? <ArrowUp className="h-3 w-3 ml-1" />
      : <ArrowDown className="h-3 w-3 ml-1" />;
  };

  if (loading) {
    return (
      <div className="rounded-md border">
        <div className="p-8 text-center">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="rounded-md border">
        <div className="p-8 text-center text-muted-foreground">
          {typeof emptyMessage === 'string' ? emptyMessage : emptyMessage}
        </div>
      </div>
    );
  }

  return (
    <div className={cn('rounded-md border overflow-hidden', className)}>
      {/* Desktop View - Horizontal Scrolling */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse min-w-[640px]">
          <thead>
            <tr className="border-b bg-muted/50">
              {collapsible && renderExpandedRow && (
                <th className="w-10 px-2 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider lg:hidden">
                  {/* Expand column on mobile */}
                </th>
              )}
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={cn(
                    'px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider',
                    getHideClass(column.hideOn),
                    getAlignClass(column.align),
                    column.className,
                    column.sortable && onSort && 'cursor-pointer hover:bg-muted/70 select-none transition-colors'
                  )}
                  onClick={() => column.sortable && onSort?.(column.key)}
                >
                  <div className={cn('flex items-center', getAlignClass(column.align))}>
                    {column.label}
                    {column.sortable && onSort && getSortIcon(column.key)}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-background divide-y divide-border">
            {data.map((row, rowIndex) => {
              const rowKey = getRowKey(row, rowIndex);
              const isExpanded = expandedRows.has(rowKey);
              const isHighlighted = highlightRow?.(row, rowIndex);
              
              return (
                <React.Fragment key={rowKey}>
                  <tr
                    className={cn(
                      'hover:bg-muted/30 transition-colors',
                      onRowClick && 'cursor-pointer',
                      isHighlighted && 'bg-primary/5 border-l-4 border-l-primary'
                    )}
                    onClick={() => onRowClick?.(row, rowIndex)}
                  >
                    {collapsible && renderExpandedRow && (
                      <td className="px-2 py-3 lg:hidden">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleRow(rowKey);
                          }}
                        >
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </Button>
                      </td>
                    )}
                    {columns.map((column) => (
                      <td
                        key={column.key}
                        className={cn(
                          'px-4 py-3 text-sm',
                          getHideClass(column.hideOn),
                          getAlignClass(column.align),
                          column.className
                        )}
                      >
                        {column.render
                          ? column.render((row as any)[column.key], row, rowIndex)
                          : (row as any)[column.key]}
                      </td>
                    ))}
                  </tr>
                  
                  {/* Collapsible Row Content - Mobile Only */}
                  {collapsible && renderExpandedRow && isExpanded && (
                    <tr className="lg:hidden">
                      <td colSpan={columns.length + 1} className="px-4 py-3 bg-muted/20">
                        {renderExpandedRow(row, rowIndex)}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default ResponsiveTable;
