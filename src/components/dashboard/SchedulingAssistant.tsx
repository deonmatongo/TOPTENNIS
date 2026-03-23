import React, { useMemo } from 'react';
import {
  format, addDays, parseISO, isToday, isBefore, startOfDay,
} from 'date-fns';
import { cn } from '@/lib/utils';
import { ChevronLeft, ChevronRight, CalendarDays, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '@/components/ui/tooltip';
import type { Tables } from '@/integrations/supabase/types';

type UA = Tables<'user_availability'>;

interface SchedulingAssistantProps {
  myAvailability: UA[];
  theirAvailability: UA[];
  myName: string;
  theirName: string;
  weekStart: Date;            // Monday of the visible week
  onPrevWeek: () => void;
  onNextWeek: () => void;
  onThisWeek: () => void;
  onSelectSlot: (date: Date, startTime: string, endTime: string, availabilityId?: string) => void;
  isBooked: (date: string, startTime: string, endTime: string) => boolean;
}

// ── Constants ──────────────────────────────────────────────────────────────────
const HOURS = Array.from({ length: 16 }, (_, i) => i + 6); // 6 AM → 9 PM (last slot = 9-10 PM)

const hourLabel = (h: number) => {
  const period = h < 12 ? 'AM' : 'PM';
  const display = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${display} ${period}`;
};

const padH = (h: number) => String(h).padStart(2, '0');

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Returns the availability slot that covers (date, hour), or null */
function coveringSlot(slots: UA[], dateStr: string, hour: number): UA | null {
  for (const s of slots) {
    if (s.date !== dateStr) continue;
    if (!s.is_available || s.is_blocked) continue;
    const [sh] = s.start_time.split(':').map(Number);
    const [eh] = s.end_time.split(':').map(Number);
    if (hour >= sh && hour < eh) return s;
  }
  return null;
}

// ── Main component ─────────────────────────────────────────────────────────────

export const SchedulingAssistant: React.FC<SchedulingAssistantProps> = ({
  myAvailability,
  theirAvailability,
  myName,
  theirName,
  weekStart,
  onPrevWeek,
  onNextWeek,
  onThisWeek,
  onSelectSlot,
  isBooked,
}) => {
  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart],
  );

  // Count mutual free slots for summary banner
  const mutualCount = useMemo(() => {
    let count = 0;
    for (const day of days) {
      const dateStr = format(day, 'yyyy-MM-dd');
      for (const h of HOURS) {
        const past = isBefore(
          new Date(`${dateStr}T${padH(h)}:00:00`),
          new Date(),
        );
        if (past) continue;
        const mySlot = coveringSlot(myAvailability, dateStr, h);
        const theirSlot = coveringSlot(theirAvailability, dateStr, h);
        if (mySlot && theirSlot && !isBooked(dateStr, `${padH(h)}:00:00`, `${padH(h + 1)}:00:00`)) {
          count++;
        }
      }
    }
    return count;
  }, [days, myAvailability, theirAvailability, isBooked]);

  const myHasAny = myAvailability.some(s => s.is_available && !s.is_blocked);
  const theirHasAny = theirAvailability.some(s => s.is_available && !s.is_blocked);

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex flex-col gap-4">

        {/* ── Week navigation ─────────────────────────────────────── */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1 min-w-0">
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={onPrevWeek}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-xs sm:text-sm font-semibold text-foreground text-center truncate">
              {format(weekStart, 'MMM d')} – {format(addDays(weekStart, 6), 'MMM d, yyyy')}
            </span>
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={onNextWeek}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
          <Button variant="outline" size="sm" className="h-8 text-xs shrink-0" onClick={onThisWeek}>
            This Week
          </Button>
        </div>

        {/* ── Legend ──────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-center gap-x-3 sm:gap-x-5 gap-y-1.5 px-1 pb-2 border-b border-border/50">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Legend</p>
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="w-3.5 h-3.5 rounded-sm bg-primary/35 border border-primary/40" />
            Your availability
          </span>
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="w-3.5 h-3.5 rounded-sm bg-purple-300/60 border border-purple-300 dark:bg-purple-700/40 dark:border-purple-600" />
            {theirName}'s availability
          </span>
          <span className="flex items-center gap-1.5 text-xs font-medium text-green-700 dark:text-green-400">
            <span className="w-3.5 h-3.5 rounded-sm bg-green-500 border border-green-600" />
            Both free — click to book
          </span>
          <span className="flex items-center gap-1.5 text-xs text-purple-700 dark:text-purple-400">
            <span className="w-3.5 h-3.5 rounded-sm bg-purple-300/60 border border-purple-300 dark:bg-purple-700/40 dark:border-purple-600" />
            {theirName} free — click to request
          </span>
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="w-3.5 h-3.5 rounded-sm bg-muted/40 border border-border/40" />
            Past / unavailable
          </span>
        </div>

        {/* ── Warning if no availability ───────────────────────────── */}
        {!myHasAny && (
          <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-blue-50 border border-blue-200 dark:bg-blue-950/30 dark:border-blue-800 text-xs text-blue-800 dark:text-blue-300">
            <CalendarDays className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <span>You haven't added any availability yet. Go to <strong>My Schedule</strong> to add your free times, then come back to find a mutual slot.</span>
          </div>
        )}
        {myHasAny && !theirHasAny && (
          <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-amber-50 border border-amber-200 dark:bg-amber-950/30 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-300">
            <CalendarDays className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <span><strong>{theirName}</strong> hasn't published any availability yet. Try the Calendar or List tabs to challenge them directly.</span>
          </div>
        )}

        {/* ── Mutual count banner ──────────────────────────────────── */}
        {mutualCount > 0 && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-50 border border-green-200 dark:bg-green-950/30 dark:border-green-800">
            <Zap className="w-4 h-4 text-green-600 dark:text-green-400 shrink-0" />
            <p className="text-xs font-semibold text-green-800 dark:text-green-300">
              {mutualCount} mutual free {mutualCount === 1 ? 'slot' : 'slots'} this week — highlighted in green
            </p>
          </div>
        )}

        {/* ── Grid ────────────────────────────────────────────────── */}
        <div className="overflow-auto rounded-xl border border-border shadow-sm">
          <table className="min-w-full border-collapse text-xs select-none">

            {/* Day header row */}
            <thead>
              <tr className="bg-muted/60">
                {/* Time column header */}
                <th className="sticky left-0 z-20 bg-muted/60 w-10 sm:w-14 min-w-[40px] sm:min-w-[56px] px-1 sm:px-2 py-2 text-right font-medium text-muted-foreground border-b border-r border-border/60">
                  Time
                </th>
                {days.map(day => {
                  const todayCol = isToday(day);
                  return (
                    <th
                      key={day.toISOString()}
                      className={cn(
                        'min-w-[44px] sm:min-w-[64px] px-0.5 sm:px-1 py-2 text-center font-medium border-b border-r border-border/60',
                        todayCol
                          ? 'text-primary bg-primary/10'
                          : 'text-muted-foreground',
                      )}
                    >
                      <div className="flex flex-col items-center gap-0.5">
                        <span className="text-[10px] uppercase tracking-wide">
                          {format(day, 'EEE')}
                        </span>
                        <span
                          className={cn(
                            'w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold',
                            todayCol && 'bg-primary text-primary-foreground',
                          )}
                        >
                          {format(day, 'd')}
                        </span>
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>

            {/* Body */}
            <tbody>
              {HOURS.map((hour, rowIdx) => (
                <tr key={hour} className={rowIdx % 2 === 0 ? 'bg-background' : 'bg-muted/10'}>

                  {/* Time label */}
                  <td className="sticky left-0 z-10 bg-inherit px-1 sm:px-2 py-0 text-right text-[9px] sm:text-[11px] text-muted-foreground border-r border-border/40 h-9 sm:h-10 align-middle whitespace-nowrap">
                    {hourLabel(hour)}
                  </td>

                  {/* Day cells */}
                  {days.map(day => {
                    const dateStr = format(day, 'yyyy-MM-dd');
                    const startT = `${padH(hour)}:00:00`;
                    const endT   = `${padH(hour + 1)}:00:00`;
                    const isPast = isBefore(
                      new Date(`${dateStr}T${startT}`),
                      new Date(),
                    );
                    const mySlot    = coveringSlot(myAvailability,    dateStr, hour);
                    const theirSlot = coveringSlot(theirAvailability, dateStr, hour);
                    const booked    = !isPast && isBooked(dateStr, startT, endT);
                    const bothFree  = !!mySlot && !!theirSlot && !isPast && !booked;
                    const onlyMe    = !!mySlot && !theirSlot && !isPast;
                    const onlyThem  = !mySlot && !!theirSlot && !isPast && !booked;

                    // Both mutual and opponent-only slots are bookable
                    const canBook = (bothFree || onlyThem);

                    const cellContent = canBook ? (
                      <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none text-white">
                        {bothFree ? 'Book' : 'Request'}
                      </span>
                    ) : null;

                    const tooltipText = bothFree
                      ? `Both free · ${format(day, 'EEE MMM d')} · ${hourLabel(hour)} – ${hourLabel(hour + 1)}`
                      : onlyThem
                      ? `${theirName} is free · click to send match request`
                      : onlyMe
                      ? `You're free · ${format(day, 'EEE MMM d')} · ${hourLabel(hour)}`
                      : `Unavailable`;

                    return (
                      <Tooltip key={day.toISOString()}>
                        <TooltipTrigger asChild>
                          <td
                            onClick={canBook ? () => onSelectSlot(day, startT, endT, theirSlot?.id) : undefined}
                            className={cn(
                              'relative h-9 sm:h-10 border-r border-b border-border/30 transition-colors',
                              bothFree  && 'bg-green-500 hover:bg-green-400 cursor-pointer group',
                              onlyMe    && 'bg-primary/25 dark:bg-primary/20',
                              onlyThem  && 'bg-purple-200/70 hover:bg-purple-300/80 dark:bg-purple-800/35 dark:hover:bg-purple-700/50 cursor-pointer group',
                              !mySlot && !theirSlot && !isPast && 'bg-transparent',
                              isPast    && 'bg-muted/20 opacity-40 cursor-not-allowed',
                              booked    && !isPast && 'opacity-40 cursor-not-allowed',
                            )}
                          >
                            {cellContent}
                          </td>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="text-xs max-w-[200px]">
                          {tooltipText}
                          {booked && <span className="block text-muted-foreground">Already booked</span>}
                        </TooltipContent>
                      </Tooltip>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ── Participants key ────────────────────────────────────── */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground px-1">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-primary/35 border border-primary/40 shrink-0" />
            {myName} (you)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-purple-300/60 border border-purple-300 dark:bg-purple-700/40 dark:border-purple-600 shrink-0" />
            {theirName}
          </span>
          <span className="hidden sm:block ml-auto text-[11px]">
            Use arrow keys or buttons to navigate weeks
          </span>
        </div>

      </div>
    </TooltipProvider>
  );
};
