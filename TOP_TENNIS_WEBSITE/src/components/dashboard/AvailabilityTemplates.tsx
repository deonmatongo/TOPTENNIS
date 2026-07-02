import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Clock, Plus, Trash2, Download } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface Template {
  id: string;
  user_id: string;
  name: string;
  template_data: {
    days: { day: number; start_time: string; end_time: string }[];
  };
  created_at: string;
}

export const AvailabilityTemplates = () => {
  const { user } = useAuth();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [selectedDays, setSelectedDays] = useState<{ day: number; start_time: string; end_time: string }[]>([]);

  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  useEffect(() => {
    if (user) {
      fetchTemplates();
    }
  }, [user]);

  const fetchTemplates = async () => {
    try {
      const { data, error } = await supabase
        .from('availability_templates' as any)
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTemplates((data as unknown as Template[]) || []);
    } catch (error) {
      console.error('Error fetching templates:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveTemplate = async () => {
    if (!templateName.trim() || selectedDays.length === 0) {
      toast.error('Please enter a template name and select at least one day');
      return;
    }

    try {
      const { error } = await supabase
        .from('availability_templates' as any)
        .insert({
          user_id: user?.id,
          name: templateName,
          template_data: { days: selectedDays },
        });

      if (error) throw error;

      toast.success('Template saved successfully');
      setDialogOpen(false);
      setTemplateName('');
      setSelectedDays([]);
      fetchTemplates();
    } catch (error) {
      console.error('Error saving template:', error);
      toast.error('Failed to save template');
    }
  };

  const handleDeleteTemplate = async (id: string) => {
    try {
      const { error } = await supabase
        .from('availability_templates' as any)
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast.success('Template deleted');
      fetchTemplates();
    } catch (error) {
      console.error('Error deleting template:', error);
      toast.error('Failed to delete template');
    }
  };

  const handleApplyTemplate = async (template: Template) => {
    toast.info('Template application feature will be integrated with availability creation');
    // This will be used in EnhancedAvailabilityModal
  };

  const addDay = () => {
    setSelectedDays([...selectedDays, { day: 1, start_time: '09:00', end_time: '17:00' }]);
  };

  const removeDay = (index: number) => {
    setSelectedDays(selectedDays.filter((_, i) => i !== index));
  };

  const updateDay = (index: number, field: 'day' | 'start_time' | 'end_time', value: any) => {
    const updated = [...selectedDays];
    updated[index] = { ...updated[index], [field]: value };
    setSelectedDays(updated);
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5" />
              Availability Templates
            </CardTitle>
            <Button onClick={() => setDialogOpen(true)} size="sm">
              <Plus className="w-4 h-4 mr-2" />
              New Template
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading templates...</p>
          ) : templates.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No templates yet. Create one to quickly apply common availability patterns.
            </p>
          ) : (
            <div className="space-y-3">
              {templates.map((template) => (
                <div
                  key={template.id}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent/50 transition-colors"
                >
                  <div className="flex-1">
                    <h4 className="font-semibold">{template.name}</h4>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {template.template_data.days.map((day, idx) => (
                        <Badge key={idx} variant="secondary" className="text-xs">
                          {dayNames[day.day]}: {day.start_time} - {day.end_time}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleApplyTemplate(template)}
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Apply
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteTemplate(template.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Availability Template</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="template-name">Template Name</Label>
              <Input
                id="template-name"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder="e.g., Weekday Mornings"
              />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Days & Times</Label>
                <Button onClick={addDay} size="sm" variant="outline">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Day
                </Button>
              </div>

              {selectedDays.map((day, idx) => (
                <div key={idx} className="flex items-center gap-3 p-3 border rounded-lg">
                  <select
                    value={day.day}
                    onChange={(e) => updateDay(idx, 'day', parseInt(e.target.value))}
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                  >
                    {dayNames.map((name, i) => (
                      <option key={i} value={i}>
                        {name}
                      </option>
                    ))}
                  </select>
                  <Input
                    type="time"
                    value={day.start_time}
                    onChange={(e) => updateDay(idx, 'start_time', e.target.value)}
                    className="w-32"
                  />
                  <span className="text-muted-foreground">to</span>
                  <Input
                    type="time"
                    value={day.end_time}
                    onChange={(e) => updateDay(idx, 'end_time', e.target.value)}
                    className="w-32"
                  />
                  <Button variant="ghost" size="sm" onClick={() => removeDay(idx)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}

              {selectedDays.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Click "Add Day" to start creating your template
                </p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveTemplate}>Save Template</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
