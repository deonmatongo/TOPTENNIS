
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Cookie, Settings } from 'lucide-react';

interface CookiePreferences {
  essential: boolean;
  analytics: boolean;
  marketing: boolean;
}

const CookieConsent = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [showPreferences, setShowPreferences] = useState(false);
  const [preferences, setPreferences] = useState<CookiePreferences>({
    essential: true,
    analytics: false,
    marketing: false,
  });

  useEffect(() => {
    const consent = localStorage.getItem('cookie-consent');
    if (!consent) {
      setIsOpen(true);
    }
  }, []);

  const handleAcceptAll = () => {
    const allAccepted = {
      essential: true,
      analytics: true,
      marketing: true,
    };
    localStorage.setItem('cookie-consent', JSON.stringify(allAccepted));
    setIsOpen(false);
  };

  const handleAcceptSelected = () => {
    localStorage.setItem('cookie-consent', JSON.stringify(preferences));
    setIsOpen(false);
  };

  const handleRejectAll = () => {
    const essentialOnly = {
      essential: true,
      analytics: false,
      marketing: false,
    };
    localStorage.setItem('cookie-consent', JSON.stringify(essentialOnly));
    setIsOpen(false);
  };

  const handlePreferenceChange = (type: keyof CookiePreferences, value: boolean) => {
    if (type === 'essential') return; // Essential cookies cannot be disabled
    setPreferences(prev => ({
      ...prev,
      [type]: value,
    }));
  };

  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-bold">
            <Cookie className="w-5 h-5" />
            Cookie Preferences
          </DialogTitle>
          <DialogDescription className="text-base leading-relaxed">
            We use cookies to enhance your browsing experience, serve personalized content, and analyze our traffic. 
            By clicking "Accept All", you consent to our use of cookies.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {!showPreferences ? (
            // Simple consent view
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Choose your cookie preferences or accept all cookies to continue with the best experience.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-3">
                <Button 
                  onClick={handleAcceptAll}
                  className="bg-orange-600 hover:bg-orange-700 text-white font-semibold"
                >
                  Accept All Cookies
                </Button>
                <Button 
                  onClick={() => setShowPreferences(true)}
                  variant="outline"
                  className="font-semibold"
                >
                  <Settings className="w-4 h-4 mr-2" />
                  Customize Preferences
                </Button>
                <Button 
                  onClick={handleRejectAll}
                  variant="ghost"
                  className="font-semibold"
                >
                  Reject All
                </Button>
              </div>
            </div>
          ) : (
            // Detailed preferences view
            <div className="space-y-6">
              <div className="space-y-4">
                {/* Essential Cookies */}
                <div className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <Label htmlFor="essential" className="text-base font-semibold">
                      Essential Cookies
                    </Label>
                    <Switch
                      id="essential"
                      checked={preferences.essential}
                      disabled={true}
                      className="opacity-50"
                    />
                  </div>
                  <p className="text-sm text-gray-600">
                    These cookies are necessary for the website to function and cannot be switched off. 
                    They are usually set in response to actions made by you.
                  </p>
                </div>

                {/* Analytics Cookies */}
                <div className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <Label htmlFor="analytics" className="text-base font-semibold">
                      Analytics Cookies
                    </Label>
                    <Switch
                      id="analytics"
                      checked={preferences.analytics}
                      onCheckedChange={(checked) => handlePreferenceChange('analytics', checked)}
                    />
                  </div>
                  <p className="text-sm text-gray-600">
                    These cookies help us understand how visitors interact with our website by collecting 
                    and reporting information anonymously.
                  </p>
                </div>

                {/* Marketing Cookies */}
                <div className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <Label htmlFor="marketing" className="text-base font-semibold">
                      Marketing Cookies
                    </Label>
                    <Switch
                      id="marketing"
                      checked={preferences.marketing}
                      onCheckedChange={(checked) => handlePreferenceChange('marketing', checked)}
                    />
                  </div>
                  <p className="text-sm text-gray-600">
                    These cookies are used to deliver relevant advertisements and track the effectiveness 
                    of our marketing campaigns.
                  </p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t">
                <Button 
                  onClick={handleAcceptSelected}
                  className="bg-orange-600 hover:bg-orange-700 text-white font-semibold"
                >
                  Save Preferences
                </Button>
                <Button 
                  onClick={() => setShowPreferences(false)}
                  variant="outline"
                  className="font-semibold"
                >
                  Back
                </Button>
              </div>
            </div>
          )}

          <div className="text-xs text-gray-500 pt-4 border-t">
            <p>
              For more information about how we use cookies, please read our{' '}
              <a href="/privacy-policy" className="text-orange-600 hover:underline">
                Privacy Policy
              </a>{' '}
              and{' '}
              <a href="/cookie-policy" className="text-orange-600 hover:underline">
                Cookie Policy
              </a>.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CookieConsent;
