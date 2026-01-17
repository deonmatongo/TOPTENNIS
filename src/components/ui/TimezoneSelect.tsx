import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

// US time zones with their UTC offsets
const US_TIMEZONES = [
  { value: 'America/New_York', label: 'Eastern Time (ET)', offset: -5 },
  { value: 'America/Chicago', label: 'Central Time (CT)', offset: -6 },
  { value: 'America/Denver', label: 'Mountain Time (MT)', offset: -7 },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)', offset: -8 },
  { value: 'America/Anchorage', label: 'Alaska Time (AKT)', offset: -9 },
  { value: 'Pacific/Honolulu', label: 'Hawaii Time (HT)', offset: -10 },
  { value: 'America/Phoenix', label: 'Arizona Time (MST)', offset: -7 },
  { value: 'America/Indiana/Indianapolis', label: 'Eastern Time (IN)', offset: -5 },
  { value: 'America/Detroit', label: 'Eastern Time (MI)', offset: -5 },
  { value: 'America/Kentucky/Louisville', label: 'Eastern Time (KY)', offset: -5 },
  { value: 'America/Menominee', label: 'Central Time (MN)', offset: -6 },
  { value: 'America/North_Dakota/Center', label: 'Central Time (ND)', offset: -6 },
  { value: 'America/North_Dakota/New_Salem', label: 'Central Time (ND)', offset: -6 },
  { value: 'America/North_Dakota/Center', label: 'Central Time (ND)', offset: -6 },
  { value: 'America/South_Dakota/Center', label: 'Central Time (SD)', offset: -6 },
  { value: 'America/South_Dakota/Mountain', label: 'Mountain Time (SD)', offset: -7 },
  { value: 'America/Montana', label: 'Mountain Time (MT)', offset: -7 },
  { value: 'America/Boise', label: 'Mountain Time (ID)', offset: -7 },
  { value: 'America/Oregon', label: 'Pacific Time (OR)', offset: -8 },
  { value: 'America/North_Dakota/Center', label: 'Central Time (ND)', offset: -6 },
];

interface TimezoneSelectProps {
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
}

export const TimezoneSelect: React.FC<TimezoneSelectProps> = ({
  value,
  onValueChange,
  placeholder = "Select timezone",
}) => {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {US_TIMEZONES.map((tz) => (
          <SelectItem key={tz.value} value={tz.value}>
            <div className="flex items-center justify-between w-full">
              <span>{tz.label}</span>
              <span className="text-xs text-muted-foreground ml-2">
                UTC{tz.offset >= 0 ? '+' : ''}{tz.offset}
              </span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};
