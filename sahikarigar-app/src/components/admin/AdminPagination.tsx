'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui';

export function AdminPagination({
  page,
  pages,
  total,
  onPageChange,
}: {
  page: number;
  pages: number;
  total: number;
  onPageChange: (page: number) => void;
}) {
  if (pages <= 1) return null;
  return (
    <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
      <p className="text-small text-text-secondary">{total} records · Page {page} of {pages}</p>
      <div className="flex gap-2">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          <ChevronLeft size={16} className="mr-1" /> Previous
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={page >= pages}
          onClick={() => onPageChange(page + 1)}
        >
          Next <ChevronRight size={16} className="ml-1" />
        </Button>
      </div>
    </div>
  );
}
