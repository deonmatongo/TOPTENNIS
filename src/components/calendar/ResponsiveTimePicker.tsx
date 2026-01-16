import React, { useState, useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { useIsMobile } from '@/hooks/use-mobile';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Clock } from 'lucide-react';

interface ResponsiveTimePickerProps {
  label: string;
  value: string; // Format: "HH:mm"
  onChange: (value: string) => void;
  id?: string;
  disabled?: boolean;
}

export const ResponsiveTimePicker: React.FC<ResponsiveTimePickerProps> = ({
  label,
  value,
  onChange,
  id,
  disabled = false,
}) => {
  const isMobile = useIsMobile();
  const [hour, setHour] = useState(value.split(':')[0]);
  const [minute, setMinute] = useState(value.split(':')[1]);
  const [showMobilePicker, setShowMobilePicker] = useState(false);

  useEffect(() => {
    const [h, m] = value.split(':');
    setHour(h);
    setMinute(m);
  }, [value]);

  const handleTimeChange = (newHour: string, newMinute: string) => {
    onChange(`${newHour}:${newMinute}`);
  };

  const handleQuickPreset = (minutes: number) => {
    const newMinute = minutes.toString().padStart(2, '0');
    handleTimeChange(hour, newMinute);
  };

  // Mobile wheel-style picker
  if (isMobile) {
    return (
      <div className="space-y-2">
        <Label htmlFor={id}>{label}</Label>
        <Sheet open={showMobilePicker} onOpenChange={setShowMobilePicker}>
          <SheetTrigger asChild>
            <Button
              variant="outline"
              className="w-full justify-start text-left font-normal min-h-[44px]"
              disabled={disabled}
            >
              <Clock className="mr-2 h-4 w-4" />
              {value}
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="h-[60vh]">
            <SheetHeader>
              <SheetTitle>{label}</SheetTitle>
            </SheetHeader>
            <div className="mt-6 space-y-6">
              {/* Quick presets */}
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">Quick presets (minutes)</Label>
                <div className="grid grid-cols-4 gap-2">
                  {[0, 15, 30, 45].map((m) => (
                    <Button
                      key={m}
                      variant={minute === m.toString().padStart(2, '0') ? 'default' : 'outline'}
                      className="min-h-[44px]"
                      onClick={() => handleQuickPreset(m)}
                    >
                      :{m.toString().padStart(2, '0')}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Hour and minute selectors */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Hour</Label>
                  <Select
                    value={hour}
                    onValueChange={(h) => handleTimeChange(h, minute)}
                  >
                    <SelectTrigger className="min-h-[44px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="max-h-[300px]">
                      {Array.from({ length: 24 }, (_, i) => (
                        <SelectItem
                          key={i}
                          value={i.toString().padStart(2, '0')}
                          className="min-h-[44px] text-lg"
                        >
                          {i.toString().padStart(2, '0')}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Minute</Label>
                  <Select
                    value={minute}
                    onValueChange={(m) => handleTimeChange(hour, m)}
                  >
                    <SelectTrigger className="min-h-[44px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="max-h-[300px]">
                      {Array.from({ length: 12 }, (_, i) => i * 5).map((m) => (
                        <SelectItem
                          key={m}
                          value={m.toString().padStart(2, '0')}
                          className="min-h-[44px] text-lg"
                        >
                          {m.toString().padStart(2, '0')}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Button
                className="w-full min-h-[44px]"
                onClick={() => setShowMobilePicker(false)}
              >
                Done
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    );
  }

  // Desktop dropdown picker
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex gap-2">
        <Select
          value={hour}
          onValueChange={(h) => handleTimeChange(h, minute)}
          disabled={disabled}
        >
          <SelectTrigger className="flex-1">
            <SelectValue placeholder="Hour" />
          </SelectTrigger>
          <SelectContent className="max-h-[200px]">
            {Array.from({ length: 24 }, (_, i) => (
              <SelectItem key={i} value={i.toString().padStart(2, '0')}>
                {i.toString().padStart(2, '0')}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={minute}
          onValueChange={(m) => handleTimeChange(hour, m)}
          disabled={disabled}
        >
          <SelectTrigger className="flex-1">
            <SelectValue placeholder="Min" />
          </SelectTrigger>
          <SelectContent className="max-h-[200px]">
            {Array.from({ length: 12 }, (_, i) => i * 5).map((m) => (
              <SelectItem key={m} value={m.toString().padStart(2, '0')}>
                {m.toString().padStart(2, '0')}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
};
