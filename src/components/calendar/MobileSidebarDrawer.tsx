import React from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Menu, Plus } from 'lucide-react';
import { CalendarSidebar } from './CalendarSidebar';
import { CalendarFilter } from '@/types/calendar';

interface MobileSidebarDrawerProps {
  currentDate: Date;
  onDateSelect: (date: Date) => void;
  filter: CalendarFilter;
  onFilterChange: (filter: CalendarFilter) => void;
  onCreateEvent: () => void;
}

export const MobileSidebarDrawer: React.FC<MobileSidebarDrawerProps> = ({
  currentDate,
  onDateSelect,
  filter,
  onFilterChange,
  onCreateEvent,
}) => {
  const [open, setOpen] = React.useState(false);

  return (
    <div className="lg:hidden">
      {/* Mobile FAB and Menu */}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-3">
        <Button
          size="lg"
          className="h-14 w-14 sm:h-16 sm:w-16 rounded-full shadow-lg min-h-[56px] min-w-[56px]"
          onClick={onCreateEvent}
          aria-label="Create Event"
        >
          <Plus className="h-6 w-6 sm:h-7 sm:w-7" />
        </Button>
        
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button
              size="lg"
              variant="outline"
              className="h-14 w-14 sm:h-16 sm:w-16 rounded-full shadow-lg bg-background min-h-[56px] min-w-[56px]"
              aria-label="Open Menu"
            >
              <Menu className="h-6 w-6 sm:h-7 sm:w-7" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[85vw] sm:w-[350px] p-0">
            <SheetHeader className="p-4 border-b">
              <SheetTitle>Calendar Menu</SheetTitle>
            </SheetHeader>
            <div className="p-4">
              <CalendarSidebar
                currentDate={currentDate}
                onDateSelect={(date) => {
                  onDateSelect(date);
                  setOpen(false);
                }}
                filter={filter}
                onFilterChange={onFilterChange}
                onCreateEvent={() => {
                  onCreateEvent();
                  setOpen(false);
                }}
              />
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </div>
  );
};
