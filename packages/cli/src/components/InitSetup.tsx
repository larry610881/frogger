import React, { useState, useRef, useEffect } from 'react';
import { Box, Text, useApp, useInput } from 'ink';
import type { ProviderEntry } from '@frogger/shared';

interface InitSetupProps {
  onComplete: () => void;
}

function maskKey(key: string): string {
  if (key.length <= 4) return '\u2022'.repeat(key.length);
  return '\u2022'.repeat(key.length - 4) + key.slice(-4);
}

type Step = 'loading' | 'provider' | 'apiKey' | 'model' | 'saving' | 'done';

export function InitSetup({ onComplete }: InitSetupProps): React.ReactElement {
  const { exit } = useApp();
  const [step, setStep] = useState<Step>('loading');
  const [providers, setProviders] = useState<ProviderEntry[]>([]);
  const [providerIdx, setProviderIdx] = useState(0);
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('');
  const [savedPath, setSavedPath] = useState('');
  const [error, setError] = useState('');

  // Use refs to track current values — React state may lag behind in rapid input
  const apiKeyRef = useRef('');
  const modelRef = useRef('');

  // Load providers dynamically from registry
  useEffect(() => {
    import('@frogger/core').then(({ loadProviders }) => {
      const loaded = loadProviders();
      setProviders(loaded);
      setStep('provider');
    });
  }, []);

  const selectedProvider = providers[providerIdx];

  useInput((ch, key) => {
    if (key.escape) {
      exit();
      return;
    }

    if (step === 'provider') {
      if (key.upArrow) {
        setProviderIdx(prev => Math.max(0, prev - 1));
      } else if (key.downArrow) {
        setProviderIdx(prev => Math.min(providers.length - 1, prev + 1));
      } else if (key.return && selectedProvider) {
        modelRef.current = selectedProvider.defaultModel;
        setModel(selectedProvider.defaultModel);
        setStep('apiKey');
      }
      return;
    }

    if (step === 'apiKey') {
      if (key.return) {
        if (apiKeyRef.current.trim()) {
          setStep('model');
        }
        return;
      }
      if (key.backspace || key.delete) {
        apiKeyRef.current = apiKeyRef.current.slice(0, -1);
        setApiKey(apiKeyRef.current);
        return;
      }
      if (ch && !key.ctrl && !key.meta && !key.tab) {
        apiKeyRef.current += ch;
        setApiKey(apiKeyRef.current);
      }
      return;
    }

    if (step === 'model') {
      if (key.return) {
        setStep('saving');
        doSave();
        return;
      }
      if (key.backspace || key.delete) {
        modelRef.current = modelRef.current.slice(0, -1);
        setModel(modelRef.current);
        return;
      }
      if (ch && !key.ctrl && !key.meta && !key.tab) {
        modelRef.current += ch;
        setModel(modelRef.current);
      }
      return;
    }

    if (step === 'done') {
      if (key.return) {
        onComplete();
      }
    }
  });

  async function doSave() {
    try {
      const { saveConfig } = await import('@frogger/core');
      const finalKey = apiKeyRef.current.trim();
      const finalModel = modelRef.current.trim() || selectedProvider?.defaultModel || '';
      const configPath = await saveConfig({
        provider: selectedProvider?.name,
        model: finalModel,
        apiKey: finalKey,
      });
      setSavedPath(configPath);
      setStep('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStep('done');
    }
  }

  return (
    <Box flexDirection="column" padding={1}>
      <Text color="green" bold>Frogger Setup</Text>
      <Text dimColor>Configure your LLM provider and API key.</Text>
      <Text> </Text>

      {/* Loading */}
      {step === 'loading' && (
        <Text dimColor>Loading providers...</Text>
      )}

      {/* Step 1: Provider */}
      {step === 'provider' && (
        <Box flexDirection="column">
          <Text bold>Select provider (up/down to move, Enter to select):</Text>
          <Text> </Text>
          {providers.map((p, i) => (
            <Text key={p.name}>
              <Text color={i === providerIdx ? 'green' : 'white'}>
                {i === providerIdx ? '> ' : '  '}
              </Text>
              <Text bold={i === providerIdx}>{p.label}</Text>
            </Text>
          ))}
        </Box>
      )}

      {/* Step 2: API Key */}
      {step === 'apiKey' && selectedProvider && (
        <Box flexDirection="column">
          <Text>Provider: <Text color="green" bold>{selectedProvider.label}</Text></Text>
          <Text> </Text>
          <Text bold>Enter your API key (paste and press Enter):</Text>
          <Text dimColor>Environment variable: {selectedProvider.envKey}</Text>
          <Text> </Text>
          <Box>
            <Text color="yellow">API Key: </Text>
            <Text>{apiKey ? maskKey(apiKey) : ''}</Text>
            <Text color="gray">{'\u2588'}</Text>
          </Box>
          {apiKey.length > 0 && (
            <Text dimColor>({apiKey.length} characters entered)</Text>
          )}
        </Box>
      )}

      {/* Step 3: Model */}
      {step === 'model' && selectedProvider && (
        <Box flexDirection="column">
          <Text>Provider: <Text color="green" bold>{selectedProvider.label}</Text></Text>
          <Text>API Key:  <Text dimColor>{maskKey(apiKey)}</Text></Text>
          <Text> </Text>
          <Text bold>Model name (Enter to confirm):</Text>
          <Text dimColor>Available: {selectedProvider.models.map(m => m.name).join(', ')}</Text>
          <Text> </Text>
          <Box>
            <Text color="yellow">Model: </Text>
            <Text>{model}</Text>
            <Text color="gray">{'\u2588'}</Text>
          </Box>
        </Box>
      )}

      {/* Saving */}
      {step === 'saving' && (
        <Text color="cyan">Saving configuration...</Text>
      )}

      {/* Done */}
      {step === 'done' && !error && selectedProvider && (
        <Box flexDirection="column">
          <Text color="green" bold>Configuration saved!</Text>
          <Text> </Text>
          <Text>  Provider: <Text bold>{selectedProvider.label}</Text></Text>
          <Text>  Model:    <Text bold>{model}</Text></Text>
          <Text>  API Key:  <Text dimColor>{maskKey(apiKey)}</Text></Text>
          <Text>  Config:   <Text dimColor>{savedPath}</Text></Text>
          <Text> </Text>
          <Text dimColor>Press Enter to start Frogger, or run `frogger` anytime.</Text>
        </Box>
      )}

      {step === 'done' && error && (
        <Box flexDirection="column">
          <Text color="red" bold>Failed to save config</Text>
          <Text color="red">{error}</Text>
        </Box>
      )}
    </Box>
  );
}
