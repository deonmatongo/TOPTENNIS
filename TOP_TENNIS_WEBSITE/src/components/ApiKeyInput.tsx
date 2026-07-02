
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Eye, EyeOff, Key } from "lucide-react";

interface ApiKeyInputProps {
  onApiKeySet: (apiKey: string) => void;
  hasApiKey: boolean;
}

const ApiKeyInput = ({ onApiKeySet, hasApiKey }: ApiKeyInputProps) => {
  const [apiKey, setApiKey] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);

  const handleSubmit = () => {
    if (apiKey.trim()) {
      localStorage.setItem('opencage_api_key', apiKey.trim());
      onApiKeySet(apiKey.trim());
    }
  };

  if (hasApiKey) {
    return (
      <div className="text-sm text-green-400 mb-4 flex items-center">
        <Key className="w-4 h-4 mr-2" />
        API key configured ✓
      </div>
    );
  }

  return (
    <div className="mb-6 p-4 bg-white/5 rounded-lg border border-white/10">
      <h3 className="text-sm font-semibold mb-2">Configure Geolocation API</h3>
      <p className="text-xs text-white/70 mb-3">
        Enter your OpenCage API key to enable real location search. 
        <a href="https://opencagedata.com/api" target="_blank" rel="noopener noreferrer" className="text-orange-400 hover:underline ml-1">
          Get free API key here
        </a>
      </p>
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Input
            type={showApiKey ? "text" : "password"}
            placeholder="Enter OpenCage API key"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            className="pr-10 bg-white/10 border-white/20 text-white placeholder:text-white/60"
          />
          <button
            type="button"
            onClick={() => setShowApiKey(!showApiKey)}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-white/60 hover:text-white/80"
          >
            {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
        <Button
          onClick={handleSubmit}
          disabled={!apiKey.trim()}
          className="bg-orange-500 hover:bg-orange-600"
        >
          Set API Key
        </Button>
      </div>
    </div>
  );
};

export default ApiKeyInput;
