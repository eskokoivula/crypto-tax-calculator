"use client";

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { EXCHANGE_INSTRUCTIONS } from '@/lib/exchange/instructions';
import {
  CheckCircleIcon,
  XCircleIcon,
  Loader2Icon,
  EyeIcon,
  EyeOffIcon,
  ShieldAlertIcon,
} from 'lucide-react';

interface ApiConnectFormProps {
  exchange: string;
  onConnect: (apiKey: string, secret: string) => void;
}

type ConnectionStatus = 'idle' | 'testing' | 'connected' | 'failed';

export function ApiConnectForm({ exchange, onConnect }: ApiConnectFormProps) {
  const [apiKey, setApiKey] = useState('');
  const [secretKey, setSecretKey] = useState('');
  const [showSecret, setShowSecret] = useState(false);
  const [status, setStatus] = useState<ConnectionStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  const instruction = EXCHANGE_INSTRUCTIONS[exchange];
  const hasApi = instruction && instruction.apiSteps.length > 1;

  const handleTestConnection = useCallback(async () => {
    if (!apiKey.trim() || !secretKey.trim()) return;

    setStatus('testing');
    setError(null);

    try {
      const response = await fetch(`/api/exchange/${exchange}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey: apiKey.trim(),
          secret: secretKey.trim(),
          action: 'test',
        }),
      });

      const data = await response.json();

      if (data.connected) {
        setStatus('connected');
      } else {
        setStatus('failed');
        setError(data.error || 'Connection failed. Check your API key and secret.');
      }
    } catch {
      setStatus('failed');
      setError('Network error. Please try again.');
    }
  }, [apiKey, secretKey, exchange]);

  const handleSync = useCallback(async () => {
    if (status !== 'connected') return;

    setSyncing(true);
    try {
      onConnect(apiKey.trim(), secretKey.trim());
    } finally {
      setSyncing(false);
    }
  }, [status, apiKey, secretKey, onConnect]);

  if (!hasApi) {
    return (
      <div className="py-8 text-center space-y-2">
        <ShieldAlertIcon className="size-8 mx-auto text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          {instruction?.exchange || exchange} does not support API connections.
        </p>
        <p className="text-xs text-muted-foreground">
          Please use CSV export instead.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* API Key */}
      <div className="space-y-1.5">
        <Label htmlFor="api-key">API Key</Label>
        <Input
          id="api-key"
          type="text"
          placeholder="Enter your API key"
          value={apiKey}
          onChange={(e) => {
            setApiKey(e.target.value);
            if (status !== 'idle') setStatus('idle');
          }}
          autoComplete="off"
        />
      </div>

      {/* Secret Key */}
      <div className="space-y-1.5">
        <Label htmlFor="secret-key">Secret Key</Label>
        <div className="relative">
          <Input
            id="secret-key"
            type={showSecret ? 'text' : 'password'}
            placeholder="Enter your secret key"
            value={secretKey}
            onChange={(e) => {
              setSecretKey(e.target.value);
              if (status !== 'idle') setStatus('idle');
            }}
            className="pr-9"
            autoComplete="off"
          />
          <button
            type="button"
            onClick={() => setShowSecret(!showSecret)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            {showSecret ? <EyeOffIcon className="size-4" /> : <EyeIcon className="size-4" />}
          </button>
        </div>
      </div>

      {/* Connection Status */}
      {status !== 'idle' && (
        <div className="flex items-center gap-2 text-sm">
          {status === 'testing' && (
            <>
              <Loader2Icon className="size-4 animate-spin text-muted-foreground" />
              <span className="text-muted-foreground">Testing connection...</span>
            </>
          )}
          {status === 'connected' && (
            <>
              <CheckCircleIcon className="size-4 text-emerald-500" />
              <span className="text-emerald-600 dark:text-emerald-400">Connected successfully</span>
            </>
          )}
          {status === 'failed' && (
            <>
              <XCircleIcon className="size-4 text-destructive" />
              <span className="text-destructive">{error || 'Connection failed'}</span>
            </>
          )}
        </div>
      )}

      {/* Security Notice */}
      <div className="rounded-lg bg-muted/50 p-3 flex items-start gap-2">
        <ShieldAlertIcon className="size-4 text-muted-foreground flex-none mt-0.5" />
        <p className="text-xs text-muted-foreground">
          API keys are only used in memory and never stored permanently. They are sent to our server
          only to proxy the request to {instruction?.exchange || exchange} and are not logged or saved.
        </p>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <Button
          variant="outline"
          onClick={handleTestConnection}
          disabled={!apiKey.trim() || !secretKey.trim() || status === 'testing'}
        >
          {status === 'testing' && <Loader2Icon className="size-4 animate-spin" />}
          Test Connection
        </Button>

        <Button
          onClick={handleSync}
          disabled={status !== 'connected' || syncing}
        >
          {syncing && <Loader2Icon className="size-4 animate-spin" />}
          Sync Data
        </Button>
      </div>
    </div>
  );
}
